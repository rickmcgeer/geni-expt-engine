#!/bin/bash
# script to start the GEE webserver
export GEE_CONFIG_FILE='/home/service_instageni/test/config.py'
nohup /usr/local/bin/node app.js >> gee_console.log 2>> gee_console_error.log &
