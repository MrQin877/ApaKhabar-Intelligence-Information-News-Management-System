"""Run on either Azure VM. Existing runtime secrets/configuration stay on the VM."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess

REPO = PurePosixPath('/home/apakhabaradmin/apakhabar/ApaKhabar-Intelligence-Information-News-Management-System')
INFRA = PurePosixPath('/home/apakhabaradmin/apakhabar-azure')
ROOT = Path('/home/apakhabaradmin/apakhabar-cicd/releases')
LARAVEL = ('app', 'worker-documents', 'worker-generation', 'worker-video', 'scheduler')


def valid_release(value):
    if not re.fullmatch(r'[0-9a-f]{40}', value):
        raise ValueError('Release must be a complete lowercase Git commit SHA')
    return value


def topology(role):
    if role == 'vm1':
        return {
            'project': 'apakhabar-production', 'cwd': REPO,
            'files': [REPO / 'deployment/compose.production.yaml', INFRA / 'compose.azure.yaml',
                      INFRA / 'compose.storage.yaml', INFRA / 'compose.services.yaml'],
            'env': REPO / 'deployment/production/.env',
            'services': (*LARAVEL, 'web'), 'address': '127.0.0.1',
        }
    if role == 'vm2':
        return {
            'project': 'apakhabar-web2', 'cwd': PurePosixPath('/home/apakhabaradmin/web2-config'),
            'files': [PurePosixPath('/home/apakhabaradmin/web2-config/compose.web2.json')],
            'env': None, 'services': ('app', 'web'), 'address': '172.16.0.5',
        }
    raise ValueError('Unknown VM role')


def image_override(release, services):
    valid_release(release)
    return {'services': {service: {'image': f'apakhabar-production-{"web" if service == "web" else "app"}:sha-{release}'}
                         for service in services}}


def run(args, capture=False):
    # Docker/Compose diagnostics may contain runtime values. Suppress raw output on failure.
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('Command failed: ' + args[0] + ' (details suppressed; inspect privately on VM)')
    return result.stdout if capture else None


def compose_base(settings):
    command = ['sudo', '-n', 'docker', 'compose', '--project-name', settings['project']]
    if settings['env']:
        command += ['--env-file', str(settings['env'])]
    for path in settings['files']:
        command += ['-f', str(path)]
    return command


def current_images(settings):
    result = {}
    replicas = 0
    for service in settings['services']:
        ids = run(['sudo', '-n', 'docker', 'ps', '-q', '--filter',
                   'label=com.docker.compose.project=' + settings['project'], '--filter',
                   'label=com.docker.compose.service=' + service], capture=True).split()
        if not ids:
            raise RuntimeError('Missing running service: ' + service)
        images = {run(['sudo', '-n', 'docker', 'inspect', '--format', '{{.Image}}', item], capture=True).strip()
                  for item in ids}
        if len(images) != 1:
            raise RuntimeError('Service already has mixed images: ' + service)
        result[service] = {'image': images.pop()}
        if service == 'app':
            replicas = len(ids)
    return {'services': result}, replicas


def running_release(settings, release):
    for service in settings['services']:
        ids = run(['sudo', '-n', 'docker', 'ps', '-q', '--filter',
                   'label=com.docker.compose.project=' + settings['project'], '--filter',
                   'label=com.docker.compose.service=' + service], capture=True).split()
        if not ids:
            return False
        for item in ids:
            actual = run(['sudo', '-n', 'docker', 'inspect', '--format',
                          '{{index .Config.Labels "org.opencontainers.image.revision"}}', item], capture=True).strip()
            # Image labels are inherited by containers unless explicitly overridden.
            if actual != release:
                return False
    return True


def apply_images(settings, override, replicas):
    command = compose_base(settings) + ['-f', str(override)]
    run(command + ['config', '--quiet'])
    run(command + ['up', '-d', '--no-build', '--no-deps', '--force-recreate',
                   '--scale', f'app={replicas}', '--wait', '--wait-timeout', '180', *settings['services']])
    web = settings['project'] + '-web-1'
    run(['sudo', '-n', 'docker', 'exec', web, 'nginx', '-t'])
    run(['curl', '--fail', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '45',
         '--resolve', 'apakhabar.me:443:' + settings['address'], '-o', '/dev/null', 'https://apakhabar.me/'])


def release_action(role, release, action):
    valid_release(release)
    settings = topology(role)
    os.chdir(settings['cwd'])
    if action == 'check':
        run(compose_base(settings) + ['config', '--quiet'])
        _, replicas = current_images(settings)
        run(['curl', '--fail', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '45',
             '--resolve', 'apakhabar.me:443:' + settings['address'], '-o', '/dev/null', 'https://apakhabar.me/'])
        print(f'PREFLIGHT_VERIFIED {role} app_replicas={replicas}')
        return
    folder = ROOT / release
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    snapshot = folder / 'previous-images.json'
    state_file = folder / 'state.json'
    if action == 'rollback':
        state = json.loads(state_file.read_text())
        apply_images(settings, snapshot, state['replicas'])
        print('ROLLBACK_VERIFIED ' + role)
        return
    if state_file.exists():
        state = json.loads(state_file.read_text())
        if state['status'] == 'verified' and running_release(settings, release):
            run(['curl', '--fail', '--silent', '--show-error', '--max-time', '45',
                 '--resolve', 'apakhabar.me:443:' + settings['address'], '-o', '/dev/null', 'https://apakhabar.me/'])
            (folder / 'images.tar.gz').unlink(missing_ok=True)
            print('ALREADY_VERIFIED ' + role + ' ' + release)
            return
        raise RuntimeError('Release state exists but does not match running containers; inspect privately before retrying')
    expected = (folder / 'images.sha256').read_text().strip()
    archive = folder / 'images.tar.gz'
    digest = hashlib.sha256()
    with archive.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    if not re.fullmatch(r'[0-9a-f]{64}', expected) or digest.hexdigest() != expected:
        raise RuntimeError('Image archive checksum mismatch')
    previous, replicas = current_images(settings)
    snapshot.write_text(json.dumps(previous))
    os.chmod(snapshot, 0o600)
    state_file.write_text(json.dumps({'replicas': replicas, 'status': 'prepared'}))
    run(['sudo', '-n', 'docker', 'load', '-i', str(archive)])
    for kind in ('app', 'web'):
        tag = f'apakhabar-production-{kind}:sha-{release}'
        revision = run(['sudo', '-n', 'docker', 'image', 'inspect', '--format',
                        '{{index .Config.Labels "org.opencontainers.image.revision"}}', tag], capture=True).strip()
        if revision != release:
            raise RuntimeError('Image revision verification failed')
    override = folder / 'images.json'
    override.write_text(json.dumps(image_override(release, settings['services'])))
    try:
        apply_images(settings, override, replicas)
    except Exception:
        print('Deployment failed; restoring previous images.', flush=True)
        apply_images(settings, snapshot, replicas)
        raise
    state_file.write_text(json.dumps({'replicas': replicas, 'status': 'verified'}))
    # Archive is only temporary transfer data; retain images and rollback metadata.
    archive.unlink()
    print('DEPLOYMENT_VERIFIED ' + role + ' ' + release)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('role', choices=('vm1', 'vm2'))
    parser.add_argument('release', type=valid_release)
    parser.add_argument('action', choices=('apply', 'rollback', 'check'))
    args = parser.parse_args()
    try:
        release_action(args.role, args.release, args.action)
    except (OSError, ValueError, RuntimeError) as exc:
        raise SystemExit(str(exc)) from None
