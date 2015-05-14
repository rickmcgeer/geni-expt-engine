#!/bin/bash
# script to start the GEE webserver
export GEE_CONFIG_FILE='/root/test/config.py'
nohup /usr/bin/nodejs app.js >> gee_console.log 2>> gee_console_error.log &
