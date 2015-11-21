#!/bin/bash

usage(){
    echo "Usage: $0 tag port"
    echo "       tag is used to name the portal container"
    echo "       port is the external port to listen on"
    exit 1
}

[[ $# -ne 2 ]] && usage

TAG=$1
PORT=$2

# docker run -d --name $TAG-mongodb geeproject/gee_db_server

# sleep 10

docker run -d --name $TAG-portal -p $PORT:$PORT --link $TAG-mongodb:mongodb -v /root/ssh:/root/.ssh:ro -v /root/slice_files:/root/slice_files portal
