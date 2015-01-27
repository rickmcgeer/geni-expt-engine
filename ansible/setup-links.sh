#!/bin/bash

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

usage () 
{
    echo "Usage: $0 [ production | devel ]"
    echo "  production  - set up production server"
    echo "  devel       - set up devel server"
}

if [ "$#" -ne 1 ]; then
    usage 
    exit 1
fi

if [ "$1" != "production" ] && [ "$1" != "devel" ]; then
    usage
    exit 1
fi

rm $DIR/group_vars/all
ln -s $DIR/group_vars/all.$1 $DIR/group_vars/all

rm $DIR/hosts
ln -s $DIR/hosts.$1 $DIR/hosts

exit 0

