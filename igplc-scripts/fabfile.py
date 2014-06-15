from fabric.api import local, task
host = 'bilby.cs.princeton.edu'
user = 'service_instageni'
remote_dir = '/home/service_instageni/'
remote_config_file_dir = '/home/service_instageni'

#
# change this to your private key...
#
keyfile = '/Users/rick/.ssh/id_dsa'

@task
def deploy():
    local('scp -i %s   *.plcsh %s@%s:%s' % (keyfile, user, host, remote_dir))
    local('scp -i %s config.py %s@%s:%s/config.py' % (keyfile,  user, host, remote_config_file_dir))

@task
def deploy_file(file):
    if (file == "config.py"):
        local('scp -i %s config.py %s@%s:%s/config.py' % (keyfile, user, host, remote_config_file_dir))
    else:
        local('scp -i %s -r %s %s@%s:%s/%s' % (keyfile, file, user, host, remote_dir, file))
    

    
def test_gee_script(script):
    run('export GEE_CONFIG_FILE=%s/config.py; cd %s; %s' % (remote_config_file_dir, remote_dir, script))
    
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
    test_gee_script(cmd)

                                   
    
