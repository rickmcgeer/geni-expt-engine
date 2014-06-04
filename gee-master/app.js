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
var mongo = require('mongodb');
var mongoose = require('mongoose');

// the host and port we are running on, and the URL for people to request
var host_name = 'igplc.cs.princeton.edu'
application_port = 8080
var application_url = 'http://' + host_name + ':' + application_port;
// Code to initialize and connect to the database.  We're using mongodb, default port, and mongoose
mongoose.connect('mongodb://localhost/gee_master');
var gee_master_db = mongoose.connection;
gee_master_db.on('error', console.error.bind(console, 'Mongoose connection error to gee-master'));
gee_master_db.once('open', function callback() {
  console.log("Connection to db done");
});
// configure node.  We'll use Jade for templating and put the templates in view.
// We will parse cookies and query bodies, and route queries
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.static(__dirname + '/public'));
  app.use(express.logger());
  app.use(express.cookieParser());
  // app.use(express.cookieSession);
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

// OpenID strategy to call back to the GPO.

passport.use(new OpenIDStrategy({
    returnURL: application_url + '/auth/openID/return',
    realm: application_url + '/',
    profile: true,
    stateless: true
  },
  function(identifier, profile, done) {
    // Simplest login strategy -- just write out to the console.  We'll save the user
    // email in a session variable
    process.nextTick(function() {
      console.log(JSON.stringify(profile));
      console.log(JSON.stringify(profile.emails[0].value));
      return done(null, profile);
    });
  }
));

// Database code.  The database currently holds the users and slice data.
// To add an authorized user or a slice, do it from the console on bilby.
// The slice/user data ought to migrate to the MyPLC DB -- this is a hack to
// try stuff out...will ask Andy about moving authorized users to the MyPLC DB,
// but we can do it here...


// database schema:
// users: {email, role [list, currently just "admin"], admin [a boolean], "slice"}
// users.slice is null if the user has no slice
// users.slice and users.role are now obsolete and will probably be deleted

// email is a unique index for both the collections users and user_requests in
// mongo (done from the command line) so we don't have to worry about duplicate entries

var user_schema = mongoose.Schema({
  email: String,
  role: {type: [String], default:["user"]},
  admin: {type:Boolean, default: false},
  slice: { type: String, default: null }
});

// get the users out of the database
var Users = mongoose.model('users', user_schema);

// user requests
// These are requests that have come in from the form and are to be serviced

var user_request_schema = mongoose.Schema({
  email: String,
  name: {type: String, default: null},
  comments: {type: String, default: null},
  created: {type: Date, default: Date.now}
});

// a variable for the user requests
var UserRequests = mongoose.model('user_requests', user_request_schema);

// URLs to get, renew, and free slicelets, and download the tarball
var get_slicelet_url = application_url + "/get_slicelet";
var free_slicelet_url = application_url + "/free_slicelet";
var renew_slicelet_url = application_url + "/renew_slicelet";
var download_url = application_url + "/download";

var urls = {
  get_slicelet_url:get_slicelet_url,
  free_slicelet_url:free_slicelet_url,
  renew_slicelet_url:renew_slicelet_url,
  download_url:download_url
}



require('./routes/')(app,passport, Users, UserRequests,urls,url);


// Just a test to see if the bug report functionality works

app.get('/test_bug_report', function(req, res) {
  render_error_page(req, res, "Bug Report Test", "This is a test of bug reporting functionality");
});

// A test to walk us through the add_user_request pipeline
// Don't forget to delete users through mongo when done
//app.get('/test_user_add', function(req, res) {
//  res.render('unauthorized_user', {user:'foo@bar.com', title:'Unauthorized User'});
//});

//404 handling
app.use(function(req, res, next){
	res.status(404);
	
	// respond with html page
	if (req.accepts('html')) {
		res.render('404', {title: '404'});
		return;
	}
	
	// respond with json
	if (req.accepts('json')) {
		res.json({ error: '404 - Not found' });
		return;
	}
	
	// default to plain-text. send()
	res.type('txt').send('Not found');
});