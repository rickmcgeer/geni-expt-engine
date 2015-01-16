from fabric.api import env, run
env.hosts = [
{% for host in groups['nodes'] %}
"{{ slice }}.{{ host }}",
{% endfor %}
]

env.key_filename="./id_rsa"
env.use_ssh_config = True
env.ssh_config_path = './ssh-config'

def pingtest():
    run('ping -c 3 www.yahoo.com')

def uptime():
    run('uptime')
