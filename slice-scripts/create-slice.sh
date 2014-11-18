#!/bin/bash

slice=$1
docker_image=$2
[ $# -eq 0 ] && { echo "Usage: $0 slice_name"; exit 1; }

ansible-playbook -i ansible/hosts ansible/create-slice.yml --extra-vars "slice=$1"
