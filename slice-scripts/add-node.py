#!/usr/bin/python
# add-node ipAddress siteName dnsName  sshNickname'
# add-node 148.73.65.127 washington.edu washington ig-uwashington
# generates a node with ipAddress 148.73.65.127 and name washington.gee-project.net which will appear as ig-uwashington in the ssh file
# just updates the database; a daemon will have to update the ssh/ansible file

import sys
import json
from pymongo import MongoClient, ReturnDocument
import datetime
from bson import json_util

#
# An exception that is tossed for an error
#

class ValidationError(Exception):
    pass

#
# make sure IP Address is a valid IP address
#

def checkIP(aString):
    fields = aString.split('.')
    if (len(fields) != 4):
        raise ValidationError('Bad IP Address ' + aString + '.  Must have four fields, not %d' % len(fields))
    try:
        numbers = [int(field) for field in fields]
    except ValueError:
        raise ValidationError('Non-numeric field in IP Address ' + aString)
    for field in numbers:
        if (field < 0 or field > 255):
            raise ValidationError('IP Address Component %d not permitted in iP Address %s' % (field, aString))
    return aString

#
# Make sure a name is a valid hostname for dnsName.  Raises a ValidationError if invalid
#
def checkName(aString, fieldName):
    firstChar = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    allChars = firstChar + '0123456789-_'
    #
    # maybe conservative, but what the heck
    #
    if (len(aString) < 1):
        raise ValidationError("%s must be a non-empty string" % fieldName)
    if firstChar.find(aString[0]) < 0:
        raise ValidationError('First character of field %s must be in %s, not %s' % (fieldName, firstChar, aString[0]))
    for char in aString[1:]:
        if allChars.find(char) < 0:
            raise ValidationError('Characters in %s must be from the set %s, not %s' % (fieldName, allChars, char))

#
# makeDNSName(aName): make aName into aName.gee-project.net if aName.gee-project.net won't give dns heartburn.
# uses checkName for that, and throws a ValidationError otherwise
#
def makeDNSName(aName):
    checkName(aName, 'DNSName')
    return aName + '.gee-project.net'






#
# Print a usage message in case of an error.  Prints the Exception error message if there
# is one
#

def printUsage(args, tossedException = None):
    print 'Usage: add-node ipAddress siteName dnsName  sshNickname'
    print '  e.g: add-node 148.73.65.127 washington.edu washington ig-uwashington'
    print '       generates a node with ipAddress 148.73.65.127 and name washington.gee-project.net which will appear as ig-uwashington in the ssh file'
    print 'Got: ' + ' '.join(args)
    if (tossedException):
        print(tossedException.message)
#
# Parse and check the command line.  The Usage is
# create-slice-request userName imageName hostPort1:containerPort1 hostPort2:containerPort2...
# Need to do: check that userName is valid (an email address) and that imageName really is
# an imageName.  Currently check that a port is integer:integer, but we need to check the
# ranges are OK
#


def parseCommandLineAndReturnRequests():
    if (len(sys.argv) != 5 ):
        numArgs = len(sys.argv) - 1
        printUsage(sys.argv, ValidationError('Expected 4 arguments, got %d' % numArgs))
        sys.exit(1)
    try:
        result = {
            'action': 'create',
            'date': datetime.datetime.utcnow()
        }
        result['ipAddress'] = checkIP(sys.argv[1])
        result['siteName'] = sys.argv[2]
        result['dnsName'] = makeDNSName(sys.argv[3])
        result['sshNickname'] = checkName(sys.argv[4], 'sshNickname')
        return result
    except ValidationError as e:
        printUsage(sys.argv, e)
        sys.exit(1)


#
# Connect to the db server on the mongo container.  This needs to be reset here
# if it changes.  Really should read from config.json
#
# Put in error-checking code when we read the docs
#
client = MongoClient('mongodb://mongodb:27017/')
db = client.gee_master
node_collection = db.nodes


if __name__ == '__main__':
    nodeRequestSpec = parseCommandLine()
    print json.dumps(nodeRequestSpec, default=json_util.default)
    print 'Putting new slice in database: ' + json.dumps(nodeRequestSpec, default=json_util.default)
    node_collection.insert_one(nodeRequestSpec)
