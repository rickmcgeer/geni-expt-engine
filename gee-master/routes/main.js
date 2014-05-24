// Main pages

module.exports = function(app) {
	// The greeting page is the login page
	
	app.get('/', function(req, res) {
	    res.render('login', {title: 'Welcome to GEE'});
	});
	
	// The user clicked on "send feedback".  This will take him to a page
	// where he can send us feedback -- currently we are not displaying this
	// on the login page, so ATM the user must be logged in to send feedback
	// but no dependency, we can put this on the login page
	
	app.get('/send_feedback', function(req, res) {
	  res.render('feedback', {title: 'Feedback'});
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
}