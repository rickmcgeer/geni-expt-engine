#!/usr/bin/python
#
# Script to get the host inventory for the GEE dynamically from the node collection in the database.  Designed to be called by
# ansible, so the usage is dictated by Ansible.  See: http://docs.ansible.com/ansible/intro_dynamic_inventory.html and
# http://docs.ansible.com/ansible/developing_inventory.html
# To use with ansible, use in place of a static file, e.g.
# ansible -i dynInventory.py nodes -m ping
# Usage:
# dynInventory --list 
#     returns a JSON dictionary of lists of hosts
# dynInventory --host hostname
#     returns information about host hostname as a dictionary
# dynInventory --hostAll
#     returns detailed information about all host
# dynInventor --generateInventory
#     prints an Ansible inventory file. This  is to generate the Ansible files to be bundled with the slicelet tarball.
# Currently, the --list form only returns one entry, 'nodes'. 
#
import argparse
import json
from pymongo import MongoClient, ReturnDocument
def parse_args():
    parser = argparse.ArgumentParser(description='Dynamic Inventory From GEE Database')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--generateInventory', action='store_true',
                        help='Generate a static inventory file')
    group.add_argument('--list', action='store_true',
                       help='List active servers')
    group.add_argument('--host', nargs='+', help='List details about the specific host')
    group.add_argument('--hostAll', action = 'store_true', help='List details about all hosts')
    return parser.parse_args()

client = MongoClient('mongodb://mongodb:27017/')
db = client.gee_master
node_collection = db.nodes
#
# Get all of the nodes as a list of names e.g., ['utah.gee-project.net', 'northwestern.gee-project.net']
#
def getAllNodes():
    nodes = node_collection.find({})
    return [node['dnsName'] for node in nodes]


#
# get the result dictionary
#
def getDictionary(args):
    if (args.host):
        specifier = {'dnsName': {'$in': args.host}}
    else:
        specifier = {}
    return node_collection.find({})

if __name__ == '__main__':
    args = parse_args()
    nodes  = getDictionary(args)
    if (args.host or args.hostAll):
        result = [{'dnsName': node['dnsName'], 'sshNickname':node['sshNickname'], 'ipAddress': node['ipAddress']} for node in nodes]
        print json.dumps(result)
    elif args.generateInventory:
        print '[nodes]'
        for node in nodes: print node['dnsName']
    else:
        result = {'nodes': [node['dnsName'] for node in nodes]}
        print json.dumps(result)

