from fabric.api import *
from fabric.contrib.files import exists

env.user='%SLICE%'
env.key_filename='~/.ssh/%SLICE%.pem'
env.hosts = %HOSTS%
slivers = %SLIVERS%

#
# run a job in the background
#



def run_bg(cmd, before=None, sockname="dtach", use_sudo=False):
    """Run a command in the background using dtach

    :param cmd: The command to run
    :param output_file: The file to send all of the output to.
    :param before: The command to run before the dtach. E.g. exporting
                   environment variable
    :param sockname: The socket name to use for the temp file
    :param use_sudo: Whether or not to use sudo
    """
    if not exists("/usr/bin/dtach"):
        sudo("yum  install -y dtach")
    if before:
        cmd = "{}; dtach -n `mktemp -u /tmp/{}.XXXX` {}".format(
            before, sockname, cmd)
    else:
        cmd = "dtach -n `mktemp -u /tmp/{}.XXXX` {}".format(sockname, cmd)
    if use_sudo:
        return sudo(cmd)
    else:
        return run(cmd)

def run_bg_bash(
        cmd, output_file=None, before=None, sockname="dtach", use_sudo=False):
    """Run a bash command in the background using dtach

    Although bash commands can be run using the plain :func:`run_bg` function,
    this version will ensure to do the proper thing if the output of the
    command is to be redirected.

    :param cmd: The command to run
    :param output_file: The file to send all of the output to.
    :param before: The command to run before the dtach. E.g. exporting
                   environment variable
    :param sockname: The socket name to use for the temp file
    :param use_sudo: Whether or not to use sudo
    """
    if output_file:
        cmd = "/bin/bash -c '{} > {}'".format(cmd, output_file)
    else:
        cmd = "/bin/bash -c '{}'".format(cmd)
    return run_bg(cmd, before=before, sockname=sockname, use_sudo=use_sudo)


#
# Generate the GEE Programming Environment
#


@task
def install_pip():
    with settings (warn_only=True):
	run("yum install -y python-pip")
	run("ln -s /usr/bin/pip-python /usr/bin/pip")
	
#
# A utility to pull the ip address for a given host
#
	
def get_ip_addr(hostname):
    ip_addresses = [sliver['addr'] for sliver in slivers if sliver['host'] == hostname]
    if (len(ip_addresses) == 0): return ""
    return ip_addresses[0]

#
# Generate and install the GEE Messaging Service (Beanstalk)
#

#
# Set up defaults for the server
#
env.beanstalk_server_hostname = env.hosts[0]
env.beanstalk_server = get_ip_addr(env.beanstalk_server_hostname)

#
# Install the server on all nodes
#

@task
def install_beanstalk_server():
    with settings (warn_only=True):
	run("yum install -y beanstalkd")
	
#
# install the client on all nodes
#
	
@task
def install_beanstalk_client():
    with settings (warn_only=True):
	run("yum install -y libyaml")
	run("pip-python install pyyaml")
	run("pip-python install beanstalkc")

#
# Install the GEE Programming Environment
#
@task
def install_gee_environment():
    install_pip()
    install_beanstalk_server()
    install_beanstalk_client()
    
#
# Set up the beanstalk server and start it running on
# env.beanstalk_server
#
    
@task
@hosts('localhost')
def setup_beanstalk_server():
    with settings(host_string=env.beanstalk_server_hostname):
	install_beanstalk_server()
	run('beanstalkd -l %s -p 14711 &' % env.beanstalk_server)
	
#
# Check to make sure the server is running
#

@task
@hosts(env.beanstalk_server_hostname)
def check_beanstalk_server():
    run ('netstat -tulpn')
    
#
# Setup the beanstalk clients.  This generates and
# copies to each client a beanstalk_config.py file,
# which connects to the server and establishes that they are watching
# the tube with their hostname.  After this, to use
# beanstalk, all the client will have to do is
# import('beanstalk_config.py') into his Python program
#

@task
@hosts('localhost')
def setup_beanstalk_clients():
    if not env.beanstalk_server:
	print "Warning: beanstalk_server must be set before clients can be set up"
	print "Setting default beanstalk server"
	env.beanstalk_server_hostname = env.hosts[0]
	env.beanstalk_server = get_ip_addr(env.beanstalk_server_hostname)
	setup_beanstalk_server()	
    for host in env.hosts:
	with settings(host_string = host):
	    f = open("beanstalk_config.py", "w")
	    f.write("import beanstalkc\n")
            f.write("from beanstalk_utils import *\n")
	    f.write("beanstalk = beanstalkc.Connection(host='%s', port=14711)\n" % env.beanstalk_server)
	    f.write("beanstalk.watch('%s')\n" % host)
	    f.write("client_tubes = %s\n" % str(env.hosts))
	    f.write("server_tube = 'server'\n")
	    f.close()
	    local("scp -i %s beanstalk_config.py beanstalk_utils.py %s@%s:." % (env.key_filename, env.user, host))


# Install the 'nmap' RPM on all hosts
@task
def install_nmap():
    run("sudo yum -qy install nmap")

# Run 'nmap' on the private network on each host.
# See what other hosts are reachable at L2 on the private net.
@task
def nmap():
    run("echo My IP addresses:")
    run("ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1'")
    run("echo")
    run("echo Hosts reachable on the private subnet:")
    run("nmap -sP 10.128.234.0/24")
    
#------------------------------------------------------------------------------------------------
# Experimenter code here
#

# Your experiment script goes here...
@task
def run_expt():
    # run('curl http://66.92.233.109:8080/host')
    # run('ifconfig -a | grep  inet | grep :10')
    # put the commands you want to run here...
    pass


