#!/usr/bin/python
#
# Delete nodes by name or by ipAddress, e.g.
# delete-node 148.73.256.29 washington northwestern.gee-project.net will delete the nodes
# at ip address 148.73.256.29 washington.gee-project.net and northwestern.gee-project.net.  Note 
# that .gee-project.net is appended to a name if it isn't already there.
#
import json
from pymongo import MongoClient, ReturnDocument
import argparse
import sys

#
# Test to see if aString is a valid part of an IP address: an integer that is between 0 and 255
#

def isComponent(aString):
	try:
		val = int(aString)
		return 0 <= val and val < 256
	except ValueError:
		return False

#
# aString is an ip address if and only if it has four components and they are each valid
#
def isIPAddress(aString):
	components = aString.split('.')
	if len(components) != 4: return False
	return reduce(lambda x, y: x and isComponent(y), components)

#
# Check to see if a name ends with '.gee-project.net', and if it doesn't append '.gee-project.net'
#
def completeName(aString):
	if aString.endswith('.gee-project.net'): return aString
	return aString + '.gee-project.net'

#
# Sort the arguments into ipAddresses and names, and ensure that all the names end in '.gee-project.net'.
# Returns a dictionary where the IP Addresses are a list under the key addresses and names are under the key names
#

def sortArgs(argList):
	result = {'addresses': [], 'names':[]}
	for arg in argList:
		if isIPAddress(arg):
			result['addresses'].append(arg)
		else:
			result['names'].append(completeName(arg))
	return result

# 
# Turn a list into a query.  this will be a single-entry dictionary, of the form
# { fieldName: spec }, where
#  spec = argList[0] if argList is of length 1
#       = {'$in': argList} if argList is of length > 1
# returns None if argList is empty
#

def formSimpleQuery(argList, fieldName):
	if (len(argList) == 0):
		return None
	if (len(argList) == 1):
		return { fieldName : argList[0] }
	return { fieldName : {'$in': argList}} 

#
# Turn a dictionary created by sortArgs into a query.  This involves finding the query for each of the component
# if one is None, return the other; if both are not None, return
# {"$or": [query1, query2]}
# 

def formQuery(parsedArgumentDict):
	query1 = formSimpleQuery(parsedArgumentDict['names'], 'dnsName')
	query2 = formSimpleQuery(parsedArgumentDict['addresses'], 'ipAddress')
	if not query1: return query2
	if not query2: return query1
	return {'$or' :[query1, query2]}

#
# Print usage.  Debugging only
#
def printUsage():
	print 'delete-node [-h] <spec1> <spec2>...<specN>'
	print '  <spec_i> is either an IP address or a name that is interpreted as a DNS Name'
	print '  names that do not end with .gee-project.org are completed to form <name>.gee-project.org'

# Initialize the database client and get the node collection out

client = MongoClient('mongodb://mongodb:27017/')
db = client.gee_master
node_collection = db.nodes

#
# Main routine.  Fairly straightforward.  Use the ArgumentParser to parse the arguments, dig out the specifications,
# (if there are no specs, just print a usage message and quit).  Sort the specifications into names and ip addresses, then
# pass these to formQuery to get the query out, and then just run remove() with that query to dump the items from the database

if __name__ == '__main__':
	parser = argparse.ArgumentParser(description='Delete some nodes.')
	parser.add_argument('specifications', metavar='Spec',  nargs='+',
                    help='<spec_i> is either an IP address or a name that is interpreted as a DNS Name.  Names that do not end with .gee-project.org are completed to form <name>.gee-project.org')
	args = parser.parse_args().specifications
	if (len(args) == 0):
		printUsage()
		sys.exit(1)
	sortedArgs = sortArgs(args)
	result = formQuery(sortedArgs)
	# this is for debugging, should be removed
	print json.dumps(result)
	node_collection.remove(result)