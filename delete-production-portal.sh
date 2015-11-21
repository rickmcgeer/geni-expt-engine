#!/bin/bash

usage(){
    echo "Usage: $0 tag"
    echo "       tag is used to name the mongodb and portal containers"
    exit 1
}

[[ $# -ne 1 ]] && usage

TAG=$1

echo "Stopping containers:"
# docker stop $TAG-mongodb
docker stop $TAG-portal

echo ""
echo "Removing containers:"
# docker rm $TAG-mongodb
docker rm $TAG-portal

