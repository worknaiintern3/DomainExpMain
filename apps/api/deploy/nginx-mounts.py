"""Read only the three central mounts needed by DomainExp certificate setup."""
import json
import subprocess
import sys

mounts = json.loads(subprocess.check_output(['docker', 'inspect', 'gymproplus-nginx-1'], text=True))[0]['Mounts']
destination = sys.argv[1]
matches = [mount['Source'] for mount in mounts if mount['Destination'].rstrip('/') == destination]
if len(matches) != 1:
    raise SystemExit('Missing/ambiguous existing central mount: ' + destination)
print(matches[0])
