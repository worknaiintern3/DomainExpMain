"""Snapshot/verify all existing infrastructure without exposing its environment."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path


def inspect(*args):
    return json.loads(subprocess.check_output(['docker', *args], text=True, stderr=subprocess.PIPE))


def identity(container):
    return {key: container[key] for key in ('Id', 'Image', 'Mounts')} | {
        'networks': sorted(container['NetworkSettings']['Networks']),
        'started': container['State']['StartedAt'] if not container['State'].get('Restarting') else None,
    }


def snapshot(envfile):
    ids = subprocess.check_output(['docker', 'ps', '-aq'], text=True).split()
    containers = inspect('inspect', *ids) if ids else []
    return {
        'containers': {c['Name']: identity(c) for c in containers if c['Name'] != '/domainexp_app_backend'},
        'volume': inspect('volume', 'inspect', 'domainexp_app_pgdata')[0],
        'env': hashlib.sha256(Path(envfile).read_bytes()).hexdigest(),
    }


def verify(saved, envfile):
    if hashlib.sha256(Path(envfile).read_bytes()).hexdigest() != saved['env']:
        raise RuntimeError('Production .env changed during deployment')
    if inspect('volume', 'inspect', 'domainexp_app_pgdata')[0] != saved['volume']:
        raise RuntimeError('Persistent PostgreSQL volume identity changed')
    for name, previous in saved['containers'].items():
        current = identity(inspect('inspect', name)[0])
        if previous['started'] is None:
            current['started'] = None  # Existing restarting applications can restart independently.
        if current != previous:
            raise RuntimeError('Protected container identity/mounts/network/start time changed: ' + name)
    print('Preserved: PostgreSQL container/volume, production .env, central Nginx and unrelated containers')


if __name__ == '__main__':
    try:
        operation, filename, envfile = sys.argv[1:]
        path = Path(filename)
        if operation == 'snapshot':
            path.write_text(json.dumps(snapshot(envfile)))
            path.chmod(0o600)
        elif operation == 'verify':
            verify(json.loads(path.read_text()), envfile)
        else:
            raise RuntimeError('Unknown infrastructure operation')
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error) if isinstance(error, RuntimeError) else 'Infrastructure identity check failed', file=sys.stderr)
        sys.exit(1)
