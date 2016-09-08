#!/usr/bin/python
# add-node-self.py -dnsName <dnsName> -siteName siteName -nickname <sshNickname>
# DNSName for the new node.  Should be a single name or, if fully-qualified, end in .gee-project.net
# add-node-self.py -dnsName washington -siteName washington -nickname ig-uwashington
# add-node-self.py -dnsName washington.gee-project.net -siteName washington -nickname ig-uwashington
# Both generate a node with  washington.gee-project.net which will appear as ig-uwashington in the ssh file
# siteName and/or nickname can be omitted; if so they will default to the unqualified dns name
# add-node-self.py -dnsName washington
# add-node-self.py -dnsName washington.gee-project.net 
# Both generate a node with  washington.gee-project.net which will appear as washington in the ssh file
# just updates the database; a daemon will have to update the ssh/ansible file

import sys
import json
import argparse
import urllib2


#
# Get my ipaddress
#
def getIP():
    try:
        resultString = urllib2.urlopen('http://api.ipify.org?format=JSON').read()
        # return json.loads(resultString)['ip']
        return resultString
    except Exception as e:
        print 'Failed to get local IP address, exiting, error message is ' + e.message

#
# An exception that is tossed for an error
#

class ValidationError(Exception):
    pass

#
# make sure IP Address is a valid IP address
#

def checkIP(aString):
    fields = aString.split('.')
    if (len(fields) != 4):
        raise ValidationError('Bad IP Address ' + aString + '.  Must have four fields, not %d' % len(fields))
    try:
        numbers = [int(field) for field in fields]
    except ValueError:
        raise ValidationError('Non-numeric field in IP Address ' + aString)
    for field in numbers:
        if (field < 0 or field > 255):
            raise ValidationError('IP Address Component %d not permitted in iP Address %s' % (field, aString))
    return aString

#
# Make sure a name (aString) is a valid hostname for dnsName or an sshNickname.  Raises a ValidationError if invalid.
# fieldName is for error-reporting: it's the field we're checking (either dnsName or sshNickname)
#
def checkName(aString, fieldName):
    firstChar = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    allChars = firstChar + '0123456789-_'
    #
    # maybe conservative, but what the heck
    #
    if (len(aString) < 1):
        raise ValidationError("%s must be a non-empty string" % fieldName)
    if firstChar.find(aString[0]) < 0:
        raise ValidationError('First character of field %s must be in %s, not %s' % (fieldName, firstChar, aString[0]))
    for char in aString[1:]:
        if allChars.find(char) < 0:
            raise ValidationError('Characters in %s must be from the set %s, not %s' % (fieldName, allChars, char))
    return aString
#
# Return the stripped version of an FQDN ending in '.gee-project.net'.  If it doesn't end in '.gee-project.net'
# just return the string itself
#
def stripDNSName(aName):
    if (aName.endswith('.gee-project.net')):
        return aName[:-len('.gee-project.net')]
    else:
        return aName


#
# makeDNSName(aName): make aName into aName.gee-project.net if aName.gee-project.net won't give dns heartburn.
# uses checkName for that, and throws a ValidationError otherwise
#
def makeDNSName(aName):
    aName = stripDNSName(aName)
    checkName(aName, 'DNSName')
    return aName + '.gee-project.net'

requestHeader = 'http://www.gee-project.org:9999/rest/add_node'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Add myself to the GEE')
    parser.add_argument('-dnsName', type=str, nargs=1, required=True, help='DNSName for the new node.  Should be a single name or, if fully-qualified, end in .gee-project.net')
    parser.add_argument('-nickname', type=str, nargs=1, required=False, help='SSH Nickname for the new node.  Should be shell-friendly as it will be used in command lines')
    parser.add_argument('-siteName', type=str, nargs=1, required=False, help='Site name for the new node.  For documentation purposes only')
    args = parser.parse_args()
    ip = getIP()
    try:
        dnsName = makeDNSName(args.dnsName[0])
        siteName = nickname = stripDNSName(args.dnsName[0])
        if (args.nickname): nickname = args.nickname[0]
        if (args.siteName): siteName = args.siteName[0]
        checkName(nickname, 'sshNickname')
        if ip:
            argString = '?ipAddress=%s&sshNickname=%s&dnsName=%s&siteName=%s' % (ip, nickname, dnsName, siteName)
            requestURL  = requestHeader + argString
            resultString = urllib2.urlopen(requestURL).read()
            result = json.loads(resultString)
            if (result['success']):
                print 'Successfully added node at ip address %s with DNS Name %s and ssh nickname %s' % (ip, dnsName, nickname)
            else:
                print 'add node failed with message %s' % result['message']
        else:
            print 'Could not determine local IP address, aborting'
    except Exception as e:
        print 'Failed to add node, exception is %s' % str(e)

