// Routes related to openid auth

module.exports = function(app, passport) {
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
	app.get('/auth/openid/return', passport.authenticate('openid', { successRedirect: '/user', failureRedirect: '/login_failure' }));
	
	// Redirect here on failure.  This page will permit the user to try to login
	// again
	app.get('/login_failure', function(req, res) {
		res.render('login_failure', {title: 'Login Failed'});
	});
}