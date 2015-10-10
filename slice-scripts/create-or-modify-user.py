#!/usr/bin/python
# create-or-modify-user.py -user <username> -admin
# add a user to the data base and/or change the admin bit if the user is in the
# database.  If -admin is present, set the admin bit; if it is not present,
# do not set it (clear if the user is already in the db)
#
import sys
import json
from pymongo import MongoClient, ReturnDocument
import datetime
from bson import json_util
import argparse

#
# An exception that is tossed for an error
#

class ValidationError(Exception):
    pass

#
# Check to see that aString is a valid email address of the form
# user@domain.tld.  No error checking other than making sure the
# string has an @ and at least one . after the @
#

def checkArgIsEmail(aString):
    parts = aString.split('@')
    if (len(parts) != 2):
        return (False, "address must have exactly one @ sign")
    domainParts = parts[1].split('.')
    if (len(domainParts) < 2):
        return (False, "domain part of address must have at least one '.'")
    return (True, "")

#
#  Build a parser to parse the arguments
#
parser = argparse.ArgumentParser(add_help=True)
parser.add_argument('-user', action='store', help = 'Specify user for action')
parser.add_argument('-admin', action='store_true', default=False, help = 'Set the admin bit for user if True')

#
# check arguments, exiting if not valid
#
def checkArgs():
    arguments = parser.parse_args()
    if (arguments.user == None):
        parser.print_help()
        sys.exit(1)
    emailCheck = checkArgIsEmail(arguments.user)
    if (emailCheck[0]):
        return (arguments.user, arguments.admin)
    else:
        parser.print_help()
        print "Email found %s, problem found %s" % (arguments.user, emailCheck[1])
        sys.exit(1)


# Connect to the db server on the mongo container.  This needs to be reset here
# if it changes.  Really should read from config.json
#
# Put in error-checking code when we read the docs
#
client = MongoClient('mongodb://mongodb:27017/')
db = client.gee_master
user_collection = db.users

def setAdminBit(aUserName, adminValue):
    user_collection.update({'email': aUserName}, {'$set': {'admin': adminValue}}, upsert=True)

if __name__ == '__main__':
    (user, adminValue) = checkArgs()
    print "user: %s, adminValue: %s" % (user, adminValue)
    setAdminBit(user, adminValue)
