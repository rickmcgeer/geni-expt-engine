from fabric.api import env, run
env.hosts = [
{% for host in groups['nodes'] %}
  {% if hostvars[host]['docker_containers'] is defined %}
"{{ host }}",
  {% endif %}
{% endfor %}
]

env.key_filename="./id_rsa"
env.use_ssh_config = True
env.ssh_config_path = './ssh-config'

def pingtest():
    run('ping -c 3 www.yahoo.com')

def uptime():
    run('uptime')

def setup_ubuntu():
    run('apt-get update; apt-get -y install openssh-client python')

def setup_centos_or_fedora21():
    run('yum -y install openssh-clients')

def setup_fedora22():
    run('dnf -y install openssh-clients')
