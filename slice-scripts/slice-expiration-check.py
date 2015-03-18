#!/usr/bin/python
# A daemon which serializes create-slice.sh and delete-slice.sh requests, to
# avoid multiple simultaneous requests to the Ansible scripts

from pymongo import MongoClient
import subprocess
import time
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
#
# Open the logfile
#
import logging
logging.basicConfig(filename='slice_expiration_daemon.log',level=logging.DEBUG)

#
# find expired slices
#
def findExpiredSlices():
    now = datetime.datetime.today()
    result = []
    slices = slice_collection.find()
    for slice in slices:
        if (slice['expires'] < now):
            result.append(slice)
    return result
#
# Ask for an expired slice to be deleted
#
def addDeleteRequest(slice):
    name = 'slice%d' % slice['sliceNum']
    existingRequest = request_collection.find_one({'sliceNum':slice['sliceNum']})
    if (existingRequest): return
    dateString = datetime.datetime.today().strftime("%Y-%m-%d %H:%M:%S")

    logging.info("Deleting slice %s  which expired at %s.  Today is %s" % (name, slice['expires'], dateString))
    request_collection.insert({'action':'delete', 'sliceName':name, 'user':slice['user']})
        


# main loop
#

if __name__ == '__main__':
    while True:
        expired = findExpiredSlices()
        for slice in expired:
            addDeleteRequest(slice)
        
    
