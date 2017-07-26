#!/bin/bash

SLICE=$1
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
ANSIBLEDIR=$DIR/../ansible
LOGDIR=/var/log/gee
LOGFILE=$LOGDIR/$SLICE-delete.log

[ $# -eq 0 ] && { echo "Usage: $0 slice_name"; exit 1; }

export ANSIBLE_CONFIG=$ANSIBLEDIR/ansible.cfg
mkdir -p $LOGDIR
echo Run: `date` >> $LOGFILE
ansible-playbook -f 20 -i $ANSIBLEDIR/dynInventory.py $ANSIBLEDIR/delete-slice.yml --extra-vars "slice=$SLICE" >> $LOGFILE

# Tolerate dark hosts (exit code 3 from Ansible)
# In 2.2.0.0, exit code 4
RESULT=$?
[ $RESULT -eq 4 ] && { exit 0; }
[ $RESULT -eq 3 ] && { exit 0; }
exit $RESULT
