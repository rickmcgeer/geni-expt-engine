module.exports = function (app, utils, DB, urls) {
	// return a JSON document describing an error in one of the rest functions, with a message
	var renderJSONError = function(req, res, message) {
		res.json({success: false, message:message})
	}
	// generate a randome hash key for IP address
	var genKey = function(ipAddress) {
		// use a secure random hash of IP address.  For the moment, placeholder, just a random number in the range (0, 2^256)
		return 'fjksjdfoisj;okasjfa;sofjjsfsjsdjfasjjasodkjfcosjf'
	}
	// get the key for IP address, creating it if it doesn't exist.
	var getKey = function(ipAddress, req, res) {
		DB.nodeKeys.find({ipAddress:ipAddress}, function(err, records) {
			if (err) {
				renderJSONError(req, res, 'Error ' + err + ' in finding hashkey for ' + ipAddress)
			} else if (records.length == 0) {
				var key = genKey(ipAddress)
				DB.nodeKeys.create({ipAddress:ipAddress, key:key}, function(err) {
					if (err) {
						renderJSONError(req, res, 'Error ' + err + ' in creating hashkey for ' + ipAddress)
					} else {
						res.json({success: true, ipAddress: ipAddress, key:key})
					}

				})
			} else {
				res.json({success: true, ipAddress: ipAddress, key:key})
			}
		})
	}
	// authenticate a node and then do the function desired, with the optional argument structure.
	// The arguments are:
	// req, res: obvious
	// fromCall: request name for error messages
	// ipAddress: address of the node that sent the request
	// key: matching key from the DB.  Fail if not in the DB
	// thenDo: a callback to implement the authenticated request, which should be a function of the
	//         form thenDo(req, res, ipAddress, args)
	// thenDoArgs: optional arguments to pass to the callback.  Opaque to this function
	var authenticateThenDo(req, res, fromCall, ipAddress, key, thenDo, thenDoArgs) {
		// turning off authentication for testing.  Remove this code once we have authentication in place
		thenDo(req, res, ipAddress, args)
		return
		// various authentication failures.  missing address, missing key, address/key pair not in DB
		if (!ipAddress) {
			renderJSONError('Missing IP Address in request ' + fromCall)
		} else if (!key) {
			renderJSONError('Missing IP Address in request ' + key)
		} else {
			DB.nodeKeys.find({ipAddress: ipAddress, key: key}, function(err, records) {
				if (err) {
					renderJSONError(req, res, 'Error ' + err + ' in finding record  for ipAddress ' + ipAddress + ' with key ' + key + ' for call ' + fromCall)
				} else if (records.length == 0) {
					renderJSONError(req, res, 'Authentication failure for call ' + fromCall +'. Pair was (' + ipAddress + ', ' + key + ')')
				} else {
					thenDo(req, res, ipAddress, thenDoArgs)
				}
			})
		}
	}
	// make sure a string contains only valid characters
	var stringOK = function(candidateString, charSet) {
		return candidateString.reduce(prev, function(aChar) {
			return prev && charSet.indexOf(aChar) >= 0
		}, true)
	}
	var dnsChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_0123456789'
	// Error check a DNS name, and return the right one
	var checkAndGetDNSName(aString) {
		var testString = aString
		if (testString.endswith('.gee-project.net')) {
			testString = testString.substring(testString.indexOf('.gee-project.net'))
		}
		if (stringOK(testString, dnsChars)) {
			return {success: true, dnsName: testString + '.gee-project.net'}
		} else {
			return {success: false}
		}

	}
	var sshChars = dnsChars + '.'
	var checkSSHNickame(aString) {
		return stringOK(aString, sshChars)
	}
	// addNodeHelper.  Added as  a callback to addNode, the better to prevent nesting.  Should not be called by any routine except
	// addNode.
	var addNodeHelper = function(req, res, argStruct) {
		if (!argStruct.sshNickname) {
			renderJSONError(req, res, 'Error: sshNickname to addNode must be specified')
		} else if (!checkSSHNickame(argStruct.sshNickname) {
			renderJSONError(req, res, 'Error: sshNickname to addNode must be valid.  ' + argStruct.sshNickname + ' Is invalid')
		} else if (!argStruct.siteName) {
			renderJSONError(req, res, 'Error: siteName to addNode must be specified')
		} else if (!argStruct.dnsName) {
			renderJSONError(req, res, 'Error: dnsName to addNode must be specified.  ')
		} else {
			var dnsRecord = checkAndGetDNSName(argStruct.dnsName)
			if (dnsRecord.success) {
				var newRecord = {
					ipAddress:ipAddress, sshNickname:argStruct.sshNickname, siteName:argStruct.siteName, dnsName: dnsRecord.dnsName, date: new Date()
				}
				DB.nodes.create(newRecord, function(err) {
					if (err) {
						renderJSONError(req, res, 'Error ' + err + ' entering record for ipAddress ' + ipAddress + ' into the database')
					} else {
						res.json({success: true, result: newRecord})
					}
				})
			} else {
				renderJSONError(req, res, 'Bad DNS Name to addNode: ' + argStruct.dnsName)
			}
		}
	}
	// add a node
	var addNode = function(req, res, argStruct) {
		var record = DB.nodes.find({ipAddress: argStruct.ipAddress}, function(err, records) {
			if (err) {
				renderJSONError(req, res, 'Error in doing database lookup for record with ipAddress ' + ipAddress)
			} else if (records.length > 0) {
				renderJSONError(req, res, 'Error: node with ipAddress ' + ipAddress + ' already in the database')
			} else {
				addNodeHelper(req, res, argStruct)
			}
		})
	}
	// delete a node
	var deleteNode = function(req, res, givenAddress) {
		DB.nodes.remove({ipAddress:givenAddress}, function(err) {
			if (err) {
				renderJSONError(req, res, "Error " + err + " in removing " + ipAddress + " from the database")
			} else {
				res.json({success: true})
			}
		})
	}
	var nodeList = function(req, res) {
		DB.nodes.find({}, function(err, records) {
			if (err) {
				renderJSONError('Error ' + err + ' in finding all node records')
			} else {
				res.json({success: true, records: records})
			}
		})
	}
	var getRequestorIP = function(req) {
		return request.headers['x-forwarded-for']
		// do some magic to pull the requesting IP address from the req -- check the documentation
	}
	// the actual REST interface
	app.get('/rest/add_node', function(req, res) {
		var ip = getRequestorIP(req)
		// put in authentication later
		addNode(req, res, req.query)

	})
	app.get('/res/delete_node', function(req, res) {
		var ip = getRequestorIP(req)
		// put in authentication later
		addNode(req, res, req.query.ip)
	}
	app.get('/rest/node_list', function(req, res) {
		nodeList(req, res)
	})
	app.get('/rest/help', function(req, res) {
		res.render('rest_help.jade')
	})
