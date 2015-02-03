#!/usr/bin/python
# A daemon which serializes create-slice.sh and delete-slice.sh requests, to
# avoid multiple simultaneous requests to the Ansible scripts

from pymongo import MongoClient
import subprocess
import time
#
# Connect to the db server on the mongo container.  This needs to be reset here
# if it changes.  Really should read from config.json
#
# Put in error-checking code when we read the docs
#
client = MongoClient('mongodb://mongo:27017/')
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
# create a slice
#
def createSlice(user, sliceName):
    try:
        error_string = subprocess.check_output(['create-slice.sh', sliceName], stderr=subprocess.STDOUT)
        slice_collection.update({"user": user}, {"$set": {"status":"Running"}})
    except subprocess.CalledProcessError:
        logging.error('Error in creating slice: ' + sliceName + ': ' + error_string)
        slice_collection.update({"user": user}, {"$set": {"status":"Error"}})
        

#
# delete a slice
#
def deleteSlice(sliceName):
    try:
        error_string = subprocess.check_output(['./delete-slice.sh', sliceName], stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError:
        logging.error('Error in deleting slice: ' + sliceName + ': ' + error_string)
#
# service a request
#
def doRequest(aRequest):
    if request.action == 'create':
        createSlice(aRequest.user, aRequest.sliceName)
    else:
        deleteSlice(aRequest.sliceName)
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
        
    