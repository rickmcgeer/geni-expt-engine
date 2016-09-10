module.exports = function (app, utils, DB, urls) {
	// return a JSON document describing an error in one of the rest functions, with a message
	var renderJSONError = function(req, res, message) {
		res.json({success: false, message:message})
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
	var authenticateThenDo = function(req, res, fromCall, ipAddress, key, thenDo, thenDoArgs) {
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
		if (!candidateString || candidateString.length == 0) return false;
		var charList = candidateString.split('')
		return charList.reduce(function(prev, aChar) {
			return prev && charSet.indexOf(aChar) >= 0
		}, true)
	}
	var dnsChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_0123456789'
	var domainName = '.planet-ignite.net'
	// Error check a DNS name, and return the right one
	var checkAndGetDNSName = function(aString) {
		var checkForFullDNS = aString.match('(^.*)' + domainName + '$')
		var testString = checkForFullDNS?checkForFullDNS[1]:aString
		if (stringOK(testString, dnsChars)) {
			return {success: true, dnsName: testString + domainName}
		} else {
			return {success: false}
		}

	}
	var sshChars = dnsChars + '.'
	var checkSSHNickame = function(aString) {
		return stringOK(aString, sshChars)
	}
	var checkIPAddress = function(aString) {
		var components = aString.split('.')
		if (components.length != 4) {
			return false
		}
		return components.reduce(function(prev, aComponent) {
			if (isNaN(aComponent)) {
				return false;
			}
			var val = Number(aComponent)
			return prev && 0 <= val && val <= 255
		}, true)
	}
	// from a header, get a good add-node request.  This must have either the appropriate fields with validity, namely:
	// an ssh-friendly sshNickname
	// a valid URL, which is either unqualified (e.g. 'toronto'), or valid if an FQDN ('toronto'<domainName>)
	// a sitename, which can be anything (documentation only)
	var validateAddNodeRequest = function(argStruct) {
		// resutl will be returned in an object; set defaults here
		var result = {success: false}
		if (!argStruct.ipAddress) {
			result.message = 'Error: ipAddress to addNode must be specified';
		} else if (!checkIPAddress(argStruct.ipAddress)) {
			result.message = 'Error: bad ipAddress ' + argStruct.ipAddress;
		} else if (!argStruct.sshNickname) {
			result.message = 'Error: sshNickname to addNode must be specified';
		} else if (!checkSSHNickame(argStruct.sshNickname)) {
			result.message = 'Error: sshNickname to addNode must be valid.  ' + argStruct.sshNickname + ' Is invalid';
		} else if (!argStruct.siteName || argStruct.siteName.length == 0) {
			result.message =  'Error: siteName to addNode must be specified';
		} else if (!argStruct.dnsName) {
			rresult.message =  'Error: dnsName to addNode must be specified.  ';
		} else {
			var dnsRecord = checkAndGetDNSName(argStruct.dnsName)
			if (dnsRecord.success) {
				result.record = {
					ipAddress:argStruct.ipAddress, sshNickname:argStruct.sshNickname, siteName:argStruct.siteName, dnsName: dnsRecord.dnsName, date: new Date()
				}
				result.success = true;
			} else {
				result.message = 'Error: bad DNS Name ' + argStruct.dnsName + ' specified'
			}
		}
		// by this time, either we have succeeded in which case result.success is true and the corresponding good record is in
		// result.record or we have failed, in which case the reason is in result.message.  In either case just return
		return result;
	}

	// check the database record and lock.  We're going to use a dictionary of in-process requests.  Mongo doesn't have 
	// locking semantics, so we can't use the DB -- and if we went to a load-balanced implementation with nginx in front of 
	// this, this wouldn't work.  But for the moment it does.

	// IPs we are currently checking.  The semantics are that we will add an IP to lockedIPs immediately before we check the DB, 
	// and release when we are done checking/manipulating the DB for this IP
	var lockedIPs = []

	var isLocked = function(anIPAddress) {
		return lockedIPs.indexOf(anIPAddress) >= 0
	}

	var lockIP = function(anIPAddress) {
		if (lockedIPs.indexOf(anIPAddress) == -1) {
			lockedIPs.push(anIPAddress)
			return true;
		} else {
			// already locked!
			return false;
		}
	}

	var unlockIP = function(anIPAddress) {
		var ipIndex = lockedIPs.indexOf(anIPAddress)
		if (ipIndex == -1) {
			return false;
		}
		lockedIPs.splice(ipIndex, 1) 
		return true;
	}

	// add a node to the database and unlock on completion or error, issuing an appropriate JSON record to the 
	// caller
	var addNodeToDBAndUnlock = function(req, res, argStruct) {
		var newRecord = {
			ipAddress:argStruct.ipAddress, sshNickname:argStruct.sshNickname, siteName:argStruct.siteName, dnsName: dnsRecord.dnsName, date: new Date()
		}
		DB.nodes.create(newRecord, function(err) {
			unlockIP(argStruct.ipAddress)
			if (err) {
				renderJSONError(req, res, 'Error ' + err + ' entering record for ipAddress ' + ipAddress + ' into the database')
			} else {
				res.json({success: true, result: newRecord})
			}
		})
	}

	// when we add callback, put it in this routine.  The pseudo-code is:
	// call argStruct.ipAddress for confirmation
	// if Yes, call addNodetoDBAndUnlock. If No/Timeout, error and unlock

	var doCallbackThenAdd = function(req, res, argStruct) {
		// ATM, just a pass-through to addNodeToDBAndUnlock
		addNodeToDBAndUnlock(req, res, argStruct)

	}

	// check to see if a node is in the database and lock it.  This routine does not return; it can be made pluggable by passing in
	// in functions for error, node in DB, node not in DB.  for the moment these are hardcoded

	var checkNodeInDBLockAndAdd = function(req, res, argStruct) {
		// the assumption here is that argStruct is a valid record
		if (lockIP(argStruct.ipAddress)) {
			var searchRecord = {$or: [
				{sshNickname: argStruct.sshNickname},
			    {ipAddress: argStruct.ipAddress},
			    {dnsName: argStruct.dnsName}
			]}
			DB.nodes.find(searchRecord, function(err, records) {
				if (err) {
					unlockIP(argStruct.ipAddress)
					renderJSONError(req, res, 'Error in database lookup for ' + JSON.stringify(searchRecord))
				} else if (records.length > 0) {
					unlockIP(argStruct.ipAddress)
					renderJSONError(req, res, 'Already in database: node ' + JSON.stringify(records[0]))
				} else {
					doCallbackThenAdd(req, res, argStruct)
				}
			})
		}
	}



	
	// add a node.  Very simple.  Just validate the arguments.  if it's a valid request, a good argument structure is in 
	// checkResult.record, and call checkNodeInDBLockAndAdd on that record.  This executes the pipeline: lock the ip Address,
	// check to see if there's a DB conflict, call the node back.  If everything is OK, add the node to the DB and send back success.
	// If anything fails, render an error.  In all cases, unlock immediately after the LAST DB access.
	var addNode = function(req, res, argStruct) {
		var checkResult = validateAddNodeRequest(argStruct)
		if (checkResult.success) {
			checkNodeInDBLockAndAdd(req, res, checkResult.record)
		} else {
			renderJSONError(req, res, checkResult.message)
		}
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
		return req.headers['x-forwarded-for']
		// do some magic to pull the requesting IP address from the req -- check the documentation
	}
	// the actual REST interface
	app.get('/rest/add_node', function(req, res) {
		var ip = getRequestorIP(req)
		// put in authentication later
		addNode(req, res, req.query)

	})
	app.get('/rest/delete_node', function(req, res) {
		var ip = getRequestorIP(req)
		// put in authentication later
		deleteNode(req, res, req.query.ipAddress)
	})
	app.get('/rest/node_list', function(req, res) {
		nodeList(req, res)
	})
	app.get('/rest/help', function(req, res) {
		res.render('rest_help.jade')
	})
}