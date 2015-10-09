#!/usr/bin/python
# A daemon which serializes create-slice.sh and delete-slice.sh requests, to
# avoid multiple simultaneous requests to the Ansible scripts

from pymongo import MongoClient
import subprocess
import time
import sys
import os

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
#
# Open the logfile
#
import logging
logging.basicConfig(filename='slice_daemon.log',level=logging.DEBUG)
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
    portStringArray = ["'%d:%d'" % (port['host'], port['container']) for port in ports]
    return '[' + ','.join(portStringArray) + ']'


#
# create a slice
#
def createSlice(user, sliceName, imageName, ports):
    try:
        scriptdir = getScriptPath()
        portString = getPortString(ports)
        print (scriptdir + '/create-slice.sh %s %s %s %s' % (sliceName, makeTarfile(sliceName), imageName, portString))
        error_string = subprocess.check_output([scriptdir + '/create-slice.sh', sliceName, makeTarfile(sliceName), imageName, portString], stderr=subprocess.STDOUT)
        slice_collection.update({"user": user}, {"$set": {"status":"Running"}})
        if (ports and len(ports) > 0):
            slice_collection.update({"user": user}, {"$set": {"ports": ports}})
        logging.info('slice ' + sliceName + ' created for user ' + user)
    except subprocess.CalledProcessError, e:
        logging.error('Error in creating slice: ' + sliceName + ': ' + e.output)
        slice_collection.update({"user": user}, {"$set": {"status":"Error"}})



#
# delete a slice
#
def deleteSlice(sliceName):
    try:
        scriptdir = getScriptPath()
        error_string = subprocess.check_output([scriptdir + '/delete-slice.sh', sliceName], stderr=subprocess.STDOUT)
        logging.info('slice ' + sliceName + ' deleted')
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
    if aRequest['action'] == 'create':
        createSlice(aRequest['user'], aRequest['sliceName'], aRequest['imageName'], aRequest['ports'])
    else:
        deleteSlice(aRequest['sliceName'])
    request_collection.remove(aRequest)

#
# main loop
#

if __name__ == '__main__':
    while True:
        request = getNextOutstandingRequest()
        if request: doRequest(request)
        else:
            time.sleep(15)
