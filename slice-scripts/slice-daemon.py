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
# the tarfile for the slice
#
def makeTarfile(sliceName):
    return "/root/slice_files/" + sliceName + ".tgz"

#
# get directory of this script
def getScriptPath():
    return os.path.dirname(os.path.realpath(sys.argv[0]))

#
# create a slice
#
def createSlice(user, sliceName, imageName):
    try:
        scriptdir = getScriptPath()
        error_string = subprocess.check_output([scriptdir + '/create-slice.sh', sliceName, makeTarfile(sliceName), imageName], stderr=subprocess.STDOUT)
        slice_collection.update({"user": user}, {"$set": {"status":"Running"}})
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
    except subprocess.CalledProcessError:
        logging.error('Error in deleting slice: ' + sliceName + ': ' + error_string)
#
# service a request
#
def doRequest(aRequest):
    logString = "Performing request %s for user %s and slice %s" % (aRequest['action'], aRequest['user'], aRequest['sliceName'])
    if 'imageName' in aRequest.keys():
        logString += ' with image: ' + aRequest['imageName']
    logging.info(logString)
    if aRequest['action'] == 'create':
        createSlice(aRequest['user'], aRequest['sliceName'], aRequest['imageName'])
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
        
    
