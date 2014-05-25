#!/bin/bash
while true; do
  /usr/local/bin/node app.js >> gee_console.log 2>> gee_error_console.log
  # When you get here the process has died.  start
  # the loop again and restart it
done