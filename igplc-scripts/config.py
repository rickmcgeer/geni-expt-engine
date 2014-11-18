ig_names = {'last_name':'IGPL_VTS', 'email_pattern_string': 'instagenipl+vts%s@gmail.com', 'email_wildcard_string': 'instagenipl+vts*@gmail.com'}
gee_script_path = '/home/service_instageni/'
user_script_path = '/home/service_instageni/user-scripts'
slice_nodes = [
    {'hostname':'pc24.utahddc.geniracks.net', 'label':'UTAHDDC'},
    {'hostname':'pc4.instageni.illinois.edu', 'label':'UIUC'},
    {'hostname': 'pc5.instageni.maxgigapop.net', 'label': 'MAX'}
    ]
tag_template = "[{'bridge': 'gee', 'vlan':'%d', 'IPADDR': '10.128.234.%d', 'PRIMARY': 'yes', 'NETMASK': '255.255.255.0', 'BOOTPROTO': 'static', 'DEVICE': 'eth0', 'ONBOOT': 'yes'}, {'DEVICE': 'eth1', 'BOOTPROTO': 'dhcp', 'ONBOOT': 'yes'}]"