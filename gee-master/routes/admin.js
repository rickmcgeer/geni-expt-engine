exports.module = function(app,utils,Users) {
	
	// Utility to lookup and render the users page -- called from /users and /add_users
	var render_users = function(req, res) {
		Users.find(function(err, users) {
			if (err) return console.error(err);
			console.log(users);
			req.userlist = users;
			get_slicelet_data(req, res, function(req, res, error, slices) {
				if (error) {
					utils.render_error_page(req, res, "Error in displaying users", error);
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
	
	var render_user_requests = function(req, res) {
		UserRequests.find({}, function(err, user_requests) {
			if(err) {
				console.log("Error finding outstanding user requests: " + err);
				utils.render_error_page(req, res, "Error in displaying user requests", error);
			}
			res.render('user_requests', {"request_list": user_requests, title:'User List'});
		});
	}
	
	// Delete user requests that have been serviced, or have been explicitly marked
	// for deletion.  We will not have to worry about synchronization, because we
	// are displaying the user page, not the requests page after this, giving plenty of time
	// to finish up
	
	var delete_requests = function(req, res, requests_to_delete) {
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
	
	// Act on the user requests.  This is called by /add_requested_users, and is broken
	// out as a separate function to avoid the usual node deep nesting...
	
	var act_on_user_requests = function(req, res, confirm, to_delete) {
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
					utils.render_error_page(req, res, "Error in updating users", err);
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

	var update_all_users = function(req, res, admins_from_form) {
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
			var updates_done = 0;
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
	
	// A utility function that gets slice data, and passes it to next_function.
	// next_function is a function with signature
	// next_function(req, res, error, slices)
	
	var get_slicelet_data = function(req, res, next_function) {
		var spawn = require('child_process').spawn;
		var cmd = spawn('/home/service_instageni/find-slicelets.plcsh', []);
		var error = "";
		var result = "";
		var slices = [];
		cmd.stdout.on('data', function (data) {
			console.log('stdout: ' + data);
			result = result + data;
			slices = JSON.parse(data);
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
	
	// Administrator actions and options.  Only available
	// through the admin console
	app.get('/admin', function(req, res) {
		if (!req.session.admin) {
			res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
		} else {
			res.render('admin_console', {user:req.session.user});
		}
	});
	
	app.get('/slices', function(req, res) {
		if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
			res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
		} else {
			console.log("Getting all slices " + req.session.slicename);
			get_slicelet_data(req, res, function(req, res, error, slices) {
				if (error) {
					utils.render_error_page(req, res, "Error in renewing slicelet " + req.session.slicename, error);
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
	
	app.get('/user_requests', function(req, res) {
		if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
			res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
		} else {
			render_user_requests(req, res);
		}
	});
	
	app.get('/users', function(req, res) {
		if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
			res.render('admin_only', {user:req.session.user, title: 'Unauthorized Admin'});
		} else {
			render_users(req, res);
		}
	});
	
	// The next three functions implement acting on user requests.  This comes from
	// the form /add_requested_users on page user_requests.jade.
	// This form will give us two separate email lists: new user requests to be
	// confirmed, and requests to be deleted.  Here, we pull out the two lists
	// and call act_on_user_requests to manipulate the database.
	// I should probably factor those into things which actually just manipulate the db
	
	app.post('/add_requested_users', function(req, res) {
		var to_confirm = utils.ensure_items_in_a_list(req.body.confirm);
		var to_delete = utils.ensure_items_in_a_list(req.body.to_delete);
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

	app.post('/update_users', function(req, res) {
		var admins = req.body.admin;
		console.log("Updating users, admins = " + JSON.stringify(admins));
		update_all_users(req, res, admins);
	});

	// Add a user.  Nesting is way too deep here, but that is an artifact of the callback/continuation architecture
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
}