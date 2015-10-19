# geni-expt-engine
The GENI Experiment Engine (GEE) is a PlanetLab-like platform for supporting distributed experiments
by a community of users.  A GEE Portal authenticates a user using the GENI Experimental Portal
and allows the user to allocate a "slicelet".  The slicelet consists of a Docker container at 
each GEE node.  The GEE Portal uses Ansible to set up the Docker containers, and also creates
the following helper files for the user:

 * A *public/private keypair*
 * A *ssh-config* file containing short labels for each node, to make it easier for the user to login
   to the Docker container on that node.  E.g., `$ ssh -F ssh-config ig-cenic`
 * An *ansible-hosts* file containing an Ansible hosts file to make it easier to run Ansible commands 
   across the slicelet.  E.g., `$ ansible -i ansible-hosts nodes -m ping`
 * A *fabfile.py* file to make it easier to run Fabric scripts across the slicelet.  E.g., `$ fab uptime`

This repository contains code to run the GEE portal in a Docker container.

## Setting up a portal

To set up a GEE portal (e.g., for development) follow these steps:

 * Decide what port you want the portal to listen on.  Change *application_port* and *real_port* in 
   *gee-master/config.json* to point to this port.
 * Build the Docker image: `$ docker build -t portal .`
 * Run *create-portal.sh*, providing an identifying label for this portal and the listen port as 
   arguments.  If the label is *dev* and the port is *8000*: `$ create-portal.sh dev 8000`
 * Two containers will be launched, one running the portal code and the other containing the database.
   In the example above they would be *dev-portal* and *dev-mongodb*.
 * When you are ready, destroy the portal and mongodb containers using the label: `$ destroy-portal.sh dev`

