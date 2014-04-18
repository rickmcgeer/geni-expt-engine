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
    res.render('login', {title: 'Welcome to GEE'});
});

// Redirect here on failure.  This page will permit the user to try to login
// again

app.get('/login_failure', function(req, res) {
    res.render('login_failure', {title: 'Login Failed'});
});


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

// A utility to render the error page, and log it...
function render_error_page(req, res, bug_subject, bug_body_comment) {
  var date = Date();
  //var session_data = JSON.stringify(req.session);
  var bug_report = JSON.stringify({date:date, session:req.session, note:bug_body_comment});
  console.log("Error Page Rendered, subject " + bug_subject + ". Report: " + bug_report);
  res.render('error_page', {bugreport: bug_subject, bugreport_body: bug_report, title: 'Error'});
  
}


// A utility function called from logged_in, get_slicelet, renew_slicelet, download_slicelet...
// Render the page with the user's slice information
// This is only called when req.session.slicename != null...looks up the slice data from the
// database, and renders the page, and handles any errors in the lookup...
// all of the slice information is in slice_dictionary, and is of the form
// {"slice": <slicename>", "slicelet_file": <filename>, "user": "<username>, "has_slicelet": true}


function render_slice_dashboard(req, res, slice_dictionary) {
  if (slice_dictionary.slice == null) { // should never get here!  How do I throw an exception in Javascript?
    render_error_page(req, res, "render_slice_dashboard called with slicename null","render_slice_dashboard called with slicename null");
    return;
  }
  
  page_dictionary = {
    slice: slice_dictionary.slice,
    user: req.session.user,
    admin: req.session.admin,
    date: new Date(slice_dictionary.expires*1000).toString()
  };
  res.render('logged_in_with_slice', page_dictionary);
}

// Successful login page.  
app.get('/logged_in', function(req, res) {
    console.log(JSON.stringify(req.session));
    console.log(JSON.stringify(req.session.passport.user.emails[0].value));
    // squirrel away the userid in a session variable; this way, we don't have to pass
    // it as an argument, or use cookies.
    req.session.user = req.session.passport.user.emails[0].value;
    // See if the user is in the database.  if he isn't, he isn't authorized, and we direct
    // him to a page where he can send us a request 
    Users.find({ email: req.session.user }, function(err, users) {
      if (err) {
        var message = "Error in authorized user lookup for " + req.session.user;
        render_error_page(req, res, message, message);
      } else if (users.length == 0) {
        res.render('unauthorized_user', {user:req.session.user, title:'Unauthorized User'});
      } else {
        // he's a valid user.  If he doesn't have a slice, send him to a page where
        // he can allocate a slicelet.  If he does have a slice, initialize the slicename
        // session variable with the name and send him to his dashboard.
        // Also note whether he is admin
        req.session.admin = users[0].admin;
        get_user_dashboard(req, res);
       
      }
    });
});

// Put in an add-user request.  We're replacing an email here
app.post('/add_user_request', function(req, res) {
  // shouldn't happen, but there are weird timing things...
  Users.find({email:req.body.email}, function(err, users) {
    // we will log any error, but aside from that do nothing -- this was just a sanity check
    if (err) {
      console.log("Error " + err + " in sanity-check lookup of user " + req.body.email + " (which was not expected to succeed)");
    } else if (users.length > 0) {
      console.log("user " + req.body.email + " requested a login but already has an account!");
      req.session.user = req.body.email;
      get_user_dashboard(req, res);
    } else {
      // Add the user to the user_requests table and show a results page
      UserRequests.create( { email: req.body.email, name: req.body.name, comments: req.body.comments}, function(err, addition) {
        if (err) {
          console.log("Error adding user request " + JSON.stringify(req.body) + ": " + err);
          render_error_page(req, res, "Error adding user request " + err, JSON.stringify(req.body));
        } else {
          res.render('user_request_confirm', {email:req.body.email, name: req.body.name, title:'User Request Confirmed'});
        }
      });
    }
  });
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
    var user = req.session.user;
    console.log(user);
    // formulate the command /home/service_instageni/allocate-gee-slice.plcsh -- -e user
    // and set up variables to hold the result
    var spawn = require('child_process').spawn;
    var cmd = spawn('/home/service_instageni/allocate-gee-slice.plcsh', ["--", "-e", user]);
    var returned_user = null;
    var download_file = null;
    var error = "";
    var download_file;
    var expiration_date;
    // callbacks from the command.  When data is received on stdout, that's the output of
    // the command, which will come in a JSON dictionary {user: user-email, slicelet_file:tarball-name, slice:slice-name}
    // then call expiry_date() to get the expiration date, store all the data in the db
    cmd.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
        result = JSON.parse(data);
        returned_user = result.user;
        download_file = result.slicelet_file;
        req.session.slicename = result.slice;
    });
    // when data is received on stderr, we have a problem and log it.  Should do something more
    // intelligent on exit...
    cmd.stderr.on('data', function (data) {
        console.log('Error in allocate-gee-slice: ' + data);
        error = error + data;
    });
    // when the command finishes, render the dashboard
    cmd.on('close', function (code) {
        console.log('child process exited with code ' + code);
        if(req.session.slicename != null) {
          get_user_dashboard(req, res);
        } else {
          render_error_page(req, res, "Slicelet Allocation Failure", error)
        }
    });
});

// get the data for the user dashboard from
// the shell script find-gee-slice.plcsh  and
// render the user dashboard
// command is find_gee_slice -- -e req.session.user
function get_user_dashboard(req, res) {
  var spawn = require('child_process').spawn;
  var cmd = spawn('/home/service_instageni/find-gee-slice.plcsh', ["--", "-e", req.session.user]);
  var error = "";
  var result = "";
  // set the has_slicelet and slice_data variables for this session to a sensible
  has_slicelet = false;
  req.session.slice_data = null;
  var data_received = false;
  // data is of the form
  //  {"slice": <slice-name>, "slicelet_file": <file-name>, "user": <user-name>, "has_slicelet": true}
  // if the user has a slice, and
  // {"user": <user-name>, "has_slicelet": false}
  // if not.
  // if has_slicelet is true, just 

  cmd.stdout.on('data', function(data) {
    console.log('stdout: ' + data);
    result = JSON.parse(data);
    if (result.has_slicelet) {
      req.session.slice_data = result;
      req.session.filename = result.slicelet_file;
    } else {
      req.session.slice_data = null; 
    }
    has_slicelet = result.has_slicelet;
    data_received = true;
  });
  // when data is received on stderr, we have a problem and log it.  Should do something more
  // intelligent on exit...
  cmd.stderr.on('data', function (data) {
    console.log('Error find-gee-slice: ' + data);
    error = error + data;
  });
  // when the command finishes, render the dashboard if there is a slicelet, otherwise
  // the logged_in_no_slice page
  cmd.on('close', function (code) {
    console.log('child process exited with code ' + code);
    if(data_received) {
      if (has_slicelet) {
        render_slice_dashboard(req, res, req.session.slice_data)
      } else {
        res.render('logged_in_no_slice', {user:req.session.user, get_url:get_slicelet_url, admin:req.session.admin});
      }
    } else {
      render_error_page(req, res, "Error in finding slice data", error)
    }
  });
}

// free a slicelet.  This just calls $ free-gee-slice.plcsh -- -e <user>.  This
// script returns a JSON object with two fields, user (the user email) and slicelet_file
// Return the user to the logged-in-with-no-slice page when done

app.get('/free_slicelet', function(req, res) {
    console.log(req.url);
    var query = url.parse(req.url, true).query;
    console.log(JSON.stringify(query));
    var user = req.session.user;
    console.log(user);
    var spawn = require('child_process').spawn;
    var cmd = spawn('/home/service_instageni/free-gee-slice.plcsh', ["--", "-e", user]);
    var error = "";
    var result = "";
    cmd.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
        result = result + data;
    });
    cmd.stderr.on('data', function (data) {
        console.log('Error in free-gee-slice: ' + data);
        error = error + data;
    });
    cmd.on('close', function (code) {
        console.log('child process exited with code ' + code);
        if (error) {
          render_error_page(req, res, "Error in freeing slicelet " + req.session.slicename, error);
        } else {
          req.session.slicename = null;
          req.session.filename = null;
          res.render('logged_in_no_slice', {user:req.session.user, get_url:get_slicelet_url, admin:req.session.admin});
        }
    });
});

//
// Renew a slicelet.  Just calls expiry_date to set the session expiration two weeks into the
// future, updates the slice record, then renders the dashboard.

app.get('/renew_slicelet', function(req, res) {
  if(req.session.slicename == null) {
    render_error_page(req, res, "req.session.slicename null in call to renew_slicelet", "");
  } else {
    console.log("Renewing slice " + req.session.slicename)
    var spawn = require('child_process').spawn;
    var cmd = spawn('/home/service_instageni/renew-gee-slice.plcsh', ["--", "-s", req.session.slicename]);
    var error = "";
    var result = "";
    cmd.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
        result = result + data;
    });
    cmd.stderr.on('data', function (data) {
        console.log('Error in renew-gee-slice: ' + data);
        error = error + data;
    });
    cmd.on('close', function (code) {
        console.log('child process exited with code ' + code);
        if (error) {
          render_error_page(req, res, "Error in renewing slicelet " + req.session.slicename, error);
        } else {
          get_user_dashboard(req, res);
        }
        
    }); 
  }
});

// Callback for download.  Fortunately, this is simple, as node.js provides a
// download primitive.  We need to error-check this better.  In particular, we
// need to check that the file actually exists!
app.get('/download', function(req, res) {
    if(req.session.filename == null) {
      var error_message = "No filename set on call to /download ";
      render_error_page(req, res, error_message, "");
    } else {
      console.log(req.session.filename);
      res.download(req.session.filename);
    }
});

// The user clicked on "send feedback".  This will take him to a page
// where he can send us feedback -- currently we are not displaying this
// on the login page, so ATM the user must be logged in to send feedback
// but no dependency, we can put this on the login page

app.get('/send_feedback', function(req, res) {
  res.render('feedback', {title: 'Feedback'});
});

// Administrator actions and options.  Only available
// through the admin console
app.get('/admin', function(req, res) {
  if (!req.session.admin) {
    res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
  } else {
    res.render('admin_console', {user:req.session.user});
  }
});


// Admin-only access to look at the DB.  Note that the admin must be logged in first
// to access these pages

// Utility to lookup and render the users page -- called from /users and /add_users

function render_users(req, res) {
  Users.find(function(err, users) {
    if (err) return console.error(err);
    console.log(users);
    req.userlist = users;
    get_slicelet_data(req, res, function(req, res, error, slices) {
      if (error) {
        render_error_page(req, res, "Error in displaying users", error);
      } else {
        var user_list = [];
        var slice_dictionary = {};
        for (var slice_index in slices) {
          var slice = slices[slice_index];
          slice_dictionary[slice.allocated] = slice.name;
        }
        
        for (var index in req.userlist) {
          var user = req.userlist[index];
          user_list.push({email:user['email'], admin:user['admin'], slice:slice_dictionary[user['email']]});
        }
        
        res.render('users', {"userlist": user_list, title:'User List'});
      }
    });
  });
}

// A little utility because HTML forms return a string when only a single item is
// checked in a list of checkboxes, but a list if more than one is checked.  This does awful things
// unless you regularize it...

function ensure_items_in_a_list(input_parm) {
  var result = input_parm;
  if (result == null) return []; // no nulls
  if (typeof(result) == "string") return [result];
  return result;
}

app.get('/user_requests', function(req, res) {
  if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
    res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
  } else {
    render_user_requests(req, res);
  }
});

function render_user_requests(req, res) {
  UserRequests.find({}, function(err, user_requests) {
    if(err) {
      console.log("Error finding outstanding user requests: " + err);
      render_error_page(req, res, "Error in displaying user requests", error);
    }
    res.render('user_requests', {"request_list": user_requests, title:'User List'});
  });
}

// The next three functions implement acting on user requests.  This comes from
// the form /add_requested_users on page user_requests.jade.
// This form will give us two separate email lists: new user requests to be
// confirmed, and requests to be deleted.  Here, we pull out the two lists
// and call act_on_user_requests to manipulate the database.
// I should probably factor those into things which actually just manipulate the db

app.post('/add_requested_users', function(req, res) {
  var to_confirm = ensure_items_in_a_list(req.body.confirm);
  var to_delete = ensure_items_in_a_list(req.body.to_delete);
  var user_string = "Will confirm " + to_confirm.length + " new users: " + to_confirm + ".";
  var delete_string = "Will delete " + to_delete.length + " requests: " + to_delete;
  console.log(user_string + " " + delete_string);
  if (to_confirm.length == 0 && to_delete.length == 0) {
    // nothing to do!
    res.render('admin_console', {user:req.session.user});
  } else {
    act_on_user_requests(req, res, to_confirm, to_delete);
  }
});

// Act on the user requests.  This is called by /add_requested_users, and is broken
// out as a separate function to avoid the usual node deep nesting...

function act_on_user_requests(req, res, confirm, to_delete) {
  // first, make sure that we are going to delete all the records we
  // are confirming.  Also prepare the array for the batch add to Users.
  var new_users = [];
  // Should I check if this user is already in the DB?  That would be a pain, due
  // to the asynch nature of find...
  for(var confirm_index in confirm) {
    var user = confirm[confirm_index];
    if (to_delete.indexOf(user) == -1) {
      to_delete.push(user);
    }
    new_users.push({email:user});
  }
  console.log("users to be added: " + new_users);
  console.log("requests to be deleted: " + to_delete);
  if (new_users.length > 0) { // there are users to add
    Users.create(new_users, function(err, updated) {
      if (err) {
        render_error_page(req, res, "Error in updating users", err);
        // note we won't do the deletes if we hit an error...
      } else {
        console.log("Update action " + updated + " completed.");
        delete_requests(req, res, to_delete);
      }
    });
  } else {
    delete_requests(req, res, to_delete);
  }
}

// Delete user requests that have been serviced, or have been explicitly marked
// for deletion.  We will not have to worry about synchronization, because we
// are displaying the user page, not the requests page after this, giving plenty of time
// to finish up

function delete_requests(req, res, requests_to_delete) {
  // there is probably a better way to do this, but this is safe...revisit
  // when I learn mongoose a little better
  for(var i in requests_to_delete) {
    var userid = requests_to_delete[i];
    UserRequests.remove({email:userid}, function(err) {
      console.log("Error in deleting request for userid " + userid + ": " + err);
    });
  }
  // Just render the admin console again
  res.render('admin_console', {user:req.session.user});
}


// A utility function that gets slice data, and passes it to next_function.
// next_function is a function with signature
// next_function(req, res, error, slices)

function get_slicelet_data(req, res, next_function) {
    var spawn = require('child_process').spawn;
    var cmd = spawn('/home/service_instageni/find-slicelets.plcsh', []);
    var error = "";
    var result = "";
    var slices = [];
    cmd.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
        result = result + data;
        slices = JSON.parse(data)
    });
    cmd.stderr.on('data', function (data) {
        console.log('Error in find-slicelets: ' + data);
        error = error + data;
    });
    cmd.on('close', function (code) {
        console.log('child process exited with code ' + code);
        next_function(req, res, error, slices);
    });
}
         

app.get('/users', function(req, res) {
  if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
    res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
  } else {
    render_users(req, res);
  }
});

function update_all_users(req, res, admins_from_form) {
  var admins = ensure_items_in_a_list(admins_from_form);
  Users.find({}, function(err, users) {
    if(err) {
      console.log("Error in finding user in update_all_users: " + err);
      return;
    }
    // have to do two passes to force the updates to happen before we show the
    // user page -- which me must to have the updates reflected in the user page.
    // loop 1: count the number of updates
    var do_update = []; // array of indices to update;
    for (var i in users) {
      var userid = users[i].email;
      var is_admin = admins.indexOf(userid) != -1;
      if (is_admin != users[i].admin) do_update.push({userid:userid, new_admin_value:is_admin}); // note that we will have to update i
    }
    updates_done = 0;
    // Tricky.  These updates happen asyncrhonously due to the callback architecture of node, so
    // we have to keep track of what's been done and only display after the LAST update has been done.
    for(var i in do_update) {
      var userid = do_update[i].userid;
      var admin_value = do_update[i].new_admin_value;
      Users.update({email:userid}, {$set:{admin:admin_value}}, {multi:false}, function(err, numAffected) {
        var updating_string = "updating admin bit for " + userid + " to " + admin_value;
        if(err) {
          console.log("Error in " + updating_string + ": " + err);
        } else {
          console.log("Success in " + updating_string);
        }
        ++updates_done;
        // This is thread-safe.  The invariant we want to maintain is that updates_done == do_updates.length
        // exactly ONCE, independent of thread-interleaving.  No matter how the threads are interleaved in a
        // multi-threaded execution environment, each update will increment updates_done by exactly one, and so
        // after the last increment to updates_done updates_done == do_updates.length.  Moreover, the last test
        // will follow the last update.  The worst that will happen is that we'll get an extra render...
        if (updates_done == do_update.length) {
          render_users(req, res);
        }
      });
    }
  });
}

app.post('/update_users', function(req, res) {
  var admins = req.body.admin;
  console.log("Updating users, admins = " + JSON.stringify(admins));
  update_all_users(req, res, admins);
});

app.get('/slices', function(req, res) {
  if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
    res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
  } else {
    console.log("Getting all slices " + req.session.slicename)
    get_slicelet_data(req, res, function(req, res, error, slices) {
      if (error) {
        render_error_page(req, res, "Error in renewing slicelet " + req.session.slicename, error);
      } else {
        for (var i = 0; i < slices.length; i++) {
          slices[i].expiry_date = new Date(slices[i].expiry_date*1000).toString()
        }
        console.log(slices);
        res.render('slices', {slices:slices, title:'Slice List'});
      }  
    });
  }
});

// make sure a username looks like a valid email address...
// check the obvious things...is it null?  is the length 0?
// does it look like foobar@domain.tld?  All we check is to make
// sure that there's something before the first @, the . follows
// the @, and there are at least two characters after the .
function validate_username(username) {
  if (username == null) return false;
  if (username.length == 0) return false;
  // parse to make sure it looks like a valid email address
  // swiped this code from W3 schools...
  var atpos=username.indexOf("@");
  var dotpos=username.lastIndexOf(".");
  if (atpos<1 || dotpos<atpos+2 || dotpos+2>=username.length) {
    return false;
  }
  return true;
}


// Add a user.  Nesting is way to deep here, but that is an artifact of the callback/continuation architecture
// of node.js...I should refactor and clean this up.
app.get('/add_user', function(req, res) {
  if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
    res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
  } else {
    // user name is a parameter to the call
    var query = url.parse(req.url, true).query;
    var username = query.user;
    if (!validate_username(username)) {
      res.send("Invalid username " + username + " sent to add_user")
    } else {
      // Look for the user in the db.  If he's already there, send an error.  If
      // he's not, add him
      Users.find({ email: username }, function(err, users) {
        if(err) {
          res.send("Error in looking up " + username + ": "+ err);
        } else {
          if (users.length == 0) { // go ahead and add the new user
            Users.create({email:username}, function (err, new_user) {
              if (err) {
                res.send("Error adding " + username + ": " + err);
              } else {
                // Added the user.  Now show the users page
                render_users(req, res);
              }
            });
          } else {
            res.send("user " + username + " already in database: " + JSON.stringify(users));
          }
        }
      });
    }
  }
});

// dump the logfile

app.get('/dump_logfile', function(req, res) {
  if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
    res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
  } else {
    res.sendfile('gee_console.log');
  }
  
});

// dump the error logs
// dump the logfile

app.get('/dump_error_logs', function(req, res) {
  if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
    res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
  } else {
    res.sendfile('gee_console_error.log');
  }
});



// Just a test to see if the bug report functionality works

app.get('/test_bug_report', function(req, res) {
  render_error_page(req, res, "Bug Report Test", "This is a test of bug reporting functionality");
});

// A test to walk us through the add_user_request pipeline
// Don't forget to delete users through mongo when done
app.get('/test_user_add', function(req, res) {
  res.render('unauthorized_user', {user:'foo@bar.com', title:'Unauthorized User'});
});