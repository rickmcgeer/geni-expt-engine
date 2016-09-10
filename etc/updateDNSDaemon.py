#!/usr/bin/python
# Run continuously, getting the auto-added names from the DB and adding them to the 
import urllib3
import sys
from xml.dom.minidom import parseString
import json
from pymongo import MongoClient, ReturnDocument
import time

host = 'http://api.sandbox.namecheap.com/xml.response'
authentication = 'ApiUser=rick1&ApiKey=0a1a2799eed246f791af0f2d941808b0&UserName=rick1'
domainInfo = 'SLD=planet-ignite&TLD=net'
clientIP='clientIP=171.67.92.194'
autoDomainName = '.planet-ignite.net'


def mainRecords(hostRecords):
	return filter(lambda x: x[2] != 'Type', hostRecords)



def returnRecord(ip,name):
	record = Record(ip,name)
	return record

def execCommand(anURL):
	http = urllib3.PoolManager()
	httpResponse = http.request('GET', anURL)
	return  httpResponse.data


def getHosts():
	getHostsURL = '%s?Command=namecheap.domains.dns.getHosts&%s&%s&%s' % (host, authentication, domainInfo,clientIP)
	xmlResult = parseString(execCommand(getHostsURL))
	hostRecords = xmlResult.getElementsByTagName('host')
	return  [(aRecord.getAttribute('Name'), aRecord.getAttribute('Address'), aRecord.getAttribute('Type')) for aRecord in hostRecords]

def mainRecords(hostRecords):
	return filter(lambda x: x[2] != 'Type', hostRecords)

def makeSetHostURL(aHostList):
	tuples = [(i + 1, aHostList[i][0], i + 1, aHostList[i][1], i + 1, aHostList[i][2]) for i in range(len(aHostList))]
	hostStrings = ['HostName%d=%s&Address%d=%s&RecordType%d=%s&TTL=1000' % aTuple for aTuple in tuples]
	hostString = '&'.join(hostStrings)
	setHostsURL = '%s?Command=namecheap.domains.dns.setHosts&%s&%s&%s&%s' % (host, authentication, domainInfo,clientIP,hostString)
	return setHostsURL

client = MongoClient('mongodb://mongodb:27017/')
db = client.gee_master
nodeCollection = db.nodes

def hostsFromDB():
	nodes = nodeCollection.find({})
	nodes = filter(lambda x:x['dnsName'].endswith(autoDomainName), nodes)
	suffixLength = -len(autoDomainName)
	return [(node['dnsName'][:suffixLength], node['ipAddress'], 'A') for node in nodes]

def doUpdate(hostRecords):
	keepRecords = mainRecords(getHosts())
	setURL = makeSetHostURL(keepRecords + hostRecords)
	return execCommand(setURL)

def updateAll():
	doUpdate(hostsFromDB())

def listsChanged(list1, list2):
	for aTuple in list1:
		matches = filter(lambda x: x == aTuple, list2)
		if (len(matches) == 0): return True
	for aTuple in list2:
		matches = filter(lambda x: x == aTuple, list1)
		if (len(matches) == 0): return True
	return False

if __name__ == '__main__':
	lastHosts = []
	while True:
		newHosts = hostsFromDB()
		if (len(newHosts) != len(lastHosts)):
			doUpdate(newHosts)
		elif (listsChanged(newHosts, lastHosts)):
				doUpdate(newHosts)
		lastHosts = newHosts
		time.sleep(60)



