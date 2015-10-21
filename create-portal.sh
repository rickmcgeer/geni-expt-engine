#!/bin/bash

usage(){
    echo "Usage: $0 tag container-port host-port"
    echo "       tag is used to name the mongodb and portal containers"
    echo "       host-port is the external port to listen on, and is bound to container port container-port"
    exit 1
}

[[ $# -ne 3 ]] && usage

TAG=$1
PORT=$2
HOST_PORT=$3

docker run -d --name $TAG-mongodb geeproject/gee_db_server

sleep 10 

docker run -d --name $TAG-portal -p $HOST_PORT:$PORT --link $TAG-mongodb:mongodb -v /root/ssh:/root/.ssh:ro portal
