var url = require('url')
module.exports = function (app, utils, urls, url, DB, cript_dir) {
    function makeTarfile(sliceName) {
	return "/root/slice_files/" + sliceName + ".tgz";
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
        DB.slices.update({user:req.session.user}, {$set: {status:"Error"}}, {}, function() {return});
    }

    var setSliceStatusToRunning = function(req, res, sliceObject) {
        DB.slices.update({user:req.session.user}, {$set: {status:"Running"}}, {}, function() {return});
    }
    var deleteSliceOnError = function(req, res, errorMessage, sliceObject) {
        invokeCommand(req, res, 'delete-slice.sh', [sliceObject.name, sliceObject.tarfile], deleteSliceFromDBOnError, {}, deleteSliceFromDBOnError)
    }
    var deleteSliceFromDBOnError = function(req, res, errorMessage) {
       DB.slices.remove({user:req.session.user}, function(err, result) {
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
        DB.slices.find({user:req.session.user}, function(err, slices) {
            if(err) {
                utils.handleError(req, res, "Error in finding slice for user " + req.session.user + ": " + err)
            } else if (slices.length == 0) {
                createSlice(req, res)
            } else {
                utils.handleError(req, res, "User " + req.session.user + "already has slice with slice file " + slices[0].tarfile)
            }
        });
    });

    app.get('/slice/get_custom', function (req, res) {
      // direct the user to a page where he can fill out a form for a custom slicelet
      ports = []
      for (var i = 0; i < 5; i++) {
          ports.push({host:-1, container:-1})
      }
      res.render('slice_request.jade', {
        user:req.session.user,
        imageName: 'geeproject/phusion-baseimage',
        ports: ports,
        callback:'/slice/create_custom_request',
        params: {}
      })
    });

    app.post('/slice/create_custom_request', function (req, res) {
      // console.log(req.body.imageName);
      // console.log(req.body.ports);
      // res.redirect('/user')
      // check to make sure we have a valid user.  If we do, it will be
      // in req.session.user after this call, and proceed.  If we don't,
      // show the login page
      if (!utils.checkHasUser(req, res)) {
          utils.renderLoginPage(req, res)
          return;
      }
      DB.slices.find({user:req.session.user}, function(err, slices) {
          if(err) {
              utils.handleError(req, res, "Error in finding slice for user " + req.session.user + ": " + err)
          } else if (slices.length == 0) {
              createCustomSliceRequest(req, res)
          } else {
              utils.handleError(req, res, "User " + req.session.user + "already has slice with slice file " + slices[0].tarfile)
          }
      });
    });

    // hack so I don't have to check for nulls in callbacks
    var doNothing = function(req, res) {
        return;

    }

    // Atomic function to put a Slice in a database.  This should only be
    // called from one of primitiveCreateCustomSliceRequest or
    // primitiveCreateSliceRequest; it is only intended to be called
    // AFTER the relevant request has been created, and is designed as a
    // callback

    var primitiveCreateSlice = function(req, res, sliceName, tarFile, imageName, status) {
        DB.slices.create({
            user: req.session.user,
            tarfile: tarFile,
            imageName: imageName,
            sliceName: sliceName,
            status: status,
            expires: makeExpiryDate()
        }, function(err, slice) {
            if (err) {
                var message  = "Error in creating the Slice: " + sliceName + ": " + err;
                console.log(message)
                utils.render_error_page(req, res, message)
            } else {
                console.log("Slice " + sliceName + " entered for user " + req.session.user + " with image " + imageName)
                res.redirect('/user')

            }
        })
    }

    // Atomic function to put a SliceRequest in a database.  This should only be
    // called from createSlice
    // it is only intended to be called
    // AFTER the sliceNumber  has been assigned, and is designed as a
    // callback

    var primitiveCreateSliceRequest = function(req, res, sliceNum, imageName) {
        var sliceName = utils.makeSliceName(sliceNum)
        var tarFile = makeTarfile(sliceName)
        // utils.render_in_progress(req, res, sliceName)
        DB.sliceRequests.create({
            action:'create',
            user:req.session.user,
            sliceName:sliceName,
            imageName: imageName
        },
        function(err, slice) {
            if (err) {
                var message  = "Error in creating the Slice: " + sliceName + ": " + err;
                console.log(message)
                utils.render_error_page(req, res, message)
            } else {
                primitiveCreateSlice(req, res, sliceName, tarFile, imageName, 'Processing')
            }
        })
    }

    // Atomic function to put a customSliceRequest in a database.  This should only be
    // called from one of createCustomSliceRequest; it is only intended to be called
    // AFTER the sliceNumber  has been assigned, and is designed as a
    // callback

    var primitiveCreateCustomSliceRequest = function(req, res, sliceNum, imageName, ports) {
        var sliceName = utils.makeSliceName(sliceNum)
        var tarFile = makeTarfile(sliceName)
        // utils.render_in_progress(req, res, sliceName)
        DB.customSliceRequests.create({
            user:req.session.user,
            sliceName:sliceName,
            imageName: imageName,
            ports: ports
        },
        function(err, slice) {
            if (err) {
                var message  = "Error in creating the Slice: " + sliceName + ": " + err;
                console.log(message)
                utils.render_error_page(req, res, message)
            } else {
                primitiveCreateSlice(req, res, sliceName, tarFile, imageName, 'Pending Approval')
            }
        })
    }

    var createCustomSliceRequest = function(req, res) {
        var ports = JSON.parse(req.body.ports)
        var imageName = req.body.imageName
        DB.slices.nextCount(function(err, nextSliceNum) {
            if (err) {
                var message  = "Error in getting the next Slice Number: " + err
                console.log(message);
                utils.render_error_page(req, res,  message);
            } else {
                primitiveCreateCustomSliceRequest(req, res, nextSliceNum, imageName, ports)
            }
        });
    }

    var createSlice = function(req, res) {
        var queryData = url.parse(req.url, true).query;
        var imageName = queryData.image;
        DB.slices.nextCount(function(err, nextSliceNum) {
            if (err) {
                var message  = "Error in getting the next Slice Number: " + err
                console.log(message);
                utils.render_error_page(req, res,  message);
            } else {
                primitiveCreateSliceRequest(req, res, nextSliceNum, imageName)
            }
        });
    }

    // delete a slice whose state is Processing.  It's already removed from the slice
    // table, so remove it from the slice_requests table
    var deleteSliceAwaitingCreation = function(req, res, slice) {
        DB.sliceRequests.remove({action:'create', sliceName:slice.sliceName}, function(err) {
            if(err) {
                utils.handleError(req, res, "Error removing slice  " + slice.sliceName + " from the create-slice-request queue: " + err)

            } else {
                res.redirect('/user')
            }
        })
    }

    // delete a slice whose state is Pending Approval.  It's already removed from the slice
    // table, so remove it from the custom_slice_requests table
    var deletePendingSlice = function(req, res, slice) {
        DB.customSliceRequests.remove({sliceName:slice.sliceName}, function(err) {
            if(err) {
                utils.handleError(req, res, "Error removing slice  " + slice.sliceName + " from the custom-slice-approval table: " + err)

            } else {
                res.redirect('/user')
            }
        })
    }
    // delete a slice whose state is Running.  It's already removed from the slice
    // table, so simply add the delete action to the slice_requests queue
    var deleteRunningSlice = function(req, res, slice) {
        DB.sliceRequests.create({
            action: 'delete',
            sliceName: slice.sliceName
        },
        function(err) {
            if(err) {
                utils.handleError(req, res, "Error creating slice remove request for user " + req.session.user + ": " + err)
            } else {
                res.redirect('/user')
            }
        });
    }

    // delete a slice.  This is a rewrite, because the code is fairly tricky.
    // A slice can be in one of three states:
    // 1. Pending Approval.  Delete the slice from the custom_slice_request and
    //    slices table
    // 2. Processing.  The slice has not yet been created.  Remove the create-slice
    //    request from the slice request queue, and delete from the slices table
    // 3. Running.  Delete from the slices table, and add a delete-slice request
    //    to the slice request queue
    // Note that in all three cases we need to delete the slice from the slices
    // collection, so do that first and then call the appropriate routine to
    // do the second db action
    var deleteSlice = function(req, res, slice) {
        DB.slices.remove({sliceName: slice.sliceName}, function(err) {
            if(err) {
                utils.handleError(req, res, "Error removing slice  " + slice.sliceName + " from the database: " + err)
            } else {
                if (slice.status == 'Pending Approval') {
                    deletePendingSlice(req, res, slice)
                } else if (slice.status == 'Processing') {
                    deleteSliceAwaitingCreation(req, res, slice)
                } else {
                    deleteRunningSlice(req, res, slice)
                }
            }
        })
    }
    // A utility for both /slice/free and /slice/delete.  Checks to see if
    // we actually found a slice or got an error, and if an error handle it
    // and if not delete the slice

    var handleErrorOrDeleteFirstSlice = function (req, res, err, specString, slices) {
        if(err) {
            utils.handleError(req, res, "Error in finding slice for " + specString + ": " + err)
        } else if (slices.length == 0) {
            utils.handleError(req, res, "No slices found for  " + specString)
        } else {
            var slice = slices[0]
            deleteSlice(req, res, slice)
        }
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
        DB.slices.find({user:req.session.user}, function(err, slices) {
            handleErrorOrDeleteFirstSlice(req, res, err, "user " + req.session.user, slices)
        })
    });

    // delete a slice by the administrator.  This differs from /slice/free since the slice name is
    // given in the body of the query

    app.get('/slice/delete', function(req, res) {
        var query = url.parse(req.url, true).query;
        if (!query.sliceName) {
            utils.handleError(req, res, "sliceName not specified for /slice/delete")
        } else {
            var sliceName = query.sliceName
            DB.slices.find({sliceName:sliceName}, function(err, slices) {
                handleErrorOrDeleteFirstSlice(req, res, err, "sliceName " + sliceName, slices)
            })
        }
    })

    // A helper routine for slice expiration.  This is called after something has been done with
    // each expired slice.  We are done when the deleted and error slices are the total number of
    // expired slices

    var checkDone = function(req, res, slices, slicesDeleted, sliceErrors) {
        if (slices.length == slicesDeleted.length + sliceErrors.length) {
            res.end(JSON.stringify({deleted: slicesDeleted, errorOnDelete:sliceErrors}))
        }
    }


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
        DB.slices.findOne({user:req.session.user}, function(err, doc) {
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
