// Main pages

module.exports = function(app) {
	// The greeting page is the login page
	
	app.get('/', function(req, res) {
		res.render('main', {title: 'Welcome to GEE'});
	});
	
	// The user clicked on "send feedback".  This will take him to a page
	// where he can send us feedback -- currently we are not displaying this
	// on the login page, so ATM the user must be logged in to send feedback
	// but no dependency, we can put this on the login page
	
	app.get('/send_feedback', function(req, res) {
		res.render('main_feedback', {title: 'Feedback'});
	});
}