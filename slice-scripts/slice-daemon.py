#!/usr/bin/python
# A daemon which serializes create-slice.sh and delete-slice.sh requests, to
# avoid multiple simultaneous requests to the Ansible scripts

from pymongo import MongoClient
import subprocess
import time
import sys
import os
import json
import datetime

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
create_log_collection = db.slice_create_records
delete_log_collection = db.slice_delete_records

#
# Open the logfile
#
import logging
# logging.basicConfig(filename='slice_daemon.log',level=logging.DEBUG)
# supervisorctl expects logger output on stderr, so don't redirect if we're running
# under supervisorctl
logging.basicConfig(level=logging.DEBUG)
#
# Pull a slice request
#
def getNextOutstandingRequest():
    return request_collection.find_one()

#
# Get all of the host ports being used by all of the slices
#
def getAllPorts():
    slices = slice_collection.find({})
    ports = []
    for slice in slices:
        if slice['ports']:
            ports = ports +  [portMap['host'] for portMap in slice['ports']]
    return ports



#
# the tarfile for the slice
#
def makeTarfile(sliceName):
    return "/root/slice_files/" + sliceName + ".tgz"

#
# get directory of this script
def getScriptPath():
    return os.path.dirname(os.path.realpath(sys.argv[0]))

#
# get port string: from a port specification, get the ports and put them into a
# form for create-slice.sh
#
def getPortString(ports=None):
    if (ports == None): return "[]"
    if (len(ports) == 0): return "[]"
    portStringArray = ["'%s:%s'" % (port['host'], port['container']) for port in ports]
    return '[' + ','.join(portStringArray) + ']'


#
# create a slice
#
def createSlice(user, sliceName, imageName, date, ports):
    try:
        scriptdir = getScriptPath()
        if (ports == None): ports = []
        portString = getPortString(ports)
        print (scriptdir + '/create-slice.sh %s %s %s %s' % (sliceName, makeTarfile(sliceName), imageName, portString))
        error_string = subprocess.check_output([scriptdir + '/create-slice.sh', sliceName, makeTarfile(sliceName), imageName, portString],
                                               stderr=subprocess.STDOUT)
        slice_collection.update({"user": user}, {"$set": {"status":"Running"}})
        sliceRecord = slice_collection.find_one({"sliceName": sliceName})
        # log the creation event
        create_log_collection.insert_one({"user" : user, "sliceName": sliceName, "imageName":imageName, "ports": ports,
                                          "sliceNum": sliceRecord['sliceNum'], "expires": sliceRecord['expires'], "date": date})
        if (ports and len(ports) > 0):
            slice_collection.update({"user": user}, {"$set": {"ports": ports}})
        logging.info('slice ' + sliceName + ' created for user ' + user)

    except subprocess.CalledProcessError, e:
        logging.error('Error in creating slice: ' + sliceName + ': ' + e.output)
        slice_collection.update({"user": user}, {"$set": {"status":"Error"}})



#
# delete a slice
#
def deleteSlice(sliceName, date):
    try:
        scriptdir = getScriptPath()
        error_string = subprocess.check_output([scriptdir + '/delete-slice.sh', sliceName], stderr=subprocess.STDOUT)
        sliceRecord = slice_collection.find_one({"sliceName": sliceName})
        delete_log_collection.insert_one({'date': date, 'sliceName': sliceName})
        logging.info('slice ' + sliceName + ' deleted')
	slice_collection.remove(sliceRecord)
    except subprocess.CalledProcessError, e:
        logging.error('Error in deleting slice: ' + sliceName + ': ' + e.output)
#
# service a request
#
def doRequest(aRequest):
    logString = "Performing request %s for user %s and slice %s" % (aRequest['action'], aRequest['user'], aRequest['sliceName'])
    if 'imageName' in aRequest.keys():
        logString += ' with image: ' + aRequest['imageName']
    if 'ports' in aRequest.keys():
        logString += ' wth port request: ' + getPortString(aRequest['ports'])
    logging.info(logString)
    date = datetime.datetime.now()
    if aRequest['action'] == 'create':
        createSlice(aRequest['user'], aRequest['sliceName'], aRequest['imageName'], date, aRequest['ports'])
    else:
        deleteSlice(aRequest['sliceName'], date)
    request_collection.remove({'action':aRequest['action'], 'sliceName': aRequest['sliceName']})

#
# check a request
#

def checkRequest(aRequest):
    requiredFields = ['action', 'user', 'sliceName']
    fieldPresent = [field in aRequest.keys() for field in requiredFields]
    ok = not (False in fieldPresent)
    return ok



#
# main loop
#

if __name__ == '__main__':
    while True:
        request = getNextOutstandingRequest()
        if request:
            if checkRequest(request):
                doRequest(request)
            else:
                fieldsAsStrings = ["%s:%s" % (field, repr(request[field])) for field in request.keys()]
                logging.error("Bad slice request found: " + ', '.join(fieldsAsStrings))
                request_collection.remove({"_id": request["_id"]})
        else:
            time.sleep(15)
