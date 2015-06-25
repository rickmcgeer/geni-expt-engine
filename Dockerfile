# Use phusion/baseimage as base image. To make your builds reproducible, make
# sure you lock down to a specific version, not to `latest`!
# See https://github.com/phusion/baseimage-docker/blob/master/Changelog.md for
# a list of version numbers.
FROM phusion/baseimage:0.9.16

# Set correct environment variables.
ENV HOME /root

# Regenerate SSH host keys. baseimage-docker does not contain any, so you
# have to do that yourself. You may also comment out this instruction; the
# init system will auto-generate one during boot.
# RUN /etc/my_init.d/00_regen_ssh_host_keys.sh

# ...put your own build instructions here...
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y npm
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y python-pip
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y supervisor
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb-clients

# Install Ansible
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y software-properties-common
RUN DEBIAN_FRONTEND=noninteractive apt-add-repository -y ppa:ansible/ansible
RUN apt-get update
RUN DEBIAN_FRONTEND=noninteractive apt-get install -y ansible

RUN pip install pymongo

ADD . /root/geni-expt-engine

RUN cd /root/geni-expt-engine/gee-master; npm install
RUN cd /root/geni-expt-engine/gee-master; npm install mongoose-auto-increment

ADD etc/portal.conf /etc/supervisor/conf.d/
ADD etc/rc.local /etc/rc.local

RUN mkdir /var/log/gee
RUN mkdir /root/slice_files

EXPOSE 80

# Clean up APT when done.
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
