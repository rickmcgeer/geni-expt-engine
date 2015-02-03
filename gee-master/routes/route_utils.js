// Utilities used by various routes
// A utility to render the error page, and log it...
exports.render_error_page = function (req, res, bug_subject, bug_body_comment) {
    var date = Date();
    //var session_data = JSON.stringify(req.session);
    var bug_report = JSON.stringify({
        date: date,
        session: req.session,
        note: bug_body_comment
    });
    console.log("Error Page Rendered, subject " + bug_subject + ". Report: " + bug_report);
    res.render('error_page', {
        bugreport: bug_subject,
        bugreport_body: bug_report,
        title: 'Error'
    });
}
// A utility that checks to see if we have a valid user name; if we do, return true and
// make sure req.session.user has the user name.  If not, return false
exports.checkHasUser = function(req, res) {
    if (req.session.user) {
        return true;
    }
    // otherwise it might be in req.session.passport.user.emails[0].value
    if (req.session.passport && req.session.passport.user && req.session.passport.user.emails && req.session.passport.user.emails.length > 0 && req.session.passport.user.emails[0].value) {
        req.session.user = req.session.passport.user.emails[0].value
        return true;
    }
    return false;
}
// Render the login page
exports.renderLoginPage = function(req, res) {
    res.render('main', {
        title: 'Welcome to GEE'
    });
}
// A utility to make a slice name from a number
exports.makeSliceName = function(aNumber) {
    return "slice" + aNumber;
}
// A utility function called from logged_in, get_slicelet, renew_slicelet, download_slicelet...
// Render the page with the user's slice information
// This is only called when req.session.slice_data.slice != null
// all of the slice information is in slice_dictionary, and is of the form
// {"slice": <slicename>", "slicelet_file": <filename>, "user": "<username>, "has_slicelet": true}
exports.render_slice_dashboard = function (req, res, slice_dictionary) {
    var colors = {Running: 'Green', Processing: 'Orange', 'Error':'Red'};
    
    var page_dictionary = {
        slice: exports.makeSliceName(slice_dictionary.sliceNum),
        user: req.session.user,
        admin: req.session.admin,
        date: slice_dictionary.expires,
        status: slice_dictionary.status,
        color:colors[slice_dictionary.status]
    };
    res.render('user_with_slice', page_dictionary);
}

// get the data for the user dashboard from
// the shell script find-gee-slice.plcsh  and
// render the user dashboard
// command is 
exports.get_user_dashboard = function (req, res, urls, Slices) {
    Slices.find({user:req.session.user},
	function(err, slices) {
	    if(err) {
		var message = "Error in  slice lookup for " + req.session.user;
		utils.render_error_page(req, res, message, message);
	    } else if (slices.length > 0) {
		req.session.slice_data = slices[0];
		req.session.filename = req.session.slice_data.tarfile;
		exports.render_slice_dashboard(req, res, req.session.slice_data)
	    } else {
		res.render('user_no_slice', {
                    user: req.session.user,
                    get_url: urls.get_slicelet_url,
                    admin: req.session.admin
		});
	    }
	});
}

exports.render_in_progress = function(req, res, sliceName) {
    res.render('user_in_progress', {
        user: req.session.user,
        slice: sliceName
    });
}
// A little utility because HTML forms return a string when only a single item is
// checked in a list of checkboxes, but a list if more than one is checked.  This does awful things
// unless you regularize it...
exports.ensure_items_in_a_list = function (input_parm) {
    var result = input_parm;
    if (result == null) return []; // no nulls
    if (typeof (result) == "string") return [result];
    return result;
}

exports.handleError = function(req, res, message) {
    console.log(message);
    exports.render_error_page(req, res, message)
}


// make sure a username looks like a valid email address...
// check the obvious things...is it null?  is the length 0?
// does it look like foobar@domain.tld?  All we check is to make
// sure that there's something before the first @, the . follows
// the @, and there are at least two characters after the .
exports.validate_username = function (username) {
    if (username == null) return false;
    if (username.length == 0) return false;
    // parse to make sure it looks like a valid email address
    // swiped this code from W3 schools...
    var atpos = username.indexOf("@");
    var dotpos = username.lastIndexOf(".");
    if (atpos < 1 || dotpos < atpos + 2 || dotpos + 2 >= username.length) {
        return false;
    }
    return true;
}