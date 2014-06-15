#!/bin/bash
export GEE_CONFIG_FILE='/home/service_instageni/test/config.py'
while true; do
  /usr/local/bin/node app.js >> gee_console.log 2>> gee_console_error.log
  # When you get here the process has died.  start
  # the loop again and restart it
done