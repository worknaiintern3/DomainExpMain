"""Print backend failure details with all dotenv values and connection URLs redacted."""
import json
import re
import subprocess
from pathlib import Path
from environment import read_env

env = read_env(Path(__file__).with_name('.env'))


def sanitize(text):
    for value in sorted(env.values(), key=len, reverse=True):
        if len(value) >= 4:
            text = text.replace(value, '<redacted>')
    return re.sub(r'(?:postgres(?:ql)?|https?)://[^\s"\x27]+', '<url-redacted>', text)


result = subprocess.run(['docker', 'inspect', 'domainexp_app_backend'], capture_output=True, text=True)
if result.returncode:
    print('Backend is absent')
else:
    state = json.loads(result.stdout)[0]['State']
    print('Backend state:', {key: state.get(key) for key in ('Status', 'ExitCode', 'OOMKilled')})
    print('Backend health:', state.get('Health', {}).get('Status', 'not reported'))
    logs = subprocess.run(['docker', 'logs', '--tail', '60', 'domainexp_app_backend'], capture_output=True, text=True)
    print(sanitize(logs.stdout + logs.stderr))
