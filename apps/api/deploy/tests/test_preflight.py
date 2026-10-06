import base64
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
from environment import validate, read_env
import preflight


def container(name, identifier, image='node:24-bookworm-slim', labels=None):
    return {'Name': '/' + name, 'Id': identifier, 'Config': {'Image': image, 'Labels': labels or {}},
            'State': {'Running': True}, 'HostConfig': {'PortBindings': {}},
            'NetworkSettings': {'Networks': {'domainexp_app_proxy': {}}}, 'Mounts': []}


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.db = container(preflight.POSTGRES, 'database-id', 'postgres:16-alpine')
        self.db['Mounts'] = [{'Type': 'volume', 'Name': preflight.VOLUME, 'Destination': '/var/lib/postgresql/data'}]
        self.backend = container(preflight.CONTAINER, 'backend-id', labels={
            'com.docker.compose.project': 'domainexp_app', 'com.docker.compose.service': 'backend'})
        self.backend['HostConfig']['PortBindings'] = {'4000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '5011'}]}
        self.central = container(preflight.CENTRAL, 'nginx-id', 'nginx:1.27-alpine')
        self.central['NetworkSettings']['Networks'] = {'gymproplus_livesale': {}}
        self.containers = [self.db, self.backend, self.central]
        self.members = {'database-id': {'Name': preflight.POSTGRES}, 'backend-id': {'Name': preflight.CONTAINER}}

    def run_command(self, *args):
        if args == ('docker', 'ps', '-aq'):
            return ' '.join(c['Id'] for c in self.containers)
        if args[:2] == ('docker', 'inspect'):
            return json.dumps(self.containers)
        if args == ('docker', 'volume', 'inspect', preflight.VOLUME):
            return '[{}]'
        if args == ('docker', 'network', 'ls', '--format', '{{.Name}}'):
            return 'domainexp_app_proxy\n'
        if args == ('docker', 'network', 'inspect', 'domainexp_app_proxy'):
            return json.dumps([{'Labels': {}, 'Containers': self.members}])
        if args == ('ss', '-H', '-ltn'):
            return 'LISTEN 0 4096 127.0.0.1:5011 0.0.0.0:*\n'
        if args == ('docker', 'exec', preflight.CENTRAL, 'nginx', '-T'):
            return '# configuration file ' + preflight.TARGET + ':\n' + (DEPLOY / 'nginx/app.domainexp.info.conf').read_text()
        raise AssertionError('Unexpected or mutating command: ' + repr(args))

    def check(self):
        with patch.object(preflight, 'run', self.run_command), patch.object(preflight, 'read_env', return_value={'NGINX_PROXY_NETWORK': 'gymproplus_livesale'}), \
                patch.object(preflight.Path, 'exists', return_value=True), patch.object(sys, 'argv', ['preflight', '5011']), \
                patch.object(preflight.socket, 'getaddrinfo', return_value=[(None, None, None, None, ('200.234.45.233', 443))]):
            preflight.main()

    def test_existing_database_without_compose_labels_is_accepted(self):
        self.check()

    def test_unrelated_network_member_is_rejected(self):
        self.members['unknown-id'] = {'Name': 'unrelated'}
        with self.assertRaisesRegex(RuntimeError, 'unrelated container'):
            self.check()

    def test_same_project_label_does_not_authorize_unrelated_container(self):
        self.containers.append(container('other-backend', 'unknown-id', labels={
            'com.docker.compose.project': 'domainexp_app', 'com.docker.compose.service': 'backend'}))
        self.members['unknown-id'] = {'Name': 'other-backend'}
        with self.assertRaises(RuntimeError):
            self.check()

    def test_nginx_is_not_allowed_on_private_database_network(self):
        self.members['nginx-id'] = {'Name': preflight.CENTRAL}
        with self.assertRaisesRegex(RuntimeError, 'unrelated container'):
            self.check()

    def test_database_public_ports_rejected(self):
        self.db['HostConfig']['PortBindings'] = {'5432/tcp': [{'HostIp': '', 'HostPort': '5432'}]}
        with self.assertRaisesRegex(RuntimeError, 'must not publish'):
            self.check()

    def test_wrong_persistent_volume_rejected(self):
        self.db['Mounts'][0]['Name'] = 'replacement'
        with self.assertRaisesRegex(RuntimeError, 'existing persistent'):
            self.check()

    def test_backend_public_port_rejected(self):
        self.backend['HostConfig']['PortBindings']['4000/tcp'][0]['HostIp'] = '0.0.0.0'
        with self.assertRaisesRegex(RuntimeError, 'only 127.0.0.1'):
            self.check()

    def test_backend_name_without_project_ownership_rejected(self):
        self.backend['Config']['Labels'] = {}
        with self.assertRaisesRegex(RuntimeError, 'owned by another project'):
            self.check()

    def test_shared_proxy_backend_alias_cannot_collide_with_other_app(self):
        self.backend['NetworkSettings']['Networks']['gymproplus_livesale'] = {'Aliases': ['backend']}
        with self.assertRaisesRegex(RuntimeError, 'ambiguous generic backend'):
            self.check()


class EnvironmentTests(unittest.TestCase):
    def setUp(self):
        self.env = read_env(DEPLOY / '.env.example')
        self.env.update({
            'RUN_MIGRATIONS': 'true', 'CORS_ORIGINS': 'https://app.domainexp.info',
            'DATABASE_URL': 'postgresql://api:password@domainexp_app_postgres:5432/domainpulse',
            'MIGRATION_DATABASE_URL': 'postgresql://owner:password@domainexp_app_postgres:5432/domainpulse',
            'JWT_ACCESS_TOKEN_SECRET': base64.urlsafe_b64encode(bytes(range(32))).decode().rstrip('='),
            'PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1': base64.b64encode(bytes(range(32, 64))).decode(),
            'GOOGLE_OAUTH_CLIENT_ID': 'configured-client', 'GOOGLE_OAUTH_CLIENT_SECRET': 'configured-secret',
            'GOOGLE_OAUTH_REDIRECT_URI': 'https://app.domainexp.info/auth/google/callback',
        })

    def test_valid_production_environment(self):
        validate(self.env)

    def test_missing_names_are_reported_without_secret_values(self):
        self.env.pop('GOOGLE_OAUTH_CLIENT_SECRET')
        with self.assertRaises(RuntimeError) as caught:
            validate(self.env)
        self.assertIn('GOOGLE_OAUTH_CLIENT_SECRET', str(caught.exception))
        self.assertNotIn(self.env['JWT_ACCESS_TOKEN_SECRET'], str(caught.exception))

    def test_migrations_cannot_target_a_different_database(self):
        self.env['MIGRATION_DATABASE_URL'] += '-other'
        with self.assertRaisesRegex(RuntimeError, 'MIGRATION_DATABASE_URL'):
            validate(self.env)

    def test_placeholder_configuration_rejected(self):
        self.env['GOOGLE_OAUTH_CLIENT_SECRET'] = 'replace-me'
        with self.assertRaisesRegex(RuntimeError, 'GOOGLE_OAUTH_CLIENT_SECRET'):
            validate(self.env)

    def test_example_google_callback_is_not_a_production_callback(self):
        self.env['GOOGLE_OAUTH_REDIRECT_URI'] = 'https://your-domain.com/auth/google/callback'
        with self.assertRaisesRegex(RuntimeError, 'GOOGLE_OAUTH_REDIRECT_URI'):
            validate(self.env)

    def test_host_port_is_fixed(self):
        self.env['BACKEND_HOST_PORT'] = '5012'
        with self.assertRaisesRegex(RuntimeError, 'BACKEND_HOST_PORT'):
            validate(self.env)

    def test_migration_journal_matches_committed_sql(self):
        folder = DEPLOY.parents[2] / 'packages/database/migrations'
        journal = json.loads((folder / 'meta/_journal.json').read_text())
        self.assertEqual(sorted(p.name for p in folder.glob('*.sql')),
                         sorted(entry['tag'] + '.sql' for entry in journal['entries']))


if __name__ == '__main__':
    unittest.main()
