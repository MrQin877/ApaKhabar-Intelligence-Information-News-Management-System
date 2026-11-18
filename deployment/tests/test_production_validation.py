"""Isolated preflight regression checks using synthetic credentials and temporary files."""
import contextlib
import importlib.util
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preflight', ROOT / 'validate-production.py')
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class ProductionPreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.envs = {}
        for name in ('.env', 'laravel.env', 'ai.env'):
            env = preflight.read_env(ROOT / 'production' / (name + '.example'))
            self.envs[name] = {key: ('synthetic-test-credential' if 'replace-with' in value else value)
                               for key, value in env.items()}
        self.envs['.env']['APP_URL'] = 'https://news.village.org'
        self.envs['laravel.env']['APP_URL'] = 'https://news.village.org'
        self.envs['laravel.env']['FACEBOOK_REDIRECT_URI'] = 'https://news.village.org/admin/social/facebook/callback'
        self.envs['laravel.env']['APP_KEY'] = 'base64:' + 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY='
        for key in ('DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'APAKHABAR_AI_SERVICE_TOKEN'):
            self.envs['laravel.env'][key] = self.envs['.env'][key]
        self.envs['.env']['TLS_CERT_DIR'] = self.folder.as_posix()
        for name in ('fullchain.pem', 'privkey.pem'):
            (self.folder / name).write_text('synthetic fixture; presence check only')

    def run_preflight(self):
        for name, env in self.envs.items():
            (self.folder / name).write_text('\n'.join(key + '=' + value for key, value in env.items()))
        preflight.errors.clear()
        output = io.StringIO()
        with patch.object(sys, 'argv', ['validator', '--config-dir', str(self.folder)]), contextlib.redirect_stdout(output):
            result = preflight.main()
        self.assertNotIn('synthetic-test-credential', output.getvalue())
        return result, output.getvalue()

    def test_consistent_configuration_passes(self):
        self.assertEqual(self.run_preflight()[0], 0)

    def test_missing_provider_key_is_rejected(self):
        self.envs['ai.env']['EMBEDDING_API_KEY'] = ''
        result, output = self.run_preflight()
        self.assertEqual(result, 1)
        self.assertIn('EMBEDDING_API_KEY', output)

    def test_mismatched_database_and_token_are_rejected(self):
        self.envs['laravel.env']['DB_PASSWORD'] = 'different-synthetic-password'
        self.envs['ai.env']['APAKHABAR_AI_SERVICE_TOKEN'] = 'different-synthetic-token'
        result, output = self.run_preflight()
        self.assertEqual(result, 1)
        self.assertIn('DB_PASSWORD', output)
        self.assertIn('APAKHABAR_AI_SERVICE_TOKEN', output)
        self.assertNotIn('different-synthetic', output)

    def test_insecure_origin_and_callback_are_rejected(self):
        self.envs['.env']['APP_URL'] = 'http://localhost:8088'
        result, output = self.run_preflight()
        self.assertEqual(result, 1)
        self.assertIn('public HTTPS', output)
        self.assertIn('FACEBOOK_REDIRECT_URI', output)

    def test_placeholders_and_missing_tls_are_rejected(self):
        self.envs['ai.env']['AI_API_KEY'] = 'replace-with-secret'
        (self.folder / 'privkey.pem').unlink()
        result, output = self.run_preflight()
        self.assertEqual(result, 1)
        self.assertIn('AI_API_KEY', output)
        self.assertIn('privkey.pem', output)


if __name__ == '__main__':
    unittest.main()
