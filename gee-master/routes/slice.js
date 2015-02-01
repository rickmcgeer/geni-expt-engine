module.exports = function (app, utils, urls, url, Users, Slices, script_dir) {
    function makeTarfile(sliceName) {
	return "/home/service_instageni/slice_files/" + sliceName + ".tgz";
    }
    
    function makeExpiryDate() {
	var expiration = new Date() // gets doday
        var two_weeks = 1000 * 3600 * 24 * 7 * 2; // ms/sec * secs/hour * hours/day * days/week * 2 weeks
        expiration.setTime(expiration.getTime() + two_weeks)
        return expiration;
    }
    
    // invoke a remote command.  If the command exits with 0, invoke callBack, which should
    // be a function foo(req, res, callBackArgStruct, results), where results are the data
    // that came back from command.  On error invoke errorCallBack, which takes (req, res, error, errorCallBackStruct)
    
    var invokeCommand = function(req, res, cmdName, argList, callBack, callBackArgStruct, errorCallback, errorCallBackStruct) {
        var spawn = require('child_process').spawn;
        console.log("Invoking command " + script_dir + "/" + cmdName)
        var cmd = spawn(script_dir + '/' + cmdName, argList);
        var error = "";
        var result = "";
        var data_received = false;
        cmd.stdout.on('data', function (data) {
            console.log('stdout: ' + data);
            // result = JSON.parse(data);
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
                errorCallback(req, res, error, errorCallBackStruct)
            } else {
                callBack(req, res, callBackArgStruct, result)
            }
        });
    }
    
    app.get('/test_error', function(req, res) {
        utils.handleError(req, res, "Error handler called")
    })
    
    var setSliceStatusToError = function(req, res, sliceObject) {
        Slices.update({user:req.session.user}, {$set: {status:"Error"}}, {}, function() {return});
    }
    
    var setSliceStatusToRunning = function(req, res, sliceObject) {
        Slices.update({user:req.session.user}, {$set: {status:"Running"}}, {}, function() {return});
    }
    var deleteSliceOnError = function(req, res, errorMessage, sliceObject) {
        invokeCommand(req, res, 'delete-slice.sh', [sliceObject.name, sliceObject.tarfile], deleteSliceFromDBOnError, {}, deleteSliceFromDBOnError)
    }
    var deleteSliceFromDBOnError = function(req, res, errorMessage) {
       Slices.remove({user:req.session.user}, function(err, result) {
        /* if(err) {
            utils.handleError(req, res, "Double Error, requires administrator attention: " + errorMessage + " : " + err)
        } else {
            utils.handleError(req, res, errorMessage)
        } */
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
        // check to make sure we have a valid user.  If we do, it will be
        // in req.session.user after this call, and proceed.  If we don't,
        // show the login page
        if (!utils.checkHasUser(req, res)) {
            utils.renderLoginPage(req, res)
            return;
        }
        Slices.find({user:req.session.user}, function(err, slices) {
            if(err) {
                utils.handleError(req, res, "Error in finding slice for user " + req.session.user + ": " + err)
            } else if (slices.length == 0) {
                createSlice(req, res)
            } else {
                utils.handleError(req, res, "User " + req.session.user + "already has slice with slice file " + slices[0].tarfile)
            }
        });
    });
    
    // hack so I don't have to check for nulls in callbacks
    var doNothing = function(req, res) {
        return;
        
    }
    
    var createSlice = function(req, res) {
        Slices.nextCount(function(err, nextSliceNum) {
            if (err) {
                var message  = "Error in getting the next Slice Number: " + err
                console.log(message);
                utils.render_error_page(req, res,  message);
            } else {
                var sliceName = utils.makeSliceName(nextSliceNum)
                var tarFile = makeTarfile(sliceName)
                utils.render_in_progress(req, res, sliceName)
                Slices.create({user:req.session.user,
                              tarfile:makeTarfile(sliceName),
                              expires:makeExpiryDate(),
                              status:"Processing"
                              },
                              function(err, slice) {
                                if (err) {
                                    var message  = "Error in creating the Slice: " + sliceName + ": " + err;
                                    console.log(message)
                                    // utils.render_error_page(req, res, message)
                                } else {
                                    console.log("Slice " + sliceName + " entered for user " + req.session.user)
                                    // invokeCommand(req, res, 'create-slice.sh', [sliceName, tarFile, 'foo'], redirectToUser, {}, deleteSliceOnError, {name:sliceName, tarfile:tarFile}) // need to fix the imagename
                                    invokeCommand(req, res, 'create-slice.sh', [sliceName, tarFile, 'foo'], setSliceStatusToRunning, {}, setSliceStatusToError, {name:sliceName, tarfile:tarFile}) // need to fix the imagename
                                }
                              });
            }
        });
    }
    
    // free a slicelet.  Just deletes the slicelet from the db
    app.get('/slice/free', function (req, res) {
        console.log(req.url);
        // check to make sure we have a valid user.  If we do, it will be
        // in req.session.user after this call, and proceed.  If we don't,
        // show the login page
        if (!utils.checkHasUser(req, res)) {
            utils.renderLoginPage(req, res)
            return;
        }
        Slices.find({user:req.session.user}, function(err, slices) {
            if(err) {
                utils.handleError(req, res, "Error in finding slice for user " + req.session.user + ": " + err)
            } else if (slices.length == 0) {
                utils.handleError(req, res, "No slices found for user " + req.session.user)
            } else {
                var slice = slices[0]
                if (slice.status == "Processing") {
                    res.render('user_delete_in_progress', {
                        user: req.session.user,
                        slice: sliceName
                    });
                    return;
                }
                var sliceName = utils.makeSliceName(slices[0].sliceNum)
                var tarfile = slices[0].tarfile;
                Slices.remove({user:req.session.user}, function(err) {
                    if(err) {
                        utils.handleError(req, res, "Error removing slice for user " + req.session.user + " from the database: " + err)
                    } else {
                        res.redirect('/user')
                        invokeCommand(req, res, 'delete-slice.sh', [sliceName, tarfile], doNothing, {}, utils.handleError)
                    }
                })
            }
        })
    });
    
    // A helper routine for slice expiration.  This is called after something has been done with
    // each expired slice.  We are done when the deleted and error slices are the total number of
    // expired slices
    
    var checkDone = function(req, res, slices, slicesDeleted, sliceErrors) {
        if (slices.length == slicesDeleted.length + sliceErrors.length) {
            res.end(JSON.stringify({deleted: slicesDeleted, errorOnDelete:sliceErrors}))
        }
    }
    
    // look for expired slices and delete them.  returns the data in JSON, because this
    // will typically be invoked by a curl script
    
    app.get('/slice/expire', function(req, res) {
        var date = new Date() // today
        Slices.find({expires: {$lt:date}}, function(err, slices) {
            if (err) {
                res.json("Error in find expiring slices: " + err)
            } else if (slices.length == 0) {
                res.json("No expiring slices")
            } else {
                slicesDeleted = [];
                sliceErrors = [];
                slices.forEach(function(aSlice) {
                    invokeCommand(req, res, 'delete-slice.sh', [utils.makeSliceName(aSlice.sliceNum)],
                                  function(req, res, results) {
                                    Slices.remove({sliceNum: aSlice.sliceNum}, function(err) {
                                        if (err) {
                                            sliceErrors.push({slice:aSlice.sliceNum, error:err})
                                        } else {
                                            slicesDeleted.push(aSlice.sliceNum)
                                        }
                                        checkDone(req, res, slices, slicesDeleted, sliceErrors)
                                    })
                                  }, {},
                                  function(req, res, error) {
                                    sliceErrors.push({slice:aSlice.sliceNum, error:err})
                                    checkDone(req, res, slices, slicesDeleted, sliceErrors)
                                  }, {})
                    
                })
            }
        });
        
    })
    //
    // Renew a slicelet.  Just calls makeExpiryDate to set the session expiration two weeks into the
    // future, updates the slice record, then renders the dashboard.
    app.get('/slice/renew', function (req, res) {
        // check to make sure we have a valid user.  If we do, it will be
        // in req.session.user after this call, and proceed.  If we don't,
        // show the login page
        if (!utils.checkHasUser(req, res)) {
            utils.renderLoginPage(req, res)
            return;
        }
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
        // check to make sure we have a valid user.  If we do, it will be
        // in req.session.user after this call, and proceed.  If we don't,
        // show the login page
        if (!utils.checkHasUser(req, res)) {
            utils.renderLoginPage(req, res)
            return;
        }
        if (req.session.filename == null) {
            var error_message = "No filename set on call to /download ";
            utils.render_error_page(req, res, error_message, "");
        } else {
            console.log(req.session.filename);
            res.download(req.session.filename);
        }
    });
}
