{% for host in groups['nodes'] %}
{% if hostvars[host]['docker_containers'] is defined %}
hosts["{{ host }}"] = "{{ hostvars[host]['docker_containers'][0]['NetworkSettings']['IPAddress'] }}"
{% endif %}
{% endfor %}
