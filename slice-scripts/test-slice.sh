#!/bin/bash

slice=$1
[ $# -eq 0 ] && { echo "Usage: $0 slice_name"; exit 1; }

slicedir=/home/ubuntu/slices/$1

ansible -i $slicedir/hosts --private-key=$slicedir/id_rsa -m ping -u root nodes
