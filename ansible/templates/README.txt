The files in this tarball are intended to make it easier to interact
with your GEE slice.  You can use these tools to build a full
experiment environment customized for your own needs.  Included are:

id_rsa
------
The private SSH key for use with your GEE slice.


id_rsa.pub
----------
The public SSH key for use with your GEE slice.


ansible.cfg
-----------
Contains some useful defaults for using Ansible on the GEE.  If you
run Ansible from this directory then it will pick up the defaults in
this file.


ansible-hosts
-------------
An Ansible inventory file to make it easy to run commands across all
your GEE slivers.  Ansible is a free, open-source utility that is
available for most platforms.  It is very well documented and easy to
use.  For more information on Ansible, see:

http://docs.ansible.com/

NOTE: In order to use Ansible on GEE, openssh-clients must be installed
in your GEE slice image.  Without this you will see an error like this
when running Ansible:

/bin/bash: scp: command not found

The default image already has openssh-clients installed, but other images
may lack it.  The default fabfile.py provides an easy way to install
openssh-clients; see the next section.

Some sample Ansible commands that you can use with your GEE slice:

# To make sure all the slivers are up and you can login:
$ ansible nodes -i ansible-hosts -m ping

# To run the 'uptime' command in parallel on all slivers:
$ ansible nodes -i ansible-hosts -m shell -a "uptime"

# To install the 'iperf' package in all the slivers
$ ansible nodes -i ansible-hosts -m apt -a "name=iperf state=present"


fabfile.py
----------
A simple fabfile for use with Fabric, another open-source utility for
running parallel SSH commands.  A fabfile is just Python code that
defines Fabric "commands" which can be invoked from the shell.  For
more information on Fabric, see:

http://www.fabfile.org/

The current Fabric commands that you can run:

# To run the 'uptime' command in parallel on all slivers:
$ fab uptime

# To test that all slivers have connectivity to www.yahoo.com:
$ fab pingtest

# To install openssh-clients and any other Ansible dependencies
$ fab setup_ubuntu
-or-
$ fab setup_centos_or_fedora21
-or-
$ fab setup_fedora22
...depending on your slice image.

Use these examples to extend the fabfile according to the needs of
your experiment.

message-client.yaml
message-server.yaml
-------------------
These Ansible playbooks can be used to bring up the GEE Message
Service inside a slicelet.  You will need to choose a node in your
slicelete to install the message server on,  and edit the ansible-hosts
file to point to it by adding a couple of lines at the bottom.  For
example:

[message_server]
rutgers.gee-project.net


slice-hosts.py.j2
slice-hosts.yaml
----------------
Running the slice-hosts.yaml playbook will create a file called
"slice-hosts.py" containing the private IP addresses of all the
nodes in the slicelet:

$ ansible-playbook -i ansible-hosts slice-hosts.yaml


ssh-config
----------
SSH configuration for each sliver in the slice.  You can SSH to any
sliver using the label following the 'Host' definition, e.g.,:

$ ssh -F ssh-config pcvm3-1.instageni.metrodatacenter.com

Other commands like scp work in the same way, but it is necessary to
specify the -F option as above.


