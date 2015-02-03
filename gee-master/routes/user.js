// Routes related to users
module.exports = function (app, utils, Users, Slices, urls) {
    // Successful login page.
    app.get('/user', function (req, res) {
        console.log(JSON.stringify(req.session));
        // check to make sure we have a valid user.  If we do, it will be
        // in req.session.user after this call, and proceed.  If we don't,
        // show the login page
        if (!utils.checkHasUser(req, res)) {
            utils.renderLoginPage(req, res)
            return;
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
                        utils.get_user_dashboard(req, res, urls, Slices);
                    }
                });
            } else {
                // he's a valid user.  If he doesn't have a slice, send him to a page where
                // he can allocate a slicelet.  If he does have a slice, initialize the slicename
                // session variable with the name and send him to his dashboard.
                // Also note whether he is admin
                req.session.admin = users[0].admin;
                utils.get_user_dashboard(req, res, urls, Slices);
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
                       
                        utils.get_user_dashboard(req, res, urls, Slices);

                    }
                });
            } else {
                // he's a valid user.  If he doesn't have a slice, send him to a page where
                // he can allocate a slicelet.  If he does have a slice, initialize the slicename
                // session variable with the name and send him to his dashboard.
                // Also note whether he is admin
                req.session.admin = users[0].admin;
            
                utils.get_user_dashboard(req, res, urls, Slices);
            }
        });
    });
}