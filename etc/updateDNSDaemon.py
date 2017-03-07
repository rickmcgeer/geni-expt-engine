#!/usr/bin/python
# Run continuously, getting the auto-added names from the DB and adding them to the 
execfile('namecheap-lib.py')

if __name__ == '__main__':
    lastHosts = []
    while True:
        newHosts = hostsFromDB()
        if (len(newHosts) != len(lastHosts)):
            doUpdate(newHosts)
        elif (listsChanged(newHosts, lastHosts)):
                doUpdate(newHosts)
        lastHosts = newHosts
        time.sleep(60)
