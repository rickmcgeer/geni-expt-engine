from fabric.api import *
env.hosts = ['bilby.cs.princeton.edu']
env.user = 'service_instageni'
#
# change this to your private key...
#
env.key_file_name = '/Users/rick/.ssh/id_dsa'
remote_dir = '/home/service_instageni/gee-master'
remote_dir_test = '/home/service_instageni/test/gee-master'
remote_dir_alternate = '/home/service_instageni/alternate/gee-master'
json_config_file_standard = 'config.json.standard'
json_config_file_alternate = 'config.json.alternate'




def deploy_internal(remote_dir, json_config_file):
    local('scp -i %s -r *.js run-gee-server.sh start-gee-master.sh views public routes *.json %s@%s:%s' % (env.key_filename, env.user, host, remote_dir))
    local('scp -i %s %s %s@%s:%s/config.json' % (env.key_filename, json_config_file, env.user, host, remote_dir))

def deploy_file_internal(file, remote_dir, json_config_file):
    if (file == 'config.json'):
        local('scp -i %s %s %s@%s:%s/config.json' % (env.key_filename, json_config_file, env.user, host, remote_dir))
    else:
        local('scp -i %s -r %s %s@%s:%s/%s' % (env.key_filename, file, env.user, host, remote_dir, file))

@task
def deploy():
    deploy_internal(remote_dir, json_config_file_standard )

@task
def deploy_file(file):
    deploy_file_internal(file, remote_dir, json_config_file_standard )

@task    
def deploy_test():
    deploy_internal(remote_dir_test, json_config_file_standard )

@task   
def deploy_file_test(file):
    deploy_file_internal(file, remote_dir, json_config_file_standard )

@task
def deploy_alternate():
    deploy_internal(remote_dir_alternate, json_config_file_alternate)

@task  
def deploy_file_alternate(file):
    deploy_file_internal(file, remote_dir_alternate, json_config_file_alternate)

def run_server_internal(dir):
    run('cd %s; ./run_gee_server' % dir)

@task
def run_server():
    run_server_internal(remote_dir)
    
@task
def run_server_alternate():
    run_server_internal(remote_dir_alternate)
