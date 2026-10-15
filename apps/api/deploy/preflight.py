"""Read-only checks: no container/config belonging to another project is changed."""
import json
import re
import subprocess
import sys
import socket
from pathlib import Path
from environment import read_env

PROJECT = 'domainexp_app'
CONTAINER = 'domainexp_app_backend'
POSTGRES = 'domainexp_app_postgres'
VOLUME = 'domainexp_app_pgdata'
CENTRAL = 'gymproplus-nginx-1'
DOMAIN = 'app.domainexp.info'
TARGET = '/etc/nginx/conf.d/app.domainexp.info.conf'


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.PIPE)


def fail(message):
    raise RuntimeError(message)


def main():
    port = sys.argv[1]
    if port != '5011':
        fail('BACKEND_HOST_PORT must be the reserved DomainExp port 5011')
    if {entry[4][0] for entry in socket.getaddrinfo(DOMAIN, 443, type=socket.SOCK_STREAM)} != {'200.234.45.233'}:
        fail('Domain DNS must point only to the expected production VPS')
    config = Path(__file__).with_name('nginx').joinpath(DOMAIN + '.conf').read_text()
    names = re.findall(r'\bserver_name\s+([^;]+);', config)
    if names != [DOMAIN, DOMAIN] or re.search(r'\bdefault_server\b', config) or '*' in ' '.join(names):
        fail('Prospective Nginx config must contain only the two exact domain server blocks')
    ids = run('docker', 'ps', '-aq').split()
    containers = json.loads(run('docker', 'inspect', *ids)) if ids else []
    central = next((c for c in containers if c['Name'].lstrip('/') == CENTRAL), None)
    if not central or not central['State']['Running']:
        fail('Expected central Nginx container is not running')
    envfile = Path(__file__).with_name('.env')
    proxy_network = read_env(envfile).get('NGINX_PROXY_NETWORK') if envfile.exists() else None
    if proxy_network and (proxy_network == 'domainexp_app_proxy' or
                          proxy_network not in central['NetworkSettings']['Networks']):
        fail('NGINX_PROXY_NETWORK must be an explicitly authorized existing central proxy network')
    postgres = next((c for c in containers if c['Name'].lstrip('/') == POSTGRES), None)
    if not postgres or not postgres['State']['Running'] or postgres['Config']['Image'] != 'postgres:16-alpine':
        fail('Existing dedicated PostgreSQL 16 container must be running; deployment never creates it')
    if postgres['HostConfig'].get('PortBindings'):
        fail('Dedicated PostgreSQL must not publish host ports')
    if not any(m.get('Type') == 'volume' and m.get('Name') == VOLUME and
               m.get('Destination') == '/var/lib/postgresql/data' for m in postgres.get('Mounts', [])):
        fail('PostgreSQL must use the existing persistent domainexp_app_pgdata volume')
    run('docker', 'volume', 'inspect', VOLUME)
    if 'domainexp_app_proxy' not in postgres['NetworkSettings']['Networks']:
        fail('Dedicated PostgreSQL must already be connected to domainexp_app_proxy')
    own = None
    for c in containers:
        name = c['Name'].lstrip('/')
        labels = c['Config'].get('Labels') or {}
        if name == CONTAINER:
            if labels.get('com.docker.compose.project') != PROJECT or labels.get('com.docker.compose.service') != 'backend':
                fail('Backend container name is already owned by another project')
            own = c
        if labels.get('com.docker.compose.project') == PROJECT and name not in (CONTAINER, POSTGRES):
            fail('Compose project name collides with unrelated services')
        if c['State']['Running'] and name != CONTAINER:
            bindings = c['HostConfig'].get('PortBindings') or {}
            if any(b.get('HostPort') == port for values in bindings.values() for b in (values or [])):
                fail('Reserved port 5011 belongs to another container; no container will be stopped')
    if own:
        bindings = own['HostConfig'].get('PortBindings') or {}
        if bindings != {'4000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': port}]}:
            fail('Existing backend must publish only 127.0.0.1:5011 to internal port 4000')
        endpoint = own['NetworkSettings']['Networks'].get(proxy_network, {})
        if 'backend' in (endpoint.get('Aliases') or []):
            fail('Shared proxy network must not contain the ambiguous generic backend DNS alias')
    own_ports = (own or {}).get('HostConfig', {}).get('PortBindings', {})
    own_port = bool(own and own['State']['Running'] and any(
        b.get('HostPort') == port for values in own_ports.values() for b in (values or [])))
    for line in run('ss', '-H', '-ltn').splitlines():
        fields = line.split()
        if len(fields) >= 4 and fields[3].rsplit(':', 1)[-1] == port and not (
                own_port and fields[3] == '127.0.0.1:' + port):
            fail('BACKEND_HOST_PORT is already listening; no process will be stopped')
    networks = run('docker', 'network', 'ls', '--format', '{{.Name}}').splitlines()
    if 'domainexp_app_proxy' in networks:
        network = json.loads(run('docker', 'network', 'inspect', 'domainexp_app_proxy'))[0]
        project = (network.get('Labels') or {}).get('com.docker.compose.project')
        if project not in (None, PROJECT):
            fail('Dedicated network name belongs to another Docker project')
        allowed = {c['Id'] for c in containers if c['Name'].lstrip('/') in (CONTAINER, POSTGRES)}
        if set((network.get('Containers') or {})) - allowed:
            fail('Dedicated network contains an unrelated container')
    else:
        fail('Existing dedicated network is missing; deployment never recreates infrastructure')
    active = run('docker', 'exec', CENTRAL, 'nginx', '-T')
    domain_sections = []
    sections = re.split(r'(?m)^# configuration file (.+):\s*$', active)
    for index in range(1, len(sections), 2):
        current_file = sections[index]
        body = re.sub(r'(?m)#.*$', '', sections[index + 1])
        for match in re.finditer(r'\bserver_name\s+([^;]+);', body):
            tokens = [token.lower().rstrip('.') for token in match.group(1).split()]
            if DOMAIN in tokens:
                if current_file != TARGET or match.group(1).strip() != DOMAIN:
                    fail('Domain is already configured in another active Nginx file')
                domain_sections.append(current_file)
    if len(domain_sections) not in (0, 2):
        fail('Duplicate or incomplete existing domain server blocks')
    if domain_sections and not proxy_network:
        fail('Installed Nginx route needs an explicitly authorized NGINX_PROXY_NETWORK backend connection')
    print('Preflight passed: exact domain routing, port, container and network ownership checked')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, ValueError, OSError) as error:
        message = str(error) if isinstance(error, RuntimeError) else 'Docker/Nginx inspection failed; no configuration was changed'
        print('Preflight failed: ' + message, file=sys.stderr)
        sys.exit(1)
