"""Read-only production preflight. Never prints configuration values or Docker errors."""
import argparse
import base64
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
errors = []


def check(ok, label):
    if not ok:
        errors.append(label)


def read_env(path):
    """Accept a deliberately restricted dotenv subset shared by Compose and Laravel."""
    if not path.is_file():
        errors.append(path.name + ': missing file')
        return {}
    result = {}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        match = re.fullmatch(r'([A-Z][A-Z0-9_]*)=(.*)', line)
        if not match:
            errors.append(path.name + ': invalid assignment')
            continue
        key, value = match.groups()
        check(key not in result, path.name + ': duplicate ' + key)
        if value.startswith(("'", '"')):
            check(len(value) >= 2 and value[-1] == value[0], key + ': unmatched quotes')
            value = value[1:-1]
        # Do not silently disagree with Compose interpolation or dotenv escaping.
        check(not any(c in value for c in ('$', '\\', '\n', '\r')),
              key + ': unsupported interpolation/escape; use literal configuration')
        result[key] = value
    return result


def required(env, key):
    value = env.get(key, '').strip()
    check(bool(value) and not re.search(r'replace[-_ ]|your[-_ ]|changeme|example\.', value, re.I),
          key + ': missing or placeholder')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config-dir', type=Path, default=ROOT / 'production')
    parser.add_argument('--docker', action='store_true', help='Also inspect Docker Engine and external volume')
    args = parser.parse_args()
    directory = args.config_dir.resolve()
    compose = read_env(directory / '.env')
    laravel = read_env(directory / 'laravel.env')
    ai = read_env(directory / 'ai.env')
    for key in ('APP_URL', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'DB_ROOT_PASSWORD',
                'APAKHABAR_AI_SERVICE_TOKEN', 'TLS_CERT_DIR', 'COMPOSE_PROJECT_NAME'):
        required(compose, key)
    check(compose.get('COMPOSE_PROJECT_NAME') != 'apakhabar-docker', 'Use a separate production project identity')
    for key in ('APP_KEY', 'OPENAI_API_KEY'):
        required(laravel, key)
    check(laravel.get('APP_ENV') == 'production', 'APP_ENV must be production')
    check(laravel.get('APP_DEBUG') == 'false', 'APP_DEBUG must be false')
    check(laravel.get('SESSION_SECURE_COOKIE') == 'true', 'SESSION_SECURE_COOKIE must be true')
    try:
        key = laravel.get('APP_KEY', '')
        valid_key = len(base64.b64decode(key[7:], validate=True)) == 32 if key.startswith('base64:') else len(key.encode()) == 32
    except ValueError:
        valid_key = False
    check(valid_key, 'APP_KEY must be a valid AES-256 key; preserve migration key')
    try:
        url = urlsplit(compose.get('APP_URL', ''))
        host = url.hostname or ''
        public = '.' in host and not host.endswith(('.localhost', '.local', '.test', '.example', '.invalid')) and host != 'localhost'
        try:
            public = ipaddress.ip_address(host).is_global
        except ValueError:
            pass
        check(url.scheme == 'https' and public and not url.username and not url.password
              and not url.query and not url.fragment and url.path in ('', '/') and url.port in (None, 443),
              'APP_URL must be a public HTTPS origin on port 443')
    except ValueError:
        errors.append('APP_URL: invalid URL')
    check(laravel.get('APP_URL') == compose.get('APP_URL'), 'APP_URL differs between Compose and Laravel')
    callback = laravel.get('FACEBOOK_REDIRECT_URI', '')
    check(callback == compose.get('APP_URL', '').rstrip('/') + '/admin/social/facebook/callback',
          'FACEBOOK_REDIRECT_URI must match the HTTPS origin and callback path')
    for key in ('DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'):
        check(laravel.get(key) == compose.get(key), key + ': Laravel and MariaDB disagree')
    for env in (laravel, ai):
        check(env.get('APAKHABAR_AI_SERVICE_TOKEN') == compose.get('APAKHABAR_AI_SERVICE_TOKEN'),
              'APAKHABAR_AI_SERVICE_TOKEN: runtime and Compose disagree')
    for env, expected in ((laravel, {'DB_CONNECTION': 'mysql', 'DB_HOST': 'db', 'DB_PORT': '3306',
                                    'QUEUE_CONNECTION': 'database', 'APAKHABAR_AI_URL': 'http://ai:8001',
                                    'APAKHABAR_AI_API_PREFIX': '', 'LIBRETRANSLATE_URL': 'http://libretranslate:5000'}),
                          (ai, {'CHROMA_PATH': '/app/data/chroma', 'UPLOAD_PATH': '/app/data/uploads',
                                'AGENT_DB_PATH': '/app/data/agent/checkpoints.sqlite',
                                'HF_HOME': '/app/data/huggingface', 'AGENT_SKILLS_PATH': '/app/skills'})):
        for key, value in expected.items():
            check(env.get(key) == value, key + ': incompatible internal address or persistent path')
    for key in ('AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL', 'EMBEDDING_MODEL'):
        required(ai, key)
    provider = ai.get('EMBEDDING_PROVIDER')
    check(provider in ('gemini', 'openai'), 'EMBEDDING_PROVIDER: production build supports gemini or openai')
    if provider in ('gemini', 'openai'):
        required(ai, 'EMBEDDING_API_KEY')
    if provider == 'gemini':
        check(ai.get('EMBEDDING_MODEL') == 'gemini-embedding-001' and ai.get('EMBEDDING_DIMENSIONS') == '768',
              'Gemini model/dimensions must match the existing collection; reindex separately')
    if ai.get('EVALUATOR_ENABLED') == 'true':
        for key in ('EVALUATOR_API_KEY', 'EVALUATOR_MODEL', 'EVALUATOR_BASE_URL'):
            required(ai, key)
    # Any populated optional integration field must also have its placeholder replaced.
    for env in (laravel, ai):
        for key, value in env.items():
            if value:
                check(not re.search(r'replace[-_ ]|your[-_ ]|changeme', value, re.I), key + ': unresolved placeholder')
    if laravel.get('MAIL_MAILER') == 'smtp':
        for key in ('MAIL_HOST', 'MAIL_PORT', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_FROM_ADDRESS'):
            required(laravel, key)
    groups = [('FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'),
              ('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'),
              ('FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'),
              ('INSTAGRAM_USER_ID', 'INSTAGRAM_ACCESS_TOKEN')]
    for group in groups:
        if any(laravel.get(key) for key in group):
            for key in group:
                required(laravel, key)
    volumes = [key.upper() + '_VOLUME' for key in ('mariadb_data', 'laravel_storage', 'ai_chroma',
               'ai_uploads', 'ai_checkpoints', 'ai_model_cache')] + ['TRANSLATION_MODELS_VOLUME']
    for key in volumes:
        required(compose, key)
        check(bool(re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*', compose.get(key, ''))), key + ': invalid volume name')
    check(len({compose.get(key) for key in volumes}) == len(volumes), 'Persistent volume names must be distinct')
    check(compose.get('HTTP_PORT', '80') == '80' and compose.get('HTTPS_PORT', '443') == '443',
          'Production HTTPS redirect requires standard published ports 80 and 443')
    tls = Path(compose.get('TLS_CERT_DIR', ''))
    check(tls.is_absolute(), 'TLS_CERT_DIR must be absolute')
    for filename in ('fullchain.pem', 'privkey.pem'):
        check((tls / filename).is_file(), 'TLS: missing ' + filename)
    # Run Compose with a sanitized environment to prevent ambient overrides.
    env = {key: value for key, value in os.environ.items() if key not in compose and not key.startswith('COMPOSE_')}
    command = ['docker', 'compose', '--project-directory', str(ROOT), '--env-file', str(directory / '.env'),
               '-f', str(ROOT / 'compose.production.yaml')]
    # Custom directories are for static checks only; runtime env_file paths remain production/.
    if directory == (ROOT / 'production').resolve():
        try:
            result = subprocess.run(command + ['config', '--format', 'json'], capture_output=True, env=env, timeout=30)
            check(result.returncode == 0, 'Compose configuration failed (details suppressed to protect secrets)')
            if result.returncode == 0:
                services = json.loads(result.stdout)['services']
                check(set(services) == {'web', 'app', 'db', 'ai', 'scheduler', 'worker-documents',
                                       'worker-generation', 'worker-video', 'libretranslate'}, 'Compose service set differs')
                check(all(not item.get('ports') for name, item in services.items() if name != 'web'),
                      'Only Nginx may publish ports')
                for name in ('app', 'worker-documents', 'worker-generation', 'worker-video', 'scheduler'):
                    effective = services[name].get('environment', {})
                    for key in ('APP_URL', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'APAKHABAR_AI_SERVICE_TOKEN'):
                        check(effective.get(key) == compose.get(key), name + ': effective ' + key + ' mismatch')
                check(services['ai'].get('environment', {}).get('APAKHABAR_AI_SERVICE_TOKEN') == compose.get('APAKHABAR_AI_SERVICE_TOKEN'),
                      'ai: effective shared token mismatch')
        except (OSError, subprocess.TimeoutExpired, ValueError):
            errors.append('Compose check unavailable')
    if args.docker:
        try:
            result = subprocess.run(['docker', 'volume', 'inspect', compose.get('TRANSLATION_MODELS_VOLUME', '')],
                                    capture_output=True, timeout=20)
            check(result.returncode == 0, 'Docker Engine or external translation-model volume unavailable')
        except (OSError, subprocess.TimeoutExpired):
            errors.append('Docker Engine check unavailable')
    else:
        print('SKIP: Docker Engine and external volume existence (use --docker on target host)')
    for error in sorted(set(errors)):
        print('FAIL:', error)
    print('FAIL: production preflight' if errors else 'PASS: configuration preflight; runtime/provider health remains unverified')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
