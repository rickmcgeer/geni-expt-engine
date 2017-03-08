##!/usr/bin/python
#
# Library functions needed to talk to the DNS Server at namecheap.  This will mostly be used
# by the updateDNSDaemon, but it is broken out as a library to permit interactive exploration
#
import sys
from xml.dom.minidom import parseString
import json
from pymongo import MongoClient, ReturnDocument
import time
import urllib3

#
# Import authentication information and hostnames, etc., from the config file.
# we have two modes, real and sandbox
#
execfile('namecheap.config.py')

host = realHost
authentication = realAuthentication

#
# A HostRecord, with a method to print it as a usable string
#


class HostRecord:
    def __init__(self, hostName, address, recordType, TTL):
        self.hostName = hostName
        self.address = address
        self.recordType = recordType
        self.TTL = TTL

    def specString(self, i):
        return 'HostName%d=%s&Address%d=%s&RecordType%d=%s&TTL%d=%s' % (i, self.hostName, i, self.address, i, self.recordType, i, self.TTL)
        
#
# Records which should never be deleted.  This will move into the DB eventually
#

sandboxKeepRecords = []
realKeepRecords = [HostRecord(u'www', u'parkingpage.namecheap.com.', u'CNAME', u'1800'), HostRecord(u'@', u'http://www.planet-ignite.net/', u'URL', u'1800')]

keepRecords = realKeepRecords
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
    # tuples = [(i + 1, aHostList[i][0], i + 1, aHostList[i][1], i + 1, aHostList[i][2]) for i in range(len(aHostList))]
    # hostStrings = ['HostName%d=%s&Address%d=%s&RecordType%d=%s&TTL=1000' % aTuple for aTuple in tuples]
    hostStrings = [aHostList[i].specString(i + 1) for i in range(len(aHostList))]
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
    return [HostRecord(node['dnsName'][:suffixLength], node['ipAddress'], 'A', 1000) for node in nodes]

def doUpdate(hostRecords):
    # keepRecords = mainRecords(getHosts())
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