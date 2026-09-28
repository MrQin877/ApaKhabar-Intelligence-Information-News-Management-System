# Document upload limits

The application accepts at most five documents per batch, with a maximum of 20 MiB per file. The Python service uses the same 20 MiB per-file default.

Start the local Laravel server using `composer dev` or `bash scripts/serve.sh`. The script loads `config/php/uploads.ini` in addition to the installed PHP configuration:

- `upload_max_filesize=20M`
- `post_max_size=110M` (100 MiB batch plus multipart overhead)
- `memory_limit=256M`

Restart an existing `composer dev` process after updating. Direct `php artisan serve` does not load this project configuration. The wrapper uses `--no-reload` to preserve the INI scan path in Artisan's child process; restart it after changing `.env` or PHP configuration. PHP application source changes are still read on subsequent requests.

Browser validation rejects an individual file larger than 20 MiB before sending it. Server validation remains authoritative. Oversized HTTP requests return a small 413 response instead of rendering the full rejected request in the debug exception page.

For PHP-FPM or another deployment, configure equivalent PHP limits and a matching request-body limit in the web server/reverse proxy. The local script only configures this project's development server.
