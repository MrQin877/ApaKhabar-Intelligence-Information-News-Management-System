#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
# Absolute path survives Artisan changing the child server's directory to public/.
# An empty leading entry preserves PHP's default additional INI scan directory.
export PHP_INI_SCAN_DIR="${PHP_INI_SCAN_DIR:-}:$project_root/config/php"
# ServeCommand otherwise strips PHP_INI_SCAN_DIR from the child environment.
exec php artisan serve --no-reload "$@"
