# Fixtures for .semgrep/rules.yml. Every `ruleid:` line must be flagged and
# every `ok:` line must not; `cd .semgrep && semgrep --test .` enforces both.
import asyncio
import os
import pickle
import subprocess

import yaml

cmd = "ls"
data = b""
text = ""

# ruleid: no-shell-true
subprocess.run(cmd, shell=True)
# ruleid: no-shell-true
subprocess.check_output(cmd, shell=True, timeout=5)
# ruleid: no-shell-true
asyncio.create_subprocess_shell(cmd)
# ok: no-shell-true
subprocess.run(["ls", "-l"], check=False)

# ruleid: no-os-system
os.system(cmd)
# ruleid: no-os-system
os.popen(cmd)

# ruleid: no-pickle
pickle.loads(data)

# ruleid: no-yaml-load
yaml.load(text)
# ok: no-yaml-load
yaml.load(text, Loader=yaml.SafeLoader)
# ok: no-yaml-load
yaml.safe_load(text)

# ruleid: no-eval-exec
eval(text)
# ruleid: no-eval-exec
exec(text)


def handler(request, app):
    # ruleid: no-bare-string-app-key-in-features
    registry = request.app["registry"]
    # ruleid: no-bare-string-app-key-in-features
    hub = app.get("event_hub")
    # ok: no-bare-string-app-key-in-features
    store = request.app[REGISTRY_KEY]  # noqa: F821
    row = {}
    # ok: no-bare-string-app-key-in-features
    related = row.get("related_event")
    # ok: no-bare-string-app-key-in-features
    name = row["name"]
    return registry, hub, store, related, name
