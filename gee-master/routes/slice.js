module.exports = function(app,utils,urls,url) {
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
				utils.get_user_dashboard(req, res,urls);
			} else {
				utils.render_error_page(req, res, "Slicelet Allocation Failure", error)
			}
		});
	});
	
	
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
				utils.render_error_page(req, res, "Error in freeing slicelet " + req.session.slicename, error);
			} else {
				req.session.slicename = null;
				req.session.filename = null;
				res.render('user_no_slice', {user:req.session.user, get_url:urls.get_slicelet_url, admin:req.session.admin});
			}
		});
	});
	
	//
	// Renew a slicelet.  Just calls expiry_date to set the session expiration two weeks into the
	// future, updates the slice record, then renders the dashboard.
	
	app.get('/renew_slicelet', function(req, res) {
		if(req.session.slicename == null) {
			utils.render_error_page(req, res, "req.session.slicename null in call to renew_slicelet", "");
		} else {
			console.log("Renewing slice " + req.session.slicename);
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
					utils.render_error_page(req, res, "Error in renewing slicelet " + req.session.slicename, error);
				} else {
					utils.get_user_dashboard(req, res,urls);
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
			utils.render_error_page(req, res, error_message, "");
		} else {
			console.log(req.session.filename);
			res.download(req.session.filename);
		}
	});
}