//Copyright (c) 2014 US Ignite
//
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software
//and/or hardware specification (the �Work�) to deal in the Work without restriction, including
//without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
//sell copies of the Work, and to permit persons to whom the Work is furnished to do so, subject to
//the following conditions:
//
//The above copyright notice and this permission notice shall be included in all copies or
//substantial portions of the Work.
//
//THE WORK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
//OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
//MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
//NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
//HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
//WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//OUT OF OR IN CONNECTION WITH THE WORK OR THE USE OR OTHER DEALINGS
//IN THE WORK.
/* Main webserver for the GENI Experiment Engine Compute Engine.  Major
 * Functions: Get  a Slicelet (/get_slicelet), Free a Slicelet (/free_slicelet)
 * renew a slicelet /renew_slicelet, to be written
 * Node server (of course.  Run as node app1.js)
 * Uses passport for authentication, calling back to the GPO identity server
 */
var express = require("express");

var passport = require('passport');
var OpenIDStrategy = require('passport-openid').Strategy;

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (obj, done) {
    done(null, obj);
});

// End Code to be deleted
/*
 * Initialize node and parameters we will need.
 */

var url = require('url');
var http = require('http');
var app = express();
var mongo = require('mongodb');
var mongoose = require('mongoose');
var nconf = require('nconf');

// We use nconf to read configuration options.  Command line arguments override config file options which override default options.
nconf.argv().file('./config.json');
nconf.defaults({
    host_name: 'gee-project.org',
    application_port: 80,
    mongo_url: 'mongodb://localhost/gee_master',
    session_secret: 'keyboard cat',
    script_dir: '/root',
    real_host_name: 'node56.stanford.vicci.org',
    // need to use this because app.listen ignores port forwarding (EADDRINUSE errors because of plc webserver
    real_port: 80
});

// the host and port we are running on, and the URL for people to request, and the directory
// where igplc scripts run
var host_name = nconf.get('host_name');
var application_port = nconf.get('application_port');
var application_url = 'http://' + host_name + ':' + application_port;
var script_dir = nconf.get("script_dir");
var real_host_name = nconf.get('real_host_name');
var real_application_port = nconf.get('real_port');
// Code to initialize and connect to the database.  We're using mongodb, default port, and mongoose
mongoose.connect(nconf.get('mongo_url'));
var gee_master_db = mongoose.connection;
// use autoincrement to automatically get sequences for slice numbers
var autoIncrement = require('mongoose-auto-increment');
autoIncrement.initialize(gee_master_db); // turn on auto-increment in the database
gee_master_db.on('error', console.error.bind(console, 'Mongoose connection error to gee-master'));
gee_master_db.once('open', function callback() {
    console.log("Connection to db done");
});
// configure node.  We'll use Jade for templating and put the templates in view.
// We will parse cookies and query bodies, and route queries
app.configure(function () {
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    app.use(express.static(__dirname + '/public'));
    app.use(express.logger());
    app.use(express.cookieParser());
    // app.use(express.cookieSession);
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.session({
        secret: nconf.get('session_secret')
    }));
    // Initialize Passport!  Also use passport.session() middleware, to support
    // persistent login sessions (recommended).
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(app.router);
    app.use(express.favicon(__dirname + '/public/images/geni.ico'));
});
app.set('env', 'development');
//
// show the stack when we debug; when we are in production use the error handler.
app.configure('development', function () {
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));

});

app.configure('production', function () {
    app.use(express.errorHandler());
});

// Initialize the server
var server = app.listen(real_application_port, function () {
    var entry = {
        level: 'INFO',
        message: 'Server Start',
        data: server.address()
    }
    console.log(entry);
});

// OpenID strategy to call back to the GPO.
passport.use(new OpenIDStrategy({
    returnURL: application_url + '/auth/openID/return',
    realm: application_url + '/',
    profile: true,
    stateless: true
}, function (identifier, profile, done) {
    // Simplest login strategy -- just write out to the console.  We'll save the user
    // email in a session variable
    process.nextTick(function () {
        var entry = {
            level: 'INFO',
            message: 'Login successful',
            data: profile
        }
        console.log(JSON.stringify(entry));
        // console.log(JSON.stringify(profile.emails[0].value));
        return done(null, profile);
    });
}));


// Database code.  .

// database schema:
// users: {email [String], admin [a boolean]}
// email is a unique index for both the collections users and user_requests in
// mongo (done from the command line) so we don't have to worry about duplicate entries
var user_schema = mongoose.Schema({
    email: String,
    admin: {
        type: Boolean,
        default: false
    }
});
// slices: {name, allocated, expires, tarfile}
// name is just the slice name
// user is the email of the user who owns the slice (null if not allocated)
// expires is the date on which the slice expires
// tarfile is the name of slice file
// imageName: name of the image to build the slice with
// ports: list of port mappings for the slice, of the form host:hostPortNum, containerPort: containerPortNum
// sliceName: naem of the slice
var slice_schema = mongoose.Schema({
  user: {
    type: String,
    default: null // no user for this slice
  },
  expires: {
    type: Date
  },
  tarfile: String,
  status: String,
  imageName: String,
  ports: [{
    host: String,
    container: String
   }],
   sliceName: String

})

//
// slice requests: {action, user, sliceName}
// action: create or delete
// user: user to do it for
// sliceName: name to give the script
// imageName: name of the image to build the slice with
// ports: list of port mappings for the slice, of the form host:hostPortNum, containerPort: containerPortNum
// read by slice-daemon.py, so any change here must be accompanied by a change
// there
//
var slice_request_schema = mongoose.Schema({
    action: {
        type: String,
        default: 'delete'
    },
    user: {
        type: String,
        default: null
    },
    sliceName: {
        type:String
    },
    imageName: String,
    ports: [{
      host: String,
      container: String
    }]
})

// turn on auto-increment in the slice-number field
slice_schema.plugin(autoIncrement.plugin, {model: 'slices', field: 'sliceNum'})

// Special slice requests -- requests for slices
// that have been made by users but not acted upon
// by administrators.  These involve open ports,
// images not in the database, or both
// user: email of user requesting special slice
// imageName: text string with the image the user is requesting.
//            The default should be in config.json, and specified there.
// ports: port mappings the user is requesting.  should be in the form x:y,
//        where x is the host port and y is the container port
var special_slice_request_schema = mongoose.Schema( {
    user: {
        type: "String",
        default: null
    },
    imageName: {
        type: "String",
        default: null
    },
    sliceName: {
        type: "String"
    },
    ports: [{
        host: String,
        container: String
    }]
});

// get the users out of the database
var DB = {
    users: mongoose.model('users', user_schema),
    slices: mongoose.model('slices', slice_schema),
    sliceRequests: mongoose.model('slice_requests', slice_request_schema),
    customSliceRequests: mongoose.model('custom_slice_requests', special_slice_request_schema)
}

// URLs to get, renew, and free slicelets, and download the tarball
var get_slicelet_url = application_url + "/get_slicelet";
var free_slicelet_url = application_url + "/free_slicelet";
var renew_slicelet_url = application_url + "/renew_slicelet";
var download_url = application_url + "/download";

var urls = {
    get_slicelet_url: get_slicelet_url,
    free_slicelet_url: free_slicelet_url,
    renew_slicelet_url: renew_slicelet_url,
    download_url: download_url
}



require('./routes/')(app, passport, DB, urls, url, script_dir);


// Just a test to see if the bug report functionality works
app.get('/test_bug_report', function (req, res) {
    render_error_page(req, res, "Bug Report Test", "This is a test of bug reporting functionality");
});

// A test to walk us through the add_user_request pipeline
// Don't forget to delete users through mongo when done
//app.get('/test_user_add', function(req, res) {
//  res.render('unauthorized_user', {user:'foo@bar.com', title:'Unauthorized User'});
//});
//404 handling
app.use(function (req, res, next) {
    res.status(404);

    // respond with html page
    if (req.accepts('html')) {
        res.render('404', {
            title: '404'
        });
        return;
    }

    // respond with json
    if (req.accepts('json')) {
        res.json({
            error: '404 - Not found'
        });
        return;
    }

    // default to plain-text. send()
    res.type('txt').send('Not found');
});
