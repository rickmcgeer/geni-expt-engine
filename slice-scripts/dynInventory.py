#!/usr/bin/python
# script to get the host inventory for the GEE dynamically from the node collection in the database.  Designed to be called by
# ansible, so the usage is dictacted by Ansible.  See: http://docs.ansible.com/ansible/intro_dynamic_inventory.html and
# http://docs.ansible.com/ansible/developing_inventory.html
# To use with ansible, use in place of a static file, e.g.
# ansible -i dynInventory.py nodes -m ping
# Usage:
# dynInventory --list 
#     returns a JSON dictionary of lists of hosts
# dynInventory --host hostname
#     returns information about host hostname as a dictionary
# Currently, the --list form only returns one entry, 'nodes', and --host hostname always returns an empty dictionary
import argparse
import json
from pymongo import MongoClient, ReturnDocument
def parse_args():
    parser = argparse.ArgumentParser(description='Dynamic Inventory From GEE Database')
    parser.add_argument('--generateInventory', action='store_true', default=False,
                        help='Generate a static inventory file')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--list', action='store_true',
                       help='List active servers')
    group.add_argument('--host', help='List details about the specific host')
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
    if args.list:
        return {'nodes': getAllNodes()}
    elif args.host:
        return {}

if __name__ == '__main__':
    args = parse_args()
    if args.list:
        result = {'nodes': getAllNodes()}
    else:
        result = {}
    if args.generateInventory:
        if 'nodes' in result:
            print '[nodes]'
            for node in result['nodes']: print node
    else:
        print json.dumps(result)

