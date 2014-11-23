// Routes related to users
module.exports = function (app, utils, Users, Slices, urls, script_dir) {
    console.log("In route/users.js, script dir is: " + script_dir)
    // Successful login page.
    app.get('/user', function (req, res) {
        console.log(JSON.stringify(req.session));
        // console.log(JSON.stringify(req.session.passport.user.emails[0].value));
        // squirrel away the userid in a session variable; this way, we don't have to pass
        // it as an argument, or use cookies.
        if (!req.session.user) {
            req.session.user = req.session.passport.user.emails[0].value;
        }
        // See if the user is in the database.  if he isn't, add him
        Users.find({
            email: req.session.user
        }, function (err, users) {
            if (err) {
                var message = "Error in authorized user lookup for " + req.session.user;
                utils.render_error_page(req, res, message, message);
            } else if (users.length == 0) {
                // res.render('unauthorized_user', {user:req.session.user, title:'Unauthorized User'});
                Users.create([{
                    email: req.session.user
                }], function (err, updated) {
                    if (err) {
                        utils.render_error_page(req, res, "Error in updating users", err);
                    } else {
                        console.log("User " + req.session.user + " added");
                        req.session.admin = false;
                        if (!script_dir) {
                            console.log("In /user, script_dir is undefined!");
                        }
                        utils.get_user_dashboard(req, res, urls, Slices, script_dir);
                    }
                });
            } else {
                // he's a valid user.  If he doesn't have a slice, send him to a page where
                // he can allocate a slicelet.  If he does have a slice, initialize the slicename
                // session variable with the name and send him to his dashboard.
                // Also note whether he is admin
                req.session.admin = users[0].admin;
                if (!script_dir) {
                    console.log("In /user, script_dir is undefined!");
                }
                utils.get_user_dashboard(req, res, urls, Slices, script_dir);
            }
        });
    });

    // repeat the code, basically, but for the demo, where we aren't authenticating.
    // the only difference here is that this is 
    // code for the demo login site.  This is a no-password site which pulls
    // users directly from the database.  User has entered an email in
    // a text box on a form, and all we have to do is make sure it's valid
    // and in the db
    app.post('/demo_login', function (req, res) {
        console.log('Demo user is ' + JSON.stringify(req.body.demo_userid));
        var demo_user = req.body.demo_userid;
        if (!demo_user || demo_user.length == 0) {
            res.render('login_failure', {
                title: 'Login Failed'
            })
            return;
        }
        req.session.user = req.body.demo_userid;
        Users.find({
            email: req.session.user
        }, function (err, users) {
            if (err) {
                var message = "Error in authorized user lookup for " + req.session.user;
                utils.render_error_page(req, res, message, message);
            } else if (users.length == 0) {
                // res.render('unauthorized_user', {user:req.session.user, title:'Unauthorized User'});
                // clear the userid so he can log in again
                // req.session.user = null;
                // we now add users automatically if they aren't in the db
                Users.create([{
                    email: req.session.user
                }], function (err, updated) {
                    if (err) {
                        utils.render_error_page(req, res, "Error in updating users", err);
                    } else {
                        console.log("User " + req.session.user + " added");
                        req.session.admin = false;
                        if (!script_dir) {
                            console.log("In /user, script_dir is undefined!");
                        }
                        utils.get_user_dashboard(req, res, urls, Slices, script_dir);

                    }
                });
            } else {
                // he's a valid user.  If he doesn't have a slice, send him to a page where
                // he can allocate a slicelet.  If he does have a slice, initialize the slicename
                // session variable with the name and send him to his dashboard.
                // Also note whether he is admin
                req.session.admin = users[0].admin;
                if (!script_dir) {
                    console.log("In /user, script_dir is undefined!");
                }
                utils.get_user_dashboard(req, res, urls, Slices, script_dir);
            }
        });
    });
}