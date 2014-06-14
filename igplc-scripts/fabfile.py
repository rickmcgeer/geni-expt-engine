from fabric.api import local, task
host = 'bilby.cs.princeton.edu'
user = 'service_instageni'
remote_dir = '/home/service_instageni/'
remote_dir_test = '/home/service_instageni/test/'
remote_dir_alternate = '/home/service_instageni/alternate/'
config_file_standard = 'config.py.standard'
config_file_alternate = 'config.py.alternate'

#
# change this to your private key...
#
keyfile = '/Users/rick/.ssh/id_dsa'

def deploy_internal(remote_dir, config_file):
    local('scp -i %s  *.plcsh %s@%s:%s' % (keyfile, user, host, remote_dir))
    local('scp -i %s  %s %s@%s:%sconfig.py' % (keyfile, config_file, user, host, remote_dir))
    local('scp -i %s  %s %s@%s:%sgee-master/config.py' % (keyfile, config_file, user, host, remote_dir))

def deploy_file_internal(file, remote_dir, config_file):
    if (file == "config.py"):
        local('scp -i %s %s %s@%s:%sconfig.py' % (keyfile, config_file, user, host, remote_dir))
        local('scp -i %s  %s %s@%s:%sgee-master/config.py' % (keyfile, config_file, user, host, remote_dir))
    else:
        local('scp -i %s -r %s %s@%s:%s/%s' % (keyfile, file, user, host, remote_dir, file))
    
@task
def deploy():
    deploy_internal(remote_dir, config_file_standard)

@task
def deploy_file(file):
    deploy_file_internal(file, remote_dir, config_file_standard)

@task
def deploy_test():
    deploy_internal(remote_dir_test, config_file_standard)

@task
def deploy_file_test(file):
    deploy_file_internal(file, remote_dir_test, config_file_standard)
    
@task 
def deploy_alternate():
    deploy_internal(remote_dir_alternate, config_file_alternate)
    
@task
def deploy_file_alternate(file):
    deploy_file_internal(file, remote_dir_alternate, config_file_alternate)
    
def test_gee_script(script, remote_dir):
    run('cd %s; %s' % (remote_dir, script))
    
def form_command_line(script, user, slice):
    if (script == 'find-slicelets.plcsh'):
        return script
    elif (script == 'renew-gee-slice.plcsh'):
        return "%s -- -s %s" % (script, slice)
    else:
        return "%s -- -e %s" % (script, user)
    

@task
def test_script(script, user=None, slice=None):
    cmd = form_command_line(script, user, slice)
    test_gee_script(cmd, remote_dir_standard)

@task
def test_script_alternate(script, user=None, slice=None):
    cmd = form_command_line(script, user, slice)
    test_gee_script(cmd, remote_dir_alternate)
                                   
    
