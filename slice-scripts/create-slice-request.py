#!/usr/bin/python
# create-slice-request <username> <imageName> <portSpecs>
# put a new slice in the database, and a request to create it
# userName is a GEE user
# imageName is one of the vetted images
# portSpecs is a set of strings (potentially empty) of the form nn:mm,
# where nn is a host port number and mm is a container port number
# No error checking aside from the obvious
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
# make sure a user is a real user
#

def checkUserName(aUserName):
    return aUserName
#
# make sure an image is a real image
#

def checkImageName(anImageName):
    return anImageName

#
# Process the ports.  This is the only thing we have now that checks anything.  Take a spec
# of the form h1:c1 h2:c2... and return [{host:h1, container:c1}, {host:h2, container:c2}...]
# barfs if an element isn't of the form h1:c1, where h1, c1 are both positive integers.
# should check ranges, currently doesn't
#
def processPorts(argList):
    if ((argList == None) or (len(argList) == 0)):
        return []
    # I will be lazy and therefore fussy now -- rigid host:container
    # format, no whitespace permitted
    ports = []
    for arg in argList:
        if (arg.find(':') == -1):
            raise ValidationError('Bad port specification ' + arg + ' did not contain :')
        portSpecs = arg.split(':')
        if (len(portSpecs) != 2):
            raise ValidationError('Bad port specification ' + arg + ' contained more than 2 port specs')
        for port in portSpecs:
            if (not port.isdigit()):
                raise  ValidationError('Bad port specification %s. %s is not a positive integer' % (arg, port))
            # should check range...
        ports.append({'host': int(portSpecs[0]), 'container': int(portSpecs[1])})
    return ports

#
# Print a usage message in case of an error.  Prints the Exception error message if there
# is one
#

def printUsage(args, tossedException = None):
    print 'Usage: create-slice-request userName imageName hostPort1:containerPort1 hostPort2:containerPort2...'
    print 'Got: ' + ' '.join(args)
    if (tossedException):
        print(tossedException.message)
#
# Pasrse and check the command line.  The Usage is
# create-slice-request userName imageName hostPort1:containerPort1 hostPort2:containerPort2...
# Need to do: check that userName is valid (an email address) and that imageName really is
# an imageName.  Currently check that a port is integer:integer, but we need to check the
# ranges are OK
#


def parseCommandLine():
    if (len(sys.argv) < 3):
        printUsage(sys.argv)
        sys.exit(1)
    try:
        result = {}
        result['user'] = checkUserName(sys.argv[1])
        result['imageName'] = checkImageName(sys.argv[2])
        result['ports'] = processPorts(sys.argv[3:])
        result['status'] = 'Processing'
        result['expires'] = datetime.datetime.utcnow() + datetime.timedelta(days = 14)
        return result
    except ValidationError as e:
        printUsage(sys.argv, e)
        sys.exit(1)
#
# Make a tarball name from a number.  Hote that this code is a Python version of
# the javascript code in Slice.js.   Note also the similarity to the code in Slice.js
# and makeSliceName
#
def sliceTarball(sliceNum):
    return '/root/slice_files/slice%d.tgz' % sliceNum
#
# Make a slice name from a number.  Hote that this code is a Python version of
# the javascript code in Slice.js
#
def makeSliceName(sliceNum):
    return 'slice%d' % sliceNum
#
# Make a SliceRequest from a sliceSpec
# This is just creating one json structure from another
# and is dependent on the db schema for slice_requests
#
def makeSliceRequest(sliceSpec):
    return {
        'action': 'create',
        'user': sliceSpec['user'],
        'imageName': sliceSpec['imageName'],
        'ports': sliceSpec['ports'],
        'sliceName': makeSliceName(sliceSpec['sliceNum'])
    }

#
# Connect to the db server on the mongo container.  This needs to be reset here
# if it changes.  Really should read from config.json
#
# Put in error-checking code when we read the docs
#
client = MongoClient('mongodb://mongodb:27017/')
db = client.gee_master
request_collection = db.slice_requests
slice_collection = db.slices
id_counters  = db.identitycounters

if __name__ == '__main__':
    sliceSpec = parseCommandLine()
    print json.dumps(sliceSpec, default=json_util.default)
    query = {'field':'sliceNum', 'model': 'slices'}
    action = {'$inc':{'count':1}}
    result  = id_counters.find_one_and_update(query, action, return_document=ReturnDocument.AFTER)
    newSliceNum = int(result['count'])
    print 'New slice num is %d' % newSliceNum
    sliceSpec['sliceNum'] = newSliceNum
    sliceSpec['tarFile'] = sliceTarball(newSliceNum)
    sliceRequestSpec = makeSliceRequest(sliceSpec)
    print 'Putting new slice in database: ' + json.dumps(sliceSpec, default=json_util.default)
    slice_collection.insert_one(sliceSpec)
    print 'Putting new slice request in database: ' + json.dumps(sliceRequestSpec, default=json_util.default)
    request_collection.insert_one(sliceRequestSpec)
