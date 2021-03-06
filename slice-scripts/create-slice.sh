#!/bin/bash

SLICE=$1
TARBALL=$2
IMAGE=$3
PORTS=$4  # Looks like ["8000:8000","9001:9001"] with no whitespace
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
ANSIBLEDIR=$DIR/../ansible
LOGDIR=/var/log/gee
LOGFILE=$LOGDIR/$SLICE-create.log

[ $# -eq 0 ] && { echo "Usage: $0 slice_name"; exit 1; }
[ "$PORTS" == "" ] && { PORTS='[]'; }
EXPOSE=$( echo $PORTS|sed 's/[0-9]*://g' - )

export ANSIBLE_CONFIG=$ANSIBLEDIR/ansible.cfg
mkdir -p $LOGDIR
echo Run: `date` >> $LOGFILE
ansible-playbook -f 20 -i $ANSIBLEDIR/dynInventory.py $ANSIBLEDIR/create-slice.yml --extra-vars "slice=$SLICE tarball=$TARBALL docker_image=$IMAGE ports=$PORTS expose=$EXPOSE" >> $LOGFILE

# Tolerate dark hosts (exit code 3 from Ansible)
# In 2.2.0.0, exit code 4
RESULT=$?
[ $RESULT -eq 4 ] && { exit 0; }
[ $RESULT -eq 3 ] && { exit 0; }
exit $RESULT
