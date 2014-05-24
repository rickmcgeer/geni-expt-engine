// Utilities used by various routes


// A utility to render the error page, and log it...
exports.render_error_page = function(req, res, bug_subject, bug_body_comment) {
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


exports.render_slice_dashboard = function(req, res, slice_dictionary) {
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

// get the data for the user dashboard from
// the shell script find-gee-slice.plcsh  and
// render the user dashboard
// command is find_gee_slice -- -e req.session.user
exports.get_user_dashboard = function(req, res) {
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

// Admin-only access to look at the DB.  Note that the admin must be logged in first
// to access these pages

// Utility to lookup and render the users page -- called from /users and /add_users

exports.render_users = function(req, res) {
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

exports.ensure_items_in_a_list = function(input_parm) {
  var result = input_parm;
  if (result == null) return []; // no nulls
  if (typeof(result) == "string") return [result];
  return result;
}

exports.render_user_requests = function(req, res) {
  UserRequests.find({}, function(err, user_requests) {
    if(err) {
      console.log("Error finding outstanding user requests: " + err);
      render_error_page(req, res, "Error in displaying user requests", error);
    }
    res.render('user_requests', {"request_list": user_requests, title:'User List'});
  });
}

// make sure a username looks like a valid email address...
// check the obvious things...is it null?  is the length 0?
// does it look like foobar@domain.tld?  All we check is to make
// sure that there's something before the first @, the . follows
// the @, and there are at least two characters after the .
exports.validate_username = function(username) {
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