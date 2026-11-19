"""Prepare runner-only SSH files from GitHub repository secrets; never print secrets."""
import os
from pathlib import Path
import re
import subprocess


def write_private(path, content):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(content.replace('\r\n', '\n').rstrip() + '\n')
    os.chmod(path, 0o600)


def configure(env):
    required = ('VM1_KEY', 'VM2_KEY', 'HOST_KEYS', 'VM1_HOST', 'VM2_HOST', 'SSH_USER', 'RUNNER_TEMP')
    for key in required:
        if not env.get(key, '').strip():
            raise ValueError('Missing setting: ' + key)
    for key in ('VM1_HOST', 'VM2_HOST'):
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.:-]*', env[key]):
            raise ValueError('Invalid setting: ' + key)
    if not re.fullmatch(r'[a-z_][a-z0-9_-]*', env['SSH_USER']):
        raise ValueError('Invalid setting: SSH_USER')
    root = Path(env['RUNNER_TEMP']).resolve()
    for number in (1, 2):
        key = root / f'apakhabar-vm{number}.key'
        write_private(key, env[f'VM{number}_KEY'])
        if subprocess.run(['ssh-keygen', '-y', '-P', '', '-f', str(key)],
                          capture_output=True).returncode:
            raise ValueError(f'VM{number}_KEY is not a usable unencrypted deployment key')
    known = root / 'apakhabar-known-hosts'
    write_private(known, env['HOST_KEYS'])
    for alias in ('apakhabar-vm1', 'apakhabar-vm2'):
        if subprocess.run(['ssh-keygen', '-F', alias, '-f', str(known)], capture_output=True).returncode:
            raise ValueError('Missing trusted host-key entry for ' + alias)
    blocks = []
    for number in (1, 2):
        blocks.append(f'''Host apakhabar-vm{number}
    HostName {env[f'VM{number}_HOST']}
    HostKeyAlias apakhabar-vm{number}
    User {env['SSH_USER']}
    IdentityFile "{root}/apakhabar-vm{number}.key"
    UserKnownHostsFile "{known}"
    StrictHostKeyChecking yes
    IdentitiesOnly yes
    BatchMode yes
    ConnectTimeout 20
    ServerAliveInterval 15
    ServerAliveCountMax 4
''' + ('    ProxyJump apakhabar-vm1\n' if number == 2 else ''))
    write_private(root / 'apakhabar-ssh-config', '\n'.join(blocks))


if __name__ == '__main__':
    try:
        configure(os.environ)
    except (ValueError, OSError) as exc:
        raise SystemExit(str(exc)) from None
    print('Deployment SSH credentials configured; values suppressed.')
