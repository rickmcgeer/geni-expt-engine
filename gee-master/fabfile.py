from fabric.api import *
env.hosts = ['bilby.cs.princeton.edu']
env.user = 'service_instageni'
host = env.hosts[0]
remote_dir = '/home/service_instageni/gee-master'
#
# change this to your private key...
#
env.key_filename = '/Users/rick/.ssh/id_dsa'


@task
def deploy():
    local('scp -i %s -r config.json *.js run-gee-server.sh start-gee-master.sh views public routes *.json %s@%s:%s' % (env.key_filename, env.user, host, remote_dir))

@task
def deploy_file(file):
    local('scp -i %s -r %s %s@%s:%s/%s' % (env.key_filename, file, env.user, host, remote_dir, file))

@task
def run_server(dir):
    run('cd %s; ./run_gee_server' % remote_dir)

@task
def check_status():
    run('ps aux | grep node')
