from fabric.api import *
env.hosts = ['bilby.cs.princeton.edu']
env.user = 'service_instageni'
host = env.hosts[0]
remote_dir = '/home/service_instageni/'
remote_config_file_dir = '/home/service_instageni/test'

#
# change this to your private key...
#
env.key_filename = '/Users/rick/.ssh/id_dsa'

@task
def deploy():
    local('scp -i %s   *.plcsh %s@%s:%s' % (env.key_filename, env.user, host, remote_dir))
    local('scp -i %s config.py %s@%s:%s/config.py' % (env.key_filename,  env.user, host, remote_config_file_dir))

@task
def deploy_file(file):
    if (file == "config.py"):
        local('scp -i %s config.py %s@%s:%s/config.py' % (env.key_filename, env.user, host, remote_config_file_dir))
    else:
        local('scp -i %s -r %s %s@%s:%s/%s' % (env.key_filename, file, env.user, host, remote_dir, file))
    

    
def test_gee_script(script):
    run('export GEE_CONFIG_FILE=%s/config.py; cd %s; %s' % (remote_config_file_dir, remote_dir, script))
    
def form_command_line(script, email_addr, slice):
    if (script == 'find-slicelets.plcsh'):
        return './'+script
    elif (script == 'renew-gee-slice.plcsh'):
        return "./%s -- -s %s" % (script, slice)
    else:
        return "./%s -- -e %s" % (script, email_addr)
    

@task
def test_script(script, email_addr=None, slice=None):
    cmd = form_command_line(script, email_addr, slice)
    test_gee_script(cmd)

                                   
    
