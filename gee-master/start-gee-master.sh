#!/bin/bash
# script to start the GEE webserver
nohup node app1.js >> gee_console.log 2>> gee_console_error.log &
