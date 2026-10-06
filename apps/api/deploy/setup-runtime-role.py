"""Explicit ONE-TIME least-privilege setup, never called by normal deployment."""
import os
import secrets
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit
from environment import read_env


def main():
    if sys.argv[1:] != ['--initialize-runtime-role']:
        raise RuntimeError('One-time role initialization requires --initialize-runtime-role')
    envfile = Path('/opt/domainexp-app/apps/api/deploy/.env')
    env = read_env(envfile)
    owner = urlsplit(env['MIGRATION_DATABASE_URL'])
    runtime = urlsplit(env['DATABASE_URL'])
    if owner.hostname != 'domainexp_app_postgres' or owner.path != runtime.path:
        raise RuntimeError('Unexpected production database targets')
    role = 'domainexp_app_runtime'
    def query(sql):
        result = subprocess.run(['docker', 'exec', '-i', 'domainexp_app_postgres', 'psql',
                                 '-X', '-v', 'ON_ERROR_STOP=1', '-U', unquote(owner.username),
                                 '-d', unquote(owner.path[1:]), '-At'], input=sql, text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError('One-time PostgreSQL role query failed; no secret values logged')
        return result.stdout.strip()
    if runtime.username == role:
        if query("SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname='domainexp_app_runtime';") != 'f':
            raise RuntimeError('Existing runtime role is missing or overprivileged')
        print('Existing least-privilege runtime role preserved; .env unchanged')
        return
    if owner.username != runtime.username:
        raise RuntimeError('Separate runtime role already configured; refusing to replace its credentials')
    if query("SELECT 1 FROM pg_roles WHERE rolname='domainexp_app_runtime';"):
        raise RuntimeError('Runtime role exists with unknown credentials; refusing password reset')
    password = secrets.token_urlsafe(48)
    database = unquote(owner.path[1:]).replace('"', '""')
    query(f"CREATE ROLE {role} LOGIN PASSWORD '{password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\n"
          f'GRANT CONNECT ON DATABASE "{database}" TO {role};\n')
    authority = role + ':' + quote(password, safe='') + '@' + owner.hostname + ':5432'
    new_url = urlunsplit((owner.scheme, authority, owner.path, owner.query, owner.fragment))
    lines = envfile.read_text().splitlines()
    changed = 0
    for i, line in enumerate(lines):
        if line.partition('=')[0].strip().removeprefix('export ') == 'DATABASE_URL':
            lines[i] = 'DATABASE_URL=' + new_url
            changed += 1
    if changed != 1:
        raise RuntimeError('DATABASE_URL must appear exactly once; role created but env not replaced')
    temporary = envfile.with_name('.env.runtime-role.' + str(os.getpid()))
    with temporary.open('x') as output:
        os.chmod(temporary, 0o600)
        output.write('\n'.join(lines) + '\n')
    temporary.replace(envfile)
    print('One-time runtime role initialized; migration owner, JWT and encryption secrets preserved')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print(str(error) if isinstance(error, RuntimeError) else 'One-time runtime role initialization failed', file=sys.stderr)
        sys.exit(1)
