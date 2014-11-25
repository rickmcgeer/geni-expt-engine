#!/bin/bash

SLICE=$1
TARBALL=$2
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
ANSIBLEDIR=$DIR/../ansible

[ $# -eq 0 ] && { echo "Usage: $0 slice_name"; exit 1; }

ansible-playbook -i $ANSIBLEDIR/hosts $ANSIBLEDIR/create-slice.yml --extra-vars "slice=$SLICE tarball=$TARBALL"
