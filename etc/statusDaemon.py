#!/usr/bin/python
import sys
import io
import os
import subprocess
from pprint import pprint
from pymongo import MongoClient, ReturnDocument
import time
import datetime


#
# Import authentication information and hostnames, etc., from the config file.
# we have two modes, real and sandbox
#
execfile('namecheap.config.py')

class HostObject(object):
  goodHosts = []
  badHosts = []
  def __init__(self,good,bad):
    self.goodHosts = good
    self.badHosts = bad

def scanHosts(hostList):
  goodHosts = []
  badHosts = []
  for host in hostList:
    with open(os.devnull, 'w') as DEVNULL:
      try:
        subprocess.check_call(
          ['ping','-c','5',host],
          stdout=DEVNULL,stderr=DEVNULL #to suppress output
        )
        goodHosts.append(host)
      except subprocess.CalledProcessError:
        badHosts.append(host)
  return HostObject(goodHosts,badHosts)

client = MongoClient('mongodb://mongodb:27017/')
db = client.gee_master
nodeCollection = db.nodes

def hostsFromDB():
  nodes = nodeCollection.find({})
  nodes = filter(lambda x:x['dnsName'].endswith(autoDomainName), nodes)
  return nodes

def updateHost(hostName, upAsBoolean):
  now = datetime.datetime.utcnow()
  nodeCollection.update({'dnsName':hostName}, {'$set': {'status': {'up': upAsBoolean, 'date':now}}})

def main():
  nodes = hostsFromDB()
  result = scanHosts([node['dnsName'] for node in nodes])
  #DEBUG PRINT
  pprint(vars(result))
  for hostName in result.goodHosts:
    updateHost(hostName, True)
  for hostName in result.badHosts:
    updateHost(hostName, False)
  

if __name__ == "__main__":
  while True:
    main()
    time.sleep(300)