#!/bin/bash

SLICE=$1
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
ANSIBLEDIR=$DIR/../ansible

[ $# -eq 0 ] && { echo "Usage: $0 slice_name"; exit 1; }

ansible-playbook -f 20 -i $ANSIBLEDIR/hosts $ANSIBLEDIR/delete-slice.yml --extra-vars "slice=$SLICE"

# Tolerate dark hosts (exit code 3 from Ansible)
RESULT=$?
[ $RESULT -eq 3 ] && { exit 0; }
exit $RESULT