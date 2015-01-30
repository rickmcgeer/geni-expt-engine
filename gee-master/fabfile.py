from fabric.api import *
#env.hosts = ['bilby.cs.princeton.edu']
env.hosts = ['instance-00000005@node56.stanford.vicci.org']
#env.user = 'service_instageni'
env.user = 'ubuntu'
host = env.hosts[0]
remote_dir = '/home/service_instageni/gee-master'
#
# change this to your private key...
#
env.key_filename = '/Users/rick/.ssh/id_rsa'
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


@task
def deploy():
    local('scp -i %s -r config.json *.js run-gee-server.sh start-gee-master.sh views public routes *.json %s@%s:%s' % (env.key_filename, env.user, host, remote_dir))

@task
def deploy_file(file):
    local('scp -i %s -r %s %s@%s:%s/%s' % (env.key_filename, file, env.user, host, remote_dir, file))

@task
def run_server():
    run_bg('cd %s; ./run-gee-server.sh' % remote_dir)

@task
def check_status():
    run('ps aux | grep node')
