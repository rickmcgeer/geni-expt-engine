module.exports = function (app, utils, DB, url, script_dir) {

    // Utility to lookup and render the users page -- called from /users and /add_users
    var render_users = function (req, res) {
        DB.users.find(function (err, users) {
            if (err) return console.error(err);
            console.log(users);
            req.userlist = users;
            get_slicelet_data(req, res, function (req, res, error, slices) {
                if (error) {
                    utils.render_error_page(req, res, "Error in displaying users", error);
                } else {
                    var user_list = [];
                    var slice_dictionary = {}
                    slices.forEach(function(aSliceEntry) {
                        var userName = aSliceEntry.allocated;
                        slice_dictionary[userName] = aSliceEntry.name;
                    });

                    for (var index in req.userlist) {
                        var user = req.userlist[index];
                        user_list.push({
                            email: user['email'],
                            admin: user['admin'],
                            slice: slice_dictionary[user['email']]
                        });
                    }

                    res.render('admin_users', {
                        "userlist": user_list,
                        title: 'User List'
                    });
                }
            });
        });
    }

    var render_user_requests = function (req, res) {
        UserRequests.find({}, function (err, user_requests) {
            if (err) {
                console.log("Error finding outstanding user requests: " + err);
                utils.render_error_page(req, res, "Error in displaying user requests", error);
            }
            res.render('admin_user_requests', {
                "request_list": user_requests,
                title: 'User List'
            });
        });
    }

    // Delete user requests that have been serviced, or have been explicitly marked
    // for deletion.  We will not have to worry about synchronization, because we
    // are displaying the user page, not the requests page after this, giving plenty of time
    // to finish up
    var delete_requests = function (req, res, requests_to_delete) {
        // there is probably a better way to do this, but this is safe...revisit
        // when I learn mongoose a little better
        for (var i in requests_to_delete) {
            var userid = requests_to_delete[i];
            UserRequests.remove({
                email: userid
            }, function (err) {
                console.log("Error in deleting request for userid " + userid + ": " + err);
            });
        }
        // Just render the admin console again
        res.render('admin', {
            user: req.session.user
        });
    }

    // Act on the user requests.  This is called by /add_requested_users, and is broken
    // out as a separate function to avoid the usual node deep nesting...
    var act_on_user_requests = function (req, res, confirm, to_delete) {
        // first, make sure that we are going to delete all the records we
        // are confirming.  Also prepare the array for the batch add to DB.users.
        var new_users = [];
        // Should I check if this user is already in the DB?  That would be a pain, due
        // to the asynch nature of find...
        for (var confirm_index in confirm) {
            var user = confirm[confirm_index];
            if (to_delete.indexOf(user) == -1) {
                to_delete.push(user);
            }
            new_users.push({
                email: user
            });
        }
        console.log("users to be added: " + new_users);
        console.log("requests to be deleted: " + to_delete);
        if (new_users.length > 0) { // there are users to add
            DB.users.create(new_users, function (err, updated) {
                if (err) {
                    utils.render_error_page(req, res, "Error in updating users", err);
                    // note we won't do the deletes if we hit an error...
                } else {
                    console.log("Update action " + updated + " completed.");
                    delete_requests(req, res, to_delete);
                }
            });
        } else {
            delete_requests(req, res, to_delete);
        }
    }

    var setDeletedAdmins = function(req, res, deletedAdmins) {
        if (deletedAdmins.length > 0) {
            Users.update({email: {$in: deletedAdmins}}, {$set:{admin:false}}, {multi:true}, function (err, numAffected, raw) {
                if(err) {
                    utils.handleError(req, res, "Error in update_all_users: " + err)
                } else {
                    render_users(req, res);
                }
            });
        } else {
            render_users(req, res);
        }
    }

    var setNewAndDeletedAdmins = function(req, res, newAdmins, deletedAdmins) {
        if (newAdmins.length > 0) {
            DB.users.update({email: {$in: newAdmins}}, {$set:{admin:true}}, {multi:true}, function (err, numAffected, raw) {
                if(err) {
                    utils.handleError(req, res, "Error in update_all_users: " + err)
                } else {
                    setDeletedAdmins(req, res, deletedAdmins)
                }
            });
        } else {
            setDeletedAdmins(req, res, deletedAdmins)
        }
    }

    var update_all_users = function (req, res, admins_from_form) {
        var admins = utils.ensure_items_in_a_list(admins_from_form)
        DB.users.find({}, function(err, users) {
            if(err) {
                utils.handleError(req, res, "Error in update_all_users: " + err)
            } else {
                var newAdmins = [];
                var deletedAdmins = [];
                users.forEach(function(aUserRecord) {
                    var adminBitSet = admins.indexOf(aUserRecord.email) >= 0;
                    if (adminBitSet && !aUserRecord.admin) newAdmins.push(aUserRecord.email)
                    if (aUserRecord.admin && !adminBitSet) deletedAdmins.push(aUserRecord.email)
                });
                setNewAndDeletedAdmins(req, res, newAdmins, deletedAdmins);
            }
        })
    }

    // A utility function that gets slice data, and passes it to next_function.
    // next_function is a function with signature
    // next_function(req, res, error, slices)
    var get_slicelet_data = function (req, res, next_function) {
        DB.slices.find({}, function(err, allSlices) {
            if (allSlices && allSlices.length > 0) {
                var sliceDictionary = allSlices.map(function(aSliceEntry) {
                    var portString = aSliceEntry.ports.map(function(aPortSpec) {
                        return aPortSpec.container + '->' + aPortSpec.host
                    }).join(', ')
                    return {name:utils.makeSliceName(aSliceEntry.sliceNum),
                        allocated:aSliceEntry.user,
                        file:aSliceEntry.tarfile,
                        expiry_date:aSliceEntry.expires,
                        status: aSliceEntry.status,
                        ports:portString
                    }
                })
                next_function(req, res, err, sliceDictionary)
            } else {
                next_function(req, res, err, [])
            }
        });
    }

    // A utility function that gets nodes data, and passes it to next_function.
    // next_function is a function with signature
    // next_function(req, res, error, nodes)
    var get_nodes = function (req, res, next_function) {
        DB.nodes.find({}, function(err, nodes) {
            if (nodes && nodes.length > 0) {
                next_function(req, res, err, nodes)
            } else {
                next_function(req, res, err, [])
            }
        });
    }


    // Administrator actions and options.  Only available
    // through the admin console
    app.get('/admin', function (req, res) {
        if (!req.session.admin) {
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
        } else {
            res.render('admin', {
                user: req.session.user
            });
        }
    });

    app.get('/admin/nodes', function (req, res) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
        } else {
            console.log("Getting all slices")
            get_nodes(req, res, function (req, res, error, nodes) {
                if (error) {
                    utils.render_error_page(req, res, "Error in getting node data", error);
                } else {
                    console.log(slices);
                    res.render('admin_nodes', {
                        nodes: nodes,
                        title: 'Node List'
                    });
                }
            });
        }
    });

    app.get('/admin/slices', function (req, res) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
        } else {
            console.log("Getting all slices")
            get_slicelet_data(req, res, function (req, res, error, slices) {
                if (error) {
                    utils.render_error_page(req, res, "Error in finding slice data", error);
                } else {
                    console.log(slices);
                    res.render('admin_slices', {
                        slices: slices,
                        title: 'Slice List'
                    });
                }
            });
        }
    });

    // get the slice renewal events, then render the log page
    var getSliceRenewalEventsAndRender = function(req, res, createRecords, deleteRecords) {
        DB.renewalLogs.find({}, function(err, renewalRecords) {
            if (err) {
                utils.render_error_page(req, res, "Error in finding slice renewal logs")
            } else {
                res.render('admin_logs', {
                    sliceCreationEvents: createRecords,
                    sliceDeletionEvents: deleteRecords,
                    sliceRenewalEvents: renewalRecords
                })
            }
        })
    }

    // get the deletion events, then get the renewal events and render the log page
    // get the slice renewal events, then render the log page
    var getSliceDeletionEventsAndRender = function(req, res, createRecords) {
        DB.deleteLogs.find({}, function(err, deleteRecords) {
            if (err) {
                utils.render_error_page(req, res, "Error in finding slice deletion logs")
            } else {
                getSliceRenewalEventsAndRender(req, res, createRecords, deleteRecords)
            }
        })
    }

    // get the creation events, then get the deletion and renewal events and render the log page
    // get the slice renewal events, then render the log page
    var getSliceCreationEventsAndRender = function(req, res) {
        DB.creationLogs.find({}, function(err, createRecords) {
            if (err) {
                utils.render_error_page(req, res, "Error in finding slice creation logs")
            } else {
                createRecords.forEach(function(aRecord) {
                    if (aRecord.ports && aRecord.ports.length > 0) {
                        aRecord.ports = aRecord.ports.map(function(aPort) {
                            return aPort.container + '->' + aPort.host
                        }).join(',')
                    }
                })
                getSliceDeletionEventsAndRender(req, res, createRecords)
            }
        })
    }


    var adminCheckOrDo = function(req, res, thenDo) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
        } else {
            thenDo(req, res)
        }
    }

    var renderCustomSliceRequests = function(req, res) {
        DB.customSliceRequests.find({}, function(err, sliceRequests) {
            if (err) {
                utils.render_error_page(req, res, "Error in finding custom slice requests", err)
            } else {
                if (sliceRequests && sliceRequests.length > 0) {
                    var sliceRequestDictionary = sliceRequests.map(function(aRequest) {
                        var portString = aRequest.ports.map(function(aPortEntry){
                            return aPortEntry.container + '->' + aPortEntry.host
                        }).join(', ')
                        return {
                            name:aRequest.sliceName,
                            user:aRequest.user,
                            imageName:aRequest.imageName,
                            ports: portString
                        }
                    })
                    res.render('admin_custom_slices', {
                        title: 'Custom Slices',
                        slices:sliceRequestDictionary
                    })
                } else {
                    res.render('admin_custom_slices', {
                        title: 'Custom Slices (No Current Requests)',
                        slices:[]
                    })
                }

            }
        })

    }

    app.get('/admin/show_events', function(req, res) {
        adminCheckOrDo(req, res, getSliceCreationEventsAndRender)
    })

    app.get('/admin/users/custom', function(req, res) {
        adminCheckOrDo(req, res, renderCustomSliceRequests)
    })

    var renderCustomSliceEditPage = function(req, res) {
        var urlParts = url.parse(req.url, true)
        var query = urlParts.query
        DB.customSliceRequests.findOne({sliceName:query.sliceName}, function(err, sliceRequest){
            if (err) {
                utils.render_error_page(req, res, "Error in finding custom slice request " + req.body.sliceName, err)
            } else {
                res.render('slice_request', {
                    title: 'Editing Customer Slice Request ' + query.sliceName,
                    imageName: sliceRequest.imageName,
                    sliceName: query.sliceName,
                    ports: sliceRequest.ports,
                    callback: '/admin/approve_custom_slice_request',
                    user: sliceRequest.user,
                    params: {
                        sliceName: query.sliceName,
                        user: sliceRequest.user
                    }
                })
            }
        })
    }

    app.get('/admin/custom_slice_request_edit', function(req, res) {
        adminCheckOrDo(req, res, renderCustomSliceEditPage)
    })

    var approveCustomSliceRequest = function(req, res) {
        var ports = JSON.parse(req.body.ports)
        var modifyCommand = {
            $set: {
                imageName: req.body.imageName,
                status: 'Processing',
                ports: ports
            }
        }
        DB.slices.update({sliceName: req.body.sliceName}, modifyCommand, {}, function(err, slice) {
            if (err) {
                utils.render_error_page(req, res, 'Error modifying slice ' + req.body.sliceName)
            } else {
                DB.customSliceRequests.remove({sliceName: req.body.sliceName}, function(err) {
                    if (err) {
                        utils.render_error_page(req, res, 'Error deleting custom slice request for ' + req.body.sliceName)
                    } else {
                        // last thing -- must create the request to actually create the slice
                        DB.sliceRequests.create({
                            action:'create',
                            user:req.body.user,
                            sliceName: req.body.sliceName,
                            imageName: req.body.imageName,
                            ports: ports
                        }, function(err) {
                            if (err) {
                                utils.render_error_page(req, res, 'Error creating slice request for ' + req.body.sliceName)
                            } else {
                                res.render('admin', {
                                    user: req.session.user
                                })
                            }
                        });
                    }
                })
            }
        })
    }

    app.post('/admin/approve_custom_slice_request', function(req, res) {
        adminCheckOrDo(req, res, approveCustomSliceRequest)
    })

    app.get('/admin/users/requests', function (req, res) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
        } else {
            render_user_requests(req, res);
        }
    });

    app.get('/admin/users', function (req, res) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
        } else {
            render_users(req, res);
        }
    });

    // The next three functions implement acting on user requests.  This comes from
    // the form /add_requested_users on page user_requests.jade.
    // This form will give us two separate email lists: new user requests to be
    // confirmed, and requests to be deleted.  Here, we pull out the two lists
    // and call act_on_user_requests to manipulate the database.
    // I should probably factor those into things which actually just manipulate the db
    app.post('/admin/users/requests/add', function (req, res) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
            return;
        }
        var to_confirm = utils.ensure_items_in_a_list(req.body.confirm);
        var to_delete = utils.ensure_items_in_a_list(req.body.to_delete);
        var user_string = "Will confirm " + to_confirm.length + " new users: " + to_confirm + ".";
        var delete_string = "Will delete " + to_delete.length + " requests: " + to_delete;
        console.log(user_string + " " + delete_string);
        if (to_confirm.length == 0 && to_delete.length == 0) {
            // nothing to do!
            res.render('admin', {
                user: req.session.user
            });
        } else {
            act_on_user_requests(req, res, to_confirm, to_delete);
        }
    });

    app.post('/admin/users/update', function (req, res) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
            return;
        }
        var admins = req.body.admin;
        console.log("Updating users, admins = " + JSON.stringify(admins));
        update_all_users(req, res, admins);
    });

    // Add a user.  Nesting is way too deep here, but that is an artifact of the callback/continuation architecture
    // of node.js...I should refactor and clean this up.
    app.get('/admin/users/add', function (req, res) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
        } else {
            // user name is a parameter to the call
            var query = url.parse(req.url, true).query;
            var username = query.user;
            if (!utils.validate_username(username)) {
                res.send("Invalid username " + username + " sent to add_user")
            } else {
                // Look for the user in the db.  If he's already there, send an error.  If
                // he's not, add him
                DB.users.find({
                    email: username
                }, function (err, users) {
                    if (err) {
                        res.send("Error in looking up " + username + ": " + err);
                    } else {
                        if (users.length == 0) { // go ahead and add the new user
                            DB.users.create({
                                email: username
                            }, function (err, new_user) {
                                if (err) {
                                    res.send("Error adding " + username + ": " + err);
                                } else {
                                    // Added the user.  Now show the users page
                                    render_users(req, res);
                                }
                            });
                        } else {
                            res.send("user " + username + " already in database: " + JSON.stringify(users));
                        }
                    }
                });
            }
        }
    });

    // dump the logfile
    app.get('/dump_logfile', function (req, res) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
        } else {
            res.sendfile('/var/log/gee/geePortal.out.log');
        }
    });

    // dump the error logs
    // dump the logfile
    app.get('/dump_error_logs', function (req, res) {
        if (!req.session.admin) { // lovely Javascript -- does the right thing even when req.session.admin is null
            res.render('admin_only', {
                user: req.session.user,
                title: 'Unauthorized Admin'
            });
        } else {
            res.sendfile('/var/log/gee/geePortal.err.log');
        }
    });
}
