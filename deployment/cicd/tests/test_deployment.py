import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import remote_release as release
import configure_ssh
import deploy


class DeploymentTests(unittest.TestCase):
    def test_release_rejects_shell_and_path_inputs(self):
        for value in ('main', '../escape', 'a' * 39, 'a' * 40 + ';id', 'A' * 40):
            with self.subTest(value=value), self.assertRaises(ValueError):
                release.valid_release(value)

    def test_images_override_only_existing_application_services(self):
        services = release.topology('vm1')['services']
        data = release.image_override('a' * 40, services)
        self.assertEqual(set(data['services']), {'app', 'web', 'scheduler', 'worker-documents',
                                               'worker-generation', 'worker-video'})
        self.assertNotIn('db', data['services'])
        self.assertNotIn('ai', data['services'])
        self.assertNotIn('environment', json.dumps(data))
        self.assertTrue(all('sha-' + 'a' * 40 in item['image'] for item in data['services'].values()))

    def test_vm2_keeps_its_actual_configuration(self):
        data = release.topology('vm2')
        self.assertEqual(data['project'], 'apakhabar-web2')
        self.assertEqual(str(data['files'][0]), '/home/apakhabaradmin/web2-config/compose.web2.json')
        self.assertEqual(data['services'], ('app', 'web'))

    def test_apply_preserves_replica_count_and_does_not_seed_or_migrate(self):
        calls = []
        with patch.object(release, 'run', side_effect=lambda command: calls.append(command)):
            release.apply_images(release.topology('vm1'), Path('/tmp/images.json'), 2)
        update = next(command for command in calls if 'up' in command)
        self.assertIn('app=2', update)
        self.assertIn('--no-deps', update)
        self.assertIn('--no-build', update)
        self.assertNotIn('migrate', json.dumps(calls))
        self.assertNotIn('db:seed', json.dumps(calls))
        self.assertIn('compose.services.yaml', json.dumps(calls))
        self.assertIn('compose.storage.yaml', json.dumps(calls))

    def test_failures_do_not_expose_command_output(self):
        fake = type('Result', (), {'returncode': 1, 'stdout': 'private-value', 'stderr': 'private-value'})()
        with patch.object(release.subprocess, 'run', return_value=fake):
            with self.assertRaises(RuntimeError) as context:
                release.run(['docker', 'compose', 'config'])
        self.assertNotIn('private-value', str(context.exception))

    def test_ssh_rejects_injected_host_before_writing_keys(self):
        env = dict(VM1_KEY='private', VM2_KEY='private', HOST_KEYS='public', VM1_HOST='server\nProxyCommand evil',
                   VM2_HOST='172.16.0.5', SSH_USER='apakhabaradmin', RUNNER_TEMP='/tmp')
        with self.assertRaises(ValueError):
            configure_ssh.configure(env)

    def test_missing_secret_error_names_setting_not_value(self):
        with self.assertRaisesRegex(ValueError, 'VM1_KEY'):
            configure_ssh.configure({})

    def test_private_file_normalizes_crlf(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'key'
            configure_ssh.write_private(path, 'first\r\nsecond\r\n')
            self.assertEqual(path.read_bytes(), b'first\nsecond\n')

    def test_vm1_failure_rolls_back_successful_vm2_only(self):
        calls = []

        def fake_command(command):
            calls.append(command)
            if 'apakhabar-vm1' in command and command[-1].endswith(' apply'):
                raise RuntimeError('simulated VM1 failure')

        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'images.tar.gz'
            archive.write_bytes(b'synthetic archive')
            with patch.dict(deploy.os.environ, {'RUNNER_TEMP': directory}), patch.object(deploy, 'command', side_effect=fake_command):
                with self.assertRaises(RuntimeError):
                    deploy.deploy('a' * 40, archive)
        rollbacks = [command for command in calls if command[-1].endswith(' rollback')]
        self.assertEqual(len(rollbacks), 1)
        self.assertIn('apakhabar-vm2', rollbacks[0])

    def test_staging_failure_never_replaces_containers(self):
        calls = []

        def fake_command(command):
            calls.append(command)
            if command[0] == 'scp':
                raise RuntimeError('simulated transfer failure')

        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'images.tar.gz'
            archive.write_bytes(b'synthetic archive')
            with patch.dict(deploy.os.environ, {'RUNNER_TEMP': directory}), patch.object(deploy, 'command', side_effect=fake_command):
                with self.assertRaises(RuntimeError):
                    deploy.deploy('a' * 40, archive)
        self.assertFalse(any(command[-1].endswith(' apply') for command in calls))


if __name__ == '__main__':
    unittest.main()
