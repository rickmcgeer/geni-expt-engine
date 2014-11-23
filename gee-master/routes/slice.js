module.exports = function (app, utils, urls, url, Users, Slices, script_dir) {
    function makeTarfile(sliceName) {
	return sliceName;
    }
    
    function makeExpiryDate() {
	var expiration = new Date() // gets doday
        var two_weeks = 1000 * 3600 * 24 * 7 * 2; // ms/sec * secs/hour * hours/day * days/week * 2 weeks
        expiration.setTime(expiration.getTime() + two_weeks)
        return expiration;
    }
    
    // get the next slice number.  used only for debugging
    app.get('/slice/next', function (req, res) {
        res.end('Next slice number is ' + next_slice)
    })
    
    app.get('/slice/get', function (req, res) {
        Slices.nextCount(function(err, nextSliceNum) {
            if (err) {
                var message  = "Error in getting the next Slice Number: " + err
                console.log(message);
                utils.render_error_page(req, res,  message);
            } else {
                var sliceName = utils.makeSliceName(nextSliceNum)
                Slices.create({user:req.session.user,
                              tarfile:makeTarfile(sliceName),
                              expires:makeExpiryDate()
                              },
                              function(err, slice) {
                                if (err) {
                                    var message  = "Error in creating the Slice: " + sliceName + ": " + err;
                                    console.log(message)
                                    utils.render_error_page(req, res, message)
                                } else {
                                    console.log("Slice " + sliceName + " created for user " + req.session.user)
                                    res.redirect('/user')
                                }
                              });
            }
        });
    });
    
    // free a slicelet.  Just deletes the slicelet from the db
    app.get('/slice/free', function (req, res) {
        console.log(req.url);
        Slices.remove({user:req.session.user}, function(err) {
            if(err) {
                var message = "Error removing slice for user " + req.session.user + " from the database: " + err
                console.log(message)
                utils.render_error_page(req, res, message)
            } else {
                console.log("Slice   for user " + req.session.user + " freed ")
                res.redirect('/user')
            }
        });
    });
    //
    // Renew a slicelet.  Just calls makeExpiryDate to set the session expiration two weeks into the
    // future, updates the slice record, then renders the dashboard.
    app.get('/slice/renew', function (req, res) {
        Slices.findAndModify({user:req.session.user},[['_id', 'asc']], {$set: {expires:makeExpiryDate()}}, {}, function(err, object) {
            if (err) {
                var message = "Error renewing slice for user " + req.session.user + ": " + err
                console.log(message)
                utils.render_error_page(req, res, message)        
            } else {
                console.log("Slice for user " + req.session.user + " renewed ")
                res.redirect('/user')
            }
        });
    });

    // Callback for download.  Fortunately, this is simple, as node.js provides a
    // download primitive.  We need to error-check this better.  In particular, we
    // need to check that the file actually exists!
    app.get('/slice/download', function (req, res) {
        if (req.session.filename == null) {
            var error_message = "No filename set on call to /download ";
            utils.render_error_page(req, res, error_message, "");
        } else {
            console.log(req.session.filename);
            res.download(req.session.filename);
        }
    });
}