//Copyright (c) 2014 US Ignite 
// 
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
//and/or hardware specification (the “Work”) to deal in the Work without restriction, including 
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


passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// End Code to be deleted

/*
 * Initialize node and parameters we will need.
 */

var url = require('url');
var http = require('http');
var app = express();
// the host and port we are running on, and the URL for people to request
var host_name = 'igplc.cs.princeton.edu'
application_port = 8080
var application_url = 'http://' + host_name + ':' + application_port;
// configure node.  We'll use Jade for templating and put the templates in view.
// We will parse cookies and query bodies, and route queries
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.static(__dirname + '/public'));
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});
app.set('env', 'development');
//
// show the stack when we debug; when we are in production use the error handler.
app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Initialize the server
var server = app.listen(application_port, function() {
    console.log('Listening on port %d', server.address().port);
});

// OpenID strategy to call back to the GPO.  Note that the URL for the GPO
// callback page is in three places in the jade templates -- login.jade,
// login_failure.jade, unauthorized_user.jade.

passport.use(new OpenIDStrategy({
    returnURL: application_url + '/auth/openID/return',
    realm: application_url + '/',
    profile: true,
    stateless: true
  },
  function(identifier, profile, done) {
    // ...
    process.nextTick(function() {
      console.log(JSON.stringify(profile));
      user_email = profile.emails[0].value; // check this -- see what GPO actually returns
      console.log(JSON.stringify(user_email));
      return done(null, profile);
    });
  }
));


// user_email is the identity we are going to pull back from the GPO.  We
// may ask Tom to provide more
var user_email;


// Accept the OpenID identifier and redirect the user to their OpenID
// provider for authentication (GPO).  When complete, the provider will redirect
// the user back to the application at:
//     /auth/openid/return

app.post('/auth/openid', passport.authenticate('openid'));


// The OpenID provider has redirected the user back to the application.
// Finish the authentication process by verifying the assertion (we won't
// bother).   We could check the valid addresses here, but we'll do that
// later because it's code we'll remove.  If valid,
// the user will be logged in.  Otherwise, authentication has failed.
app.get('/auth/openid/return', 
  passport.authenticate('openid', { successRedirect: '/logged_in',
                                    failureRedirect: '/login_failure' }));

// The greeting page is the login page

app.get('/', function(req, res) {
    res.render('login');
});

// Redirect here on failure.  This page will permit the user to try to login
// again

app.get('/login_failure', function(req, res) {
    res.render('login_failure');
});

// only users who can use the app during the beta period

var authorized_users = ["rick@mcgeer.com", "acb@cs.princeton.edu"];

// Successful login page.  Should be extensively modified.  Right now, shows a
// check-back-later page if the user isn't authorized, and if it is
// shows the user two options: get a slicelet or free a slicelet, as URLs.
// Four things:
// 1. The UI elements should be buttons
// 2. The user name is an open parameter (should be in a cookie; this is insecure)
// 3.  Should show active slicelets and expiration times
// 4. Several more options should be added: Renew a slice, get credentials for an existing slicelet,
//    ...what else?

app.get('/logged_in', function(req, res) {
    var i = authorized_users.indexOf(user_email);
    if (i == -1) {
      res.render('unauthorized_user', {user:user_email});
    } else {
      var get_slicelet_url = application_url + "/get_slicelet?user=" + user_email;
      var free_slicelet_url = application_url + "/free_slicelet?user=" + user_email;
      res.render('logged_in', {user:user_email, get_url:get_slicelet_url, free_url:free_slicelet_url});
    }
});

// get a slicelet.  This just calls $ allocate-gee-slice.plcsh -- -e <user>.  This
// script returns a JSON object with two fields, user (the user email) and slicelet_file
// If the command fails, we tell the user, with the error message -- and should probably
// do more, like submit a bug report to ourselves, or give the user that option.
// If it succeeds, give the user a  URL which points to a download.

app.get('/get_slicelet', function(req, res) {
    console.log(req.url);
    var query = url.parse(req.url, true).query;
    console.log(JSON.stringify(query));
    var user_email = query.user;
    console.log(user_email);
    var spawn = require('child_process').spawn;
    var cmd = spawn('/home/service_instageni/allocate-gee-slice.plcsh', ["--", "-e", user_email]);
    /* var cmd = spawn('./gee-slicelet.py', [user_email]); */
    var returned_user = null;
    var download_file = null;
    var error = "";
    cmd.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
        result = JSON.parse(data);
        returned_user = result.user;
        download_file = result.slicelet_file;
    });
    cmd.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
        error = error + data;
    });
    cmd.on('close', function (code) {
        console.log('child process exited with code ' + code);
        // res.send("Completed with result: " + result + " error: " + error);
        if (download_file != null) {
            var download_url = application_url + '/download?file=' + download_file;
            res.render('download_template', {fields:{user:returned_user, download_url:download_url}});
        } else {
            res.send('Slicelet Allocation Failed for' + returned_user);
        }
    });
});

// free a slicelet.  This just calls $ free-gee-slice.plcsh -- -e <user>.  This
// script returns a JSON object with two fields, user (the user email) and slicelet_file
// Currently just tell the user what happened, not in an attractive way -- need to fix this

app.get('/free_slicelet', function(req, res) {
    console.log(req.url);
    var query = url.parse(req.url, true).query;
    console.log(JSON.stringify(query));
    var user_email = query.user;
    console.log(user_email);
    var spawn = require('child_process').spawn;
    var cmd = spawn('/home/service_instageni/free-gee-slice.plcsh', ["--", "-e", user_email]);
    /* var cmd = spawn('./gee-slicelet.py', [user_email]); */
    var error = "";
    var result = "";
    cmd.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
        result = result + data;
    });
    cmd.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
        error = error + data;
    });
    cmd.on('close', function (code) {
        console.log('child process exited with code ' + code);
        res.send("Completed with result: " + result + " error: " + error);
    });
});

// Callback for download.  Fortunately, this is simple, as node.js provides a
// download primitive.  We need to error-check this batter.
app.get('/download', function(req, res) {
    console.log(req.url);
    var query = url.parse(req.url, true).query;
    console.log(JSON.stringify(query));
    filename=query.file;
    console.log(filename);
    res.download(filename);
});

