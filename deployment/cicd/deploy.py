"""GitHub-hosted coordinator: stage both VMs, update VM2 then VM1, rollback on failure."""
import hashlib
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time
from urllib.request import urlopen

from remote_release import valid_release


def command(args):
    subprocess.run(args, check=True)


def deploy(release, archive):
    valid_release(release)
    archive = Path(archive).resolve(strict=True)
    temp = Path(os.environ['RUNNER_TEMP']).resolve()
    config = str(temp / 'apakhabar-ssh-config')
    ssh = ['ssh', '-F', config]
    scp = ['scp', '-F', config]
    folder = '/home/apakhabaradmin/apakhabar-cicd/releases/' + release
    remote_script = str(Path(__file__).with_name('remote_release.py').resolve())
    checksum = temp / 'images.sha256'
    digest = hashlib.sha256()
    with archive.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    checksum.write_text(digest.hexdigest() + '\n')
    # Verify both SSH routes before any container replacement.
    for role in ('vm2', 'vm1'):
        host = 'apakhabar-' + role
        command(ssh + [host, 'umask 077; mkdir -p ' + shlex.quote(folder)])
        command(scp + [str(archive), f'{host}:{folder}/images.tar.gz'])
        command(scp + [str(checksum), remote_script, f'{host}:{folder}/'])
    applied = []
    try:
        for role in ('vm2', 'vm1'):
            command(ssh + ['apakhabar-' + role,
                    f'python3 {folder}/remote_release.py {role} {release} apply'])
            applied.append(role)
        url = os.environ.get('PUBLIC_URL', 'https://apakhabar.me')
        if url != 'https://apakhabar.me':
            raise ValueError('Unexpected production health URL')
        for attempt in range(3):
            try:
                with urlopen(url, timeout=30) as response:
                    if response.status != 200 or response.url not in (url, url + '/'):
                        raise RuntimeError('Unexpected public health response')
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(5)
    except Exception:
        print('Deployment failed; attempting rollback on affected VMs.', flush=True)
        failures = []
        for role in reversed(applied):
            try:
                command(ssh + ['apakhabar-' + role,
                        f'python3 {folder}/remote_release.py {role} {release} rollback'])
            except Exception:
                failures.append(role)
        if failures:
            print('MANUAL CHECK REQUIRED: rollback could not be confirmed on ' + ', '.join(failures), flush=True)
        raise RuntimeError('Deployment did not complete. Review health and rollback messages.') from None
    print('Both VMs and public HTTPS verified for ' + release, flush=True)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: deploy.py COMMIT_SHA IMAGE_ARCHIVE')
    try:
        deploy(sys.argv[1], sys.argv[2])
    except (ValueError, OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        raise SystemExit(str(exc)) from None
