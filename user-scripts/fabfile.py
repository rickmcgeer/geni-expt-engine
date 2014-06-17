from fabric.api import *

env.user='%SLICE%'
env.key_filename='~/.ssh/%SLICE%.pem'
env.hosts = [
    'pc3.instageni.rnoc.gatech.edu',
    'pc32.utahddc.geniracks.net',
    'pc5.geni.it.cornell.edu',
    ]

slivers = [
	{'host': 'pc3.instageni.rnoc.gatech.edu', 'addr': '10.128.234.1'}, 
	{'host': 'pc32.utahddc.geniracks.net', 'addr': '10.128.234.2'}, 
	{'host': 'pc5.geni.it.cornell.edu', 'addr': '10.128.234.3'},
	]


# Install the 'nmap' RPM on all hosts
@task
def prepare():
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

# Your experiment script goes here...
@task
def run_expt():
    # run('curl http://66.92.233.109:8080/host')
    # run('ifconfig -a | grep  inet | grep :10')
    # put the commands you want to run here...
    pass
