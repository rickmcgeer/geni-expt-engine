#!/bin/bash

slice=$1
[ $# -eq 0 ] && { echo "Usage: $0 slice_name"; exit 1; }

ansible-playbook -i ansible/hosts ansible/delete-slice.yml --extra-vars "slice=$1"
