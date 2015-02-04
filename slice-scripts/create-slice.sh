#!/bin/bash

SLICE=$1
TARBALL=$2
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
ANSIBLEDIR=$DIR/../ansible
LOGDIR=/var/log/gee
LOGFILE=$LOGDIR/$SLICE-create.log

[ $# -eq 0 ] && { echo "Usage: $0 slice_name"; exit 1; }

mkdir -p $LOGDIR
echo Run: `date` >> $LOGFILE
ansible-playbook -f 20 -i $ANSIBLEDIR/hosts $ANSIBLEDIR/create-slice.yml --extra-vars "slice=$SLICE tarball=$TARBALL" >> $LOGFILE

# Tolerate dark hosts (exit code 3 from Ansible)
RESULT=$?
[ $RESULT -eq 3 ] && { exit 0; }
exit $RESULT