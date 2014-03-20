from fabric.api import local
host = 'bilby.cs.princeton.edu'
user = 'service_instageni'
remote_dir = '/home/service_instageni/gee-master'
keyfile = '/Users/rick/.ssh/id_dsa'
def deploy():
    local('scp -i %s -r *.js views public package.json %s@%s:%s' % (keyfile, user, host, remote_dir))

def deploy_file(file):
    local('scp -i %s -r %s %s@%s:%s/%s' % (keyfile, file, user, host, remote_dir, file))