#!/usr/bin/python
# Run continuously, getting the auto-added names from the DB and adding them to the 
execfile('namecheap-lib.py')

if __name__ == '__main__':
    lastHosts = []
    count = 0
    while True:
        newHosts = hostsFromDB()
        if (len(newHosts) != len(lastHosts)):
            doUpdate(newHosts)
            count = 0
        elif (listsChanged(newHosts, lastHosts)):
            doUpdate(newHosts)
            count = 0
        elif (count == 10):
            doUpdate(newHosts)
            count = 0
        else: count += 1
        lastHosts = newHosts
        time.sleep(60)
