#!/bin/bash

SLICE=$1
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

[ $# -eq 0 ] && { echo "Usage: $0 slice_name"; exit 1; }

SLICEDIR=/root/slices/$SLICE

ansible -i $SLICEDIR/ansible-hosts --private-key=$SLICEDIR/id_rsa -m ping -u root nodes
