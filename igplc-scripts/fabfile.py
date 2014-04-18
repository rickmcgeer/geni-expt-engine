from fabric.api import local
host = 'bilby.cs.princeton.edu'
user = 'service_instageni'
remote_dir = '/home/service_instageni/'
remote_dir_test = '/home/service_instageni/test'
#
# change this to your private key...
#
keyfile = '/Users/rick/.ssh/id_dsa'
def deploy():
    local('scp -i %s -r *.plcsh %s@%s:%s' % (keyfile, user, host, remote_dir))

def deploy_file(file):
    local('scp -i %s -r %s %s@%s:%s/%s' % (keyfile, file, user, host, remote_dir, file))
    
def deploy_test():
    local('scp -i %s -r *.plcsh %s@%s:%s' % (keyfile, user, host, remote_dir_test))

def deploy_file_test(file):
    local('scp -i %s -r %s %s@%s:%s/%s' % (keyfile, file, user, host, remote_dir_test, file))