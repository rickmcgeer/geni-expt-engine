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
    
    // invoke a remote command.  If the command exits with 0, invoke callBack, which should
    // be a function foo(req, res, callBackArgStruct, results), where results are the data
    // that came back from command.  On error invoke errorCallBack, which takes (req, res, error)
    
    var invokeCommand = function(req, res, cmdName, argList, callBack, callBackArgStruct, errorCallback) {
        var spawn = require('child_process').spawn;
        var cmd = spawn(script_dir + '/' + cmdName, argList);
        var error = "";
        var result = "";
        var data_received = false;
        cmd.stdout.on('data', function (data) {
            // console.log('stdout: ' + data);
            result = JSON.parse(data);
            data_received = true;
        });
        // when data is received on stderr, we have a problem and log it.  Should do something more
        // intelligent on exit...
        cmd.stderr.on('data', function (data) {
            console.log('Error in ' + cmdName +': ' + data);
            error = error + data;
        });
        // when the command finishes, either handle the error or do the callback
        cmd.on('close', function (code) {
            console.log('child process exited with code ' + code);
            if(code > 0) {
                errorCallback(req, res, "Error in subprocess " + cmdName + " " + argList + ": " + error)
            } else {
                callBack(req, res, callBackArgStruct, result)
            }
        });
    }
    
    var deleteSliceFromDBOnError = function(req, res, errorMessage) {
       Slices.remove({user:req.session.user}, function(err, result) {
        if(err) {
            utils.handleError(req, res, "Double Error, requires administrator attention: " + errorMessage + " : " + err)
        } else {
            utils.handleError(req, res, errorMessage)
        }
       })
    }
    var redirectToUser = function(req, res) {
        res.redirect('/user')
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
                var tarFile = makeTarfile(sliceName)
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
                                    console.log("Slice " + sliceName + " entered for user " + req.session.user)
                                    invokeCommand(req, res, 'createSlice.sh', [sliceName, tarFile, 'foo'], redirectToUser, {}, deleteSliceFromDBOnError) // need to fix the imagename
                                }
                              });
            }
        });
    });
    
    // free a slicelet.  Just deletes the slicelet from the db
    app.get('/slice/free', function (req, res) {
        console.log(req.url);
        Slices.find({user:req.session.user}, function(err, slices) {
            if(err) {
                utils.handleError("Error in finding slice for user " + req.session.user + ": " + err)
            } else if (slices.length == 0) {
                utils.handleError("No slices found for user " + req.session.user)
            } else {
                var sliceName = utils.makeSliceName(slices[0].sliceNum)
                var tarfile = slices[0].tarfile;
                Slices.remove({user:req.session.user}, function(err) {
                    if(err) {
                        utils.handleError("Error removing slice for user " + req.session.user + " from the database: " + err)
                    } else {
                        invokeCommand(req, res, 'deleteSlice.sh', [sliceName, tarfile], redirectToUser, {}, utils.handleError)
                    }
                })
            }
        })
    });
    //
    // Renew a slicelet.  Just calls makeExpiryDate to set the session expiration two weeks into the
    // future, updates the slice record, then renders the dashboard.
    app.get('/slice/renew', function (req, res) {
        Slices.findOne({user:req.session.user}, function(err, doc) {
            if (err) {
                var message = "Error renewing slice for user " + req.session.user + ": " + err
                console.log(message)
                utils.render_error_page(req, res, message)        
            } else {
                doc.expires = makeExpiryDate();
                doc.save(function(err, slice, numberAffected) {
                    if (err ) {
                        var message = "Error renewing slice for user " + req.session.user + ": " + err
                        console.log(message)
                        utils.render_error_page(req, res, message)
                    } else {
                        console.log("Slice for user " + req.session.user + " renewed ")
                        res.redirect('/user')
                    }
                });
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