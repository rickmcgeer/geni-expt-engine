Welcome to the GEE files folder.  In this you will find:

(1) A .pem file.  This is your credential for accessing your GEE experiment.

(2) fabfile.py.  This is a fabric file (http://fabfile.org).

(3) network.py.  This file defines symbolic constants for the
addresses in your GEE slicelet.

First, copy the .pem file to your ~/.ssh directory, and then change
its mode to 600.  After that, you'll be able to ssh in to a sliver on
your slicelet with the command:

$ ssh -i ~/.ssh/<filename>.pem <user>@<hostname>

where <hostname> is the name of the host (see env.hosts in fabfile.py
for the list) and <user> is the name of your slicelet (see env.user in
fabfile.py)

Fabric is a convenience for you: it will run a set of commands via SSH
across all or some of the hosts in your slicelet.  For details, see
the Fabric tutorial referenced above.  You should be familiar with
Python programming before attempting to use fabric.

Otherwise, slivers in your GEE slicelet are simply Fedora containers,
somewhat bare.  Python and yum are installed ahead of time.

You can make outbound requests on the public-internet interface on
your slivers (this will have an IP address of 192.168.122.X in the
slice) and can host services on the private-network interface on any
port.  The private-network IP addresses you can find in both
fabfile.py and network.py
