"""Read-only checks: no container/config belonging to another project is changed."""
import json
import re
import subprocess
import sys
from pathlib import Path

PROJECT = 'domainexp_app'
CONTAINER = 'domainexp_app_backend'
CENTRAL = 'gymproplus-nginx-1'
DOMAIN = 'app.domainexp.info'
TARGET = '/etc/nginx/conf.d/app.domainexp.info.conf'


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.PIPE)


def fail(message):
    raise RuntimeError(message)


def main():
    port = sys.argv[1]
    if not port.isdigit() or not 1024 <= int(port) <= 65535:
        fail('BACKEND_HOST_PORT must be a selected free port between 1024 and 65535')
    config = Path(__file__).with_name('nginx').joinpath(DOMAIN + '.conf').read_text()
    names = re.findall(r'\bserver_name\s+([^;]+);', config)
    if names != [DOMAIN, DOMAIN] or re.search(r'\bdefault_server\b', config) or '*' in ' '.join(names):
        fail('Prospective Nginx config must contain only the two exact domain server blocks')
    ids = run('docker', 'ps', '-aq').split()
    containers = json.loads(run('docker', 'inspect', *ids)) if ids else []
    central = next((c for c in containers if c['Name'].lstrip('/') == CENTRAL), None)
    if not central or not central['State']['Running']:
        fail('Expected central Nginx container is not running')
    own = None
    for c in containers:
        name = c['Name'].lstrip('/')
        labels = c['Config'].get('Labels') or {}
        if name == CONTAINER:
            if labels.get('com.docker.compose.project') != PROJECT or labels.get('com.docker.compose.service') != 'backend':
                fail('Backend container name is already owned by another project')
            own = c
        if labels.get('com.docker.compose.project') == PROJECT and labels.get('com.docker.compose.service') not in ('backend', 'migrate'):
            fail('Compose project name collides with unrelated services')
        if c['State']['Running'] and name != CONTAINER:
            bindings = c['HostConfig'].get('PortBindings') or {}
            if any(b.get('HostPort') == port for values in bindings.values() for b in (values or [])):
                fail('BACKEND_HOST_PORT belongs to another container; choose another port')
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
        if (network.get('Labels') or {}).get('com.docker.compose.project') != PROJECT:
            fail('Dedicated network name belongs to another Docker project')
        allowed = {c['Id'] for c in containers if c['Name'].lstrip('/') == CENTRAL or
                   (c['Config'].get('Labels') or {}).get('com.docker.compose.project') == PROJECT}
        if set((network.get('Containers') or {})) - allowed:
            fail('Dedicated network contains an unrelated container')
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
    print('Preflight passed: exact domain routing, port, container and network ownership checked')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, ValueError) as error:
        message = str(error) if isinstance(error, RuntimeError) else 'Docker/Nginx inspection failed; no configuration was changed'
        print('Preflight failed: ' + message, file=sys.stderr)
        sys.exit(1)
