#!/usr/bin/python
import requests
import os
import os.path
import json
import pymongo
import time
import datetime
#
# setup dictionary with authentication
# 
def authDictionary():
    return {'z_username': monitUsername, 'z_password': monitPassword, 'z_csrf_protection':'off'}

def setupCookie():
    response = requests.get(monitURL + 'index.csp')
    # print response.status_code
    return response.cookies['zsessionid']

def doCommand(command, sessionCookie):
    cookies = dict(zsessionid = sessionCookie)
    response = requests.post(monitURL + command, data=authDictionary(), cookies=cookies)
    return response

def setupSecurity(sessionCookie):
    return doCommand('z_security_check', sessionCookie)

def getStatus(sessionCookie):
    return doCommand('status/hosts/list', sessionCookie)

def getRecords(sessionCookie):
    response = getStatus(sessionCookie)
    if (response.status_code != 200): return None
    if (response.headers['Content-Type'] == 'text/html'): return None
    return json.loads(response.text)['records']

def printStatusPage(records):
    statusPage = open('/root/geni-expt-engine/gee-master/public/statusPage.html', 'w')
    statusPage.write('<!DOCTYPE HTML>\n<HTML>\n<HEAD>\n<TITLE>GEE Status Page</TITLE>\n')
    statusPage.write("<link href='/styles/main.css' rel='stylesheet' type='text/css'/>\n")
    statusPage.write("<link href='http://fonts.googleapis.com/css?family=PT+Sans' rel='stylesheet' type='text/css'/>\n")
    statusPage.write('</HEAD>\n<BODY>')
    statusPage.write("<a href=/><img src='/images/GEELogoFinal.png' alt='GEE Logo'/></a>\n")
    now = datetime.datetime.now()
    statusPage.write("<H1>GEE Node Status as Of %s</H1>\n" % now.strftime('%c'))
    if (records):
        statusPage.write('<table border=1>\n<tr>\n<th>Node</th><th>Status</th><th>CPU</th><th>Memory</th>\n</tr>\n')
        for record in records:
            statusPage.write('<tr>\n<td>%s</td><td>%s</td><td>%s</td><td>%s</td>\n</tr>\n' % (record['hostname'], record['status'], record['cpu'], record['mem']))
        statusPage.write('</table>\n')
    else:
        statusPage.write('<p>No records retrieved!</p>\n')
    statusPage.write('<a href="/">Main Page</a>\n</BODY>\n</HTML>')
    statusPage.close()


client = pymongo.MongoClient('mongodb://mongodb:27017/')
db = client.gee_master
nodeCollection = db.nodes
execfile('monit.config.py')


if __name__ == '__main__':
    while True:
        c = setupCookie()
        r = setupSecurity(c)
        if r.status_code == 200:
            records = getRecords(c)
            newRecords = []
            for record in records:
                hostname = record['hostname']
                nodeCollection.update_one({'sshNickname':hostname}, {'$set': {'status': record}})
                dbNode = nodeCollection.find_one({'sshNickname': hostname})
                if (dbNode):
                    newRecords.append({'hostname': dbNode['dnsName'], 'status': record['status'], 'cpu': record['cpu'], 'mem': record['mem']})
        printStatusPage(newRecords)
        time.sleep(60)




