# ApaKhabar Intelligence, Information and News Management System

ApaKhabar's Laravel application provides the public news website, an admin/moderator editorial workspace, document and information management, broadcasts, and APIs for the separate mobile application. It integrates with the separate **ApaKhabar AI Service** for extraction, retrieval, conversation, and agentic drafting.

## Technology and boundaries

- Laravel 12 / PHP 8.4.1+ (required by the committed dependency lockfile), Inertia 2, React 19, TypeScript, Tailwind CSS 4, Radix/shadcn-style components, and Vite 7.
- Eloquent application persistence; database connections are configured in `config/database.php` (default MySQL).
- Laravel queue workers for document processing and generation; scheduler for stalled-document recovery and expiry archiving.
- FastAPI AI Service over server-to-server HTTP. Generation, judge, and embedding models run outside this repository.
- Existing publishing integrations for the website, Facebook, and Instagram; external services require their own credentials and setup.

## Included features

| Area | Functions |
| --- | --- |
| Public news | News listing/detail, related-news API, categories, likes, comments and replies |
| AI Assistant | Conversation, source selection, document questions/analysis, explicit draft generation, clarification, progress, session history, category proposals |
| Document library | Upload, extraction, evidence review, approval/rejection, previews, retry, archive/restore, approved-information indexing |
| Editorial workspace | Manual and AI drafts, edit/preview, versions and quality findings, images, explicit multi-channel publication, archive/restore |
| Social integrations | Account connections, channel selection, publishing results and failure handling |
| Broadcasts | Create/list/detail, resend, archive/restore, notification delivery |
| Accounts | Browser and mobile authentication, role checks, email/phone verification, password recovery, profile/security settings |
| Other services | Notifications/read status, mobile push-token registration, website translation |

See [feature and file map](docs/repository-map.md) for implementation locations and principal methods. This inventory describes implemented routes and code, not a guarantee that every optional provider is configured.

## Source-code handover: which repository runs which command?

Use **Docker for the website and AI service**, and run **Expo separately for mobile**. All commands below use Windows PowerShell. Replace example folder paths with the recipient's actual paths.

| Repository | Manual dependency installation with Docker | Startup command (run inside that repository) |
| --- | --- | --- |
| This website repository (Repo A) | None on the host. Docker runs `composer install`, `npm ci`, and `npm run build`. | `powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1 -Build` on first installation |
| ApaKhabar-AI-Service (Repo B) | None on the host. Repo A builds the Python image and installs its dependencies. | No separate command; started by Repo A |
| ApaKhabar-Mobile-App (Repo C) | Run `npm ci` in the mobile root containing `package-lock.json`. | `npx expo start --lan --clear` |

`npm ci` installs the exact locked dependencies and is the preferred fresh-install command. `npm install` also installs dependencies but can change the lockfile. Do not run both as consecutive setup steps.

### 1. Prepare the handover

Install Docker Desktop with Linux containers. For mobile, also install Node.js/npm compatible with the mobile project's Expo SDK and a compatible Expo Go app or development build. Obtain all three repositories, private configuration values, and any approved database/upload backups. Source code does not carry the existing database, uploaded files, or Docker volumes.

### 2. Repo A: configure the website and AI containers

```powershell
cd "C:\Testxampp\htdocs\ApaKhabar-Intelligence-Information-News-Management-System"
# Create only missing files; preserve any existing private configuration.
if (!(Test-Path deployment/.env)) { Copy-Item deployment/.env.example deployment/.env }
if (!(Test-Path deployment/laravel.env)) { Copy-Item deployment/laravel.env.example deployment/laravel.env }
if (!(Test-Path deployment/ai.env)) { Copy-Item deployment/ai.env.example deployment/ai.env }
```

Edit these three files before startup:

- `deployment/.env`: database credentials, shared service token, and Repo B build paths (`AI_REPO_PATH`, `AI_DOCKERFILE`). Relative build paths resolve from `deployment/compose.yaml`; the supplied defaults assume the developer's folder layout.
- `deployment/laravel.env`: Laravel `APP_KEY`, mail, and enabled integrations. Keep duplicated credentials aligned with Compose settings.
- `deployment/ai.env`: writer, embedding, and enabled evaluator endpoints, models, and credentials. The Laravel and AI service token must match. This is the AI environment used by Docker; Repo B's root `.env` is for a separate native Python setup.

For a new installation, generate a Laravel key using Docker and copy the resulting `base64:...` value into `APP_KEY` in `deployment/laravel.env`:

```powershell
docker run --rm php:8.4-cli php -r 'echo "base64:".base64_encode(random_bytes(32)).PHP_EOL;'
```

When restoring existing encrypted data, preserve its original `APP_KEY` instead. Do not commit private environment files.

Create the external translation-model volume. If you configured a different `TRANSLATION_MODELS_VOLUME`, use that exact name instead:

```powershell
docker volume create apakhabar-docker_translation_models
```

### 3. Repo A: first build and database initialization

Open Docker Desktop and wait for the engine to run. Still inside Repo A:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1 -Build
```

Docker installs website and AI dependencies and builds the website assets. Do not also run host `npm install`, `composer run dev`, or a separate Python server for this Docker setup. Initial image/model downloads may take time.

For a new empty database, apply the schema:

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml exec app php artisan migrate
```

Database migrations do not create an administrator. For transferred data, restore the approved backup and retain its accounts; review pending migrations before applying them. Do not use `migrate:fresh`. Do not run the default `DatabaseSeeder` against handed-over accounts: it includes development accounts and resets the matching administrator password. Agree on administrator provisioning with the handover maintainer. Production has a separate interactive `ProductionSeeder`; see its environment restrictions before use.

Open the website at http://localhost:8088 and test http://localhost:8088/api/news. A fresh database can return an empty news list. See [the detailed Docker guide](deployment/README.md) for troubleshooting and production preparation.

### 4. Repo B: no terminal required with Docker

Keep the AI source folder available at the path configured above. Repo A starts FastAPI, workers, scheduler, database, and translation containers. You do not need `npm install`, `pip install`, or `uvicorn` in Repo B when using this Docker workflow. See Repo B's README for the optional native Python workflow.

### 5. Repo C: install and start mobile in a second terminal

```powershell
cd "C:\Testxampp\htdocs\ApaKhabar-Mobile-App"
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npx expo start --lan --clear
```

For local development, leave `EXPO_PUBLIC_API_BASE_URL=` blank in Repo C's `.env`; the mobile code detects the Expo LAN host and uses backend port 8088. Keep the phone and computer on the same Wi-Fi. Scan the QR code with compatible Expo Go or a development build. Test `http://YOUR_COMPUTER_LAN_IP:8088/api/news` in the phone browser if data does not load.

Run commands in the mobile repository root, not the nested historical `apakhabar-mobile` folder. For a deployed mobile release, set `EXPO_PUBLIC_API_BASE_URL=https://YOUR_DOMAIN/api` and rebuild. Expo development startup does not produce an installable APK/IPA; signing, application identifiers, Expo ownership, and release build profiles require separate configuration.

### 6. Daily startup and shutdown

After installation, run in Repo A:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1
```

In another terminal, run in Repo C:

```powershell
npx expo start --lan --clear
```

Repeat `npm ci` in Repo C after receiving dependency/lockfile updates; it is not needed at every startup. Rebuild Repo A with `-Build` after changes to code or image dependencies. Stop Expo with `Ctrl+C`, then stop containers from Repo A:

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml stop
```

This preserves volumes. Do not use `down -v` to troubleshoot installations containing data.

## Alternative: native setup without Docker

This alternative **does** require running Composer and npm commands manually in Repo A and starting Python separately in Repo B. Do not mix its startup commands with the Docker workflow above.

Install PHP with the extensions required by Composer, Composer, a Node.js version compatible with Vite 7, and your configured database server. Use the lockfiles to install dependencies.

```sh
composer install
npm ci
```

Copy `.env.example` to `.env` **only for a new checkout** (`cp` on macOS/Linux or `Copy-Item` in PowerShell). Configure database, application URL, mail, queue, cache, and any required integration settings before migrating.

```sh
php artisan key:generate
php artisan migrate
php artisan storage:link
composer run dev
```

Do not regenerate the application key on an existing deployment. Review seeders before using them; they are not required by the commands above. The browser application normally opens at `http://localhost:8000`.

`composer run dev` starts the PHP server, document worker, generation worker, scheduler, and Vite. It uses `php scripts/serve.php`, so Windows users do not need Bash for this command. It does **not** start the Python service or model servers. Both queue workers use `scripts/queue-worker.php` so concurrently restarts them after clean exits (including `php artisan queue:restart`) as well as failures. After changing worker code or configuration, run `php artisan queue:restart` to reload the workers after their current jobs finish.

## AI integration

Configure these Laravel settings and use the same service token in the Python service:

```dotenv
APAKHABAR_AI_URL=http://127.0.0.1:8001
APAKHABAR_AI_TIMEOUT=1200
APAKHABAR_AI_SERVICE_TOKEN=replace-with-a-shared-secret
APAKHABAR_AI_WEB_DISCOVERY=false
```

Use an asynchronous queue connection. Start FastAPI and the configured generation, embedding, and optional judge providers from the AI Service repository. The Python workflow has Planner, Researcher, Writer, and Reviewer roles; this Laravel repository owns authorization, approved sources, sessions, drafts, and publication. Neither A2A nor MCP is required by this integration.

Uploading does not automatically authorize news generation. AI results remain drafts. Users review/edit and confirm publishing, selecting Website, Facebook, Instagram, or multiple channels. Publication uses saved edited content. Quality scores are automated assessments, not measured accuracy percentages.

## Documentation

- [System architecture and data flow](docs/system-architecture.md)
- [Repository features, files, and functions](docs/repository-map.md)
- [AI Assistant UI architecture](docs/NEWS_CREATOR_UI_ARCHITECTURE.md)
- [Local development and mobile URLs](docs/local-development.md)
- [Upload limits](docs/upload-limits.md)
- [Meta connections](docs/meta-connections.md) and [integration setup](docs/meta-integrations.md)
- [Instagram publishing](docs/instagram-manual-publishing.md)
- [Website translation](docs/website-translation.md)
- [Mobile email verification](docs/mobile-email-verification.md), [password reset](docs/mobile-password-reset.md)

## Checks

```sh
php artisan test
npm run types:check
npm run lint:check
npm run build
```

`composer test` also clears configuration and runs PHP formatting checks. Focused suites live under `tests/Feature/IntelligentNews`, `News`, `Broadcast`, `Auth`, and `Settings`. Tests using mocked providers validate application behavior; live model quality and real social publishing require separate verification. Never use real publishing as a routine automated smoke test.

## News engagement and moderation

See [news engagement setup, retention, moderation, and testing](docs/news-engagement.md). Run the new migrations before serving the updated UI. Configure server-side `OPENAI_API_KEY`; without it, comments remain pending for admin review.
