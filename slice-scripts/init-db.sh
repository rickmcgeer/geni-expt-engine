#!/bin/sh
# A little utility to initialize the users in the gee portal database
# with the admins (Andy, Rick, Matt)
./create-or-modify-user.py -user acb@cs.princeton.edu -admin
./create-or-modify-user.py -user rick@mcgeer.com -admin
./create-or-modify-user.py -user discount-yoyos@gmail.com -admin
