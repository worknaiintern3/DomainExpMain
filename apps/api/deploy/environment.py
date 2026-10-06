"""Production dotenv validation. Diagnostics contain variable names, never values."""
import base64
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit


def read_env(path):
    result = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('export '):
            line = line[7:].strip()
        key, sep, value = line.partition('=')
        key, value = key.strip(), value.strip()
        if not sep or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key) or key in result:
            raise RuntimeError('Invalid or duplicate environment variable name')
        if value.startswith(('"', "'")):
            if len(value) < 2 or value[-1] != value[0]:
                raise RuntimeError('Invalid dotenv quoting: ' + key)
            value = value[1:-1]
        else:
            value = re.split(r'\s+#', value, maxsplit=1)[0].rstrip()
        result[key] = value
    return result


def validate(env):
    required = ['BACKEND_HOST_PORT', 'NODE_ENV', 'DATABASE_URL', 'MIGRATION_DATABASE_URL',
                'RUN_MIGRATIONS', 'CORS_ORIGINS', 'JWT_ACCESS_TOKEN_AUDIENCE',
                'JWT_ACCESS_TOKEN_ISSUER', 'JWT_ACCESS_TOKEN_SECRET',
                'PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1', 'GOOGLE_OAUTH_CLIENT_ID',
                'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI']
    invalid = {key for key in required if not env.get(key)}
    for key, value in env.items():
        if any(marker in value.lower() for marker in ('replace-me', 'db-host', 'your-web-client.example')):
            invalid.add(key)
    for key, expected in {'BACKEND_HOST_PORT': '5011', 'NODE_ENV': 'production',
                          'API_HOST': '0.0.0.0', 'API_PORT': '4000',
                          'API_TRUST_PROXY_HOPS': '1'}.items():
        if env.get(key, expected) != expected:
            invalid.add(key)
    if env.get('RUN_MIGRATIONS') != 'true':
        invalid.add('RUN_MIGRATIONS')
    if env.get('NGINX_PROXY_NETWORK') and not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*', env['NGINX_PROXY_NETWORK']):
        invalid.add('NGINX_PROXY_NETWORK')
    urls = []
    for key in ('DATABASE_URL', 'MIGRATION_DATABASE_URL'):
        try:
            url = urlsplit(env.get(key, ''))
            if (url.scheme not in ('postgres', 'postgresql') or
                    url.hostname != 'domainexp_app_postgres' or (url.port or 5432) != 5432 or
                    not url.username or not url.password or url.path in ('', '/')):
                raise ValueError()
            urls.append(url)
        except ValueError:
            invalid.add(key)
    if len(urls) == 2 and urls[0].path != urls[1].path:
        invalid.update(('DATABASE_URL', 'MIGRATION_DATABASE_URL'))
    for origin in env.get('CORS_ORIGINS', '').split(','):
        try:
            url = urlsplit(origin.strip())
            if (url.scheme not in ('http', 'https') or not url.netloc or url.username or
                    url.password or url.path or url.query or url.fragment or '*' in origin):
                raise ValueError()
        except ValueError:
            invalid.add('CORS_ORIGINS')
    try:
        value = env.get('JWT_ACCESS_TOKEN_SECRET', '')
        decoded = base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))
        if not (32 <= len(decoded) <= 64 and len(set(decoded)) >= 16 and
                base64.urlsafe_b64encode(decoded).decode().rstrip('=') == value):
            raise ValueError()
    except (ValueError, base64.binascii.Error):
        invalid.add('JWT_ACCESS_TOKEN_SECRET')
    try:
        value = env.get('PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1', '')
        decoded = base64.b64decode(value, validate=True)
        if len(decoded) != 32 or base64.b64encode(decoded).decode() != value:
            raise ValueError()
    except (ValueError, base64.binascii.Error):
        invalid.add('PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1')
    if env.get('GOOGLE_OAUTH_REDIRECT_URI'):
        try:
            url = urlsplit(env['GOOGLE_OAUTH_REDIRECT_URI'])
            if url.scheme != 'https' or not url.netloc or url.username or url.password:
                raise ValueError()
        except ValueError:
            invalid.add('GOOGLE_OAUTH_REDIRECT_URI')
    if invalid:
        raise RuntimeError('Missing/invalid production variables: ' + ', '.join(sorted(invalid)))


def main():
    path, operation = sys.argv[1:3]
    env = read_env(path)
    if operation == 'validate':
        validate(env)
        print('Production environment validated (names only)')
    elif operation == 'value':
        print(env.get(sys.argv[3], ''))
    elif operation == 'runtime':
        validate(env)
        target = Path(path).with_name('.env.runtime')
        temporary = target.with_name(target.name + '.' + str(os.getpid()))
        try:
            with temporary.open('x') as output:
                os.chmod(temporary, 0o600)
                for key, value in env.items():
                    if key != 'MIGRATION_DATABASE_URL':
                        # Literal single-quoted dotenv values prevent Compose interpolation.
                        if "'" in value:
                            raise RuntimeError('Unsupported dotenv quote: ' + key)
                        output.write(key + "='" + value + "'\n")
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
    else:
        raise RuntimeError('Unknown environment operation')


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, ValueError) as error:
        print(str(error) if isinstance(error, RuntimeError) else 'Environment file validation failed', file=sys.stderr)
        sys.exit(1)
