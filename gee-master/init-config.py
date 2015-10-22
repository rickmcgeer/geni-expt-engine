#!/usr/bin/python
import json
import sys

#
# A utility to initialize the config.json file for gee-master with the port number being used
# for the portal.  Just reads the config.json file, parses the given port number,  and then
# writes the config.json file back with the new port number in the applicaton_port and real_port
# fields.  Should be run before the portal is initialized and after the container has been allocated
# Usage:  init-conf.py portNumber\n\twhere portNumber is an integer in the range (1,65535)
# No effect if more than one argument is specified or the argument is a bad value.
#

#
# get the port number from the argument string and exit if there is an error (bad value or
# bad number of arguments).  Returns the port number if everything checks out
#

def getPortNum(args):
	usageString = 'usage: init-conf.py portNumber\n\twhere portNumber is an integer in the range (1,65535)'
	if (len(args) != 2):
		print usageString
		print '\t found %d arguments in %s' % (len(args), ' '.join(args))
		exit(1)
	try:
		portNum = int(args[1])
		if ((portNum > 0) and (portNum <= 65535)):
			return portNum
	except ValueError:
		pass
	# If we get here, we got a value error or a bad value
	# so print an error message and exit
	print usageString
	print '\t had one argument but it was either not an integer or a bad value'
	print '\t given command line: ' + ' '.join(args)
	exit(1)

#
# Parse the port number, read the configuration file into the variable config,
# write the port fields, then dump the json structure into the config file.
# Doesn't error-check the file open, read, write, close -- if this fails we have
# much bigger problems
#

if __name__ == '__main__':
	portNum = getPortNum(sys.argv)
	configFile = open('config.json', 'r')
	config = json.load(configFile)
	configFile.close()
	config['application_port'] = config['real_port'] = portNum
	configFile = open('config.json', 'w')
	json.dump(config, configFile)
	configFile.close()
