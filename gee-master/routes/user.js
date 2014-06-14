// Routes related to users

module.exports = function(app,utils,Users,UserRequests,urls, script_dir) {
	console.log("In route/users.js, script dir is: " + script_dir)
	// Successful login page.
	app.get('/user', function(req, res) {
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
				utils.render_error_page(req, res, message, message);
			} else if (users.length == 0) {
				res.render('unauthorized_user', {user:req.session.user, title:'Unauthorized User'});
			} else {
				// he's a valid user.  If he doesn't have a slice, send him to a page where
				// he can allocate a slicelet.  If he does have a slice, initialize the slicename
				// session variable with the name and send him to his dashboard.
				// Also note whether he is admin
				req.session.admin = users[0].admin;
				if (!script_dir) {
					console.log("In /user, script_dir is undefined!" );
				}
				utils.get_user_dashboard(req, res, urls, script_dir);
			}
		});
	});
	
	// repeat this code, basically, but for the demo, where we aren't authenticating.
	// the only difference here is that our internal demo page put the userid in
	// req.session.user already
	app.get('/demo_user', function(req, res) {
		console.log('Demo user is ' + JSON.stringify(req.session.user));
		Users.find({ email: req.session.user }, function(err, users) {
			if (err) {
				var message = "Error in authorized user lookup for " + req.session.user;
				utils.render_error_page(req, res, message, message);
			} else if (users.length == 0) {
				res.render('unauthorized_user', {user:req.session.user, title:'Unauthorized User'});
				// clear the userid so he can log in again
				req.session.user = null;
			} else {
				// he's a valid user.  If he doesn't have a slice, send him to a page where
				// he can allocate a slicelet.  If he does have a slice, initialize the slicename
				// session variable with the name and send him to his dashboard.
				// Also note whether he is admin
				req.session.admin = users[0].admin;
				if (!script_dir) {
					console.log("In /user, script_dir is undefined!" );
				}
				utils.get_user_dashboard(req, res, urls, script_dir);
			}
		});
	});
	
	// Put in an add-user request.  We're replacing an email here
	app.post('/user/request', function(req, res) {
		// shouldn't happen, but there are weird timing things...
		Users.find({email:req.body.email}, function(err, users) {
			// we will log any error, but aside from that do nothing -- this was just a sanity check
			if (err) {
				console.log("Error " + err + " in sanity-check lookup of user " + req.body.email + " (which was not expected to succeed)");
			} else if (users.length > 0) {
				console.log("user " + req.body.email + " requested a login but already has an account!");
				req.session.user = req.body.email;
				utils.get_user_dashboard(req, res,urls, script_dir);  // should this be utils.get_user_dashboard?
				// Add the user to the user_requests table and show a results page
				UserRequests.create( { email: req.body.email, name: req.body.name, comments: req.body.comments}, function(err, addition) {
					if (err) {
						console.log("Error adding user request " + JSON.stringify(req.body) + ": " + err);
						utils.render_error_page(req, res, "Error adding user request " + err, JSON.stringify(req.body));
					} else {
						res.render('user_request', {email:req.body.email, name: req.body.name, title:'User Request Confirmed'});
					}
				});
			}
		});
	});
}