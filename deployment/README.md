# ApaKhabar — Docker Setup & User Manual

A beginner-friendly guide to install, start, test, and troubleshoot the **ApaKhabar website and mobile app** on a Windows laptop using Docker Desktop.

> **For local development only.** This guide uses the local Docker setup, not Microsoft Azure. You do **not** need XAMPP or `composer run dev` when using Docker.

## Quick start (already set up?)

1. Open **Docker Desktop** and ensure its engine is running.
2. Open **PowerShell / VS Code terminal** in **Repo A** (the ApaKhabar website repository).
3. Run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1
   ```

4. Open **http://localhost:8088** in your laptop browser.
5. To use the mobile app, see [Start the mobile app](#7-start-the-mobile-app-expo).

If you see **502 Bad Gateway**, try:

```powershell
docker restart apakhabar-docker-web-1
```

Then refresh the website. See [Troubleshooting](#9-troubleshooting) if it keeps happening.

---

## 1. What is being installed?

ApaKhabar uses the following repositories:

| Repository | Contents |
| --- | --- |
| **Repo A — ApaKhabar Website** | Laravel backend, web UI, Docker Compose files, startup script |
| **Repo B — ApaKhabar AI Service** | FastAPI, AI document extraction, retrieval (RAG), AI news generation |
| **Mobile app (separate Expo project)** | React Native / Expo client that connects to Repo A's Laravel API |

Docker Compose is managed from **Repo A**. It runs Nginx (website), Laravel (API), MariaDB (database), FastAPI (AI), queue workers, scheduler, and LibreTranslate (translation). Chroma stores RAG embeddings. The mobile app runs separately with Expo.

**Important:** Repo A and Repo B must both be available when building images. The Docker database is **separate from XAMPP's database**. Pulling GitHub code does not automatically download another person's database records or uploads.

## 2. What you need before starting

- Windows PC with **Docker Desktop** installed and configured for **Linux containers**.
- **Git** and **PowerShell** (VS Code's PowerShell terminal is fine).
- A local copy of **Repo A** and **Repo B**.
- Required credentials/API keys from your project administrator.
- For mobile testing: **Node.js / npm**, an Expo-compatible phone setup, and phone + laptop on the **same Wi-Fi**.

Example Repo A folder used by the project developer:

```powershell
cd C:\Testxampp\htdocs\ApaKhabar-Intelligence-Information-News-Management-System
```

Your teammate's path may be different. Always run deployment commands from the **actual Repo A folder** unless instructed otherwise.

## 3. First-time setup (do this only once)

### Step 1 — Open Repo A

Open Repo A in VS Code, then open **Terminal → New Terminal**. Make sure the terminal shows the Repo A directory.

### Step 2 — Create the environment files

Run these only if the corresponding files do not already exist:

```powershell
Copy-Item deployment/.env.example deployment/.env
Copy-Item deployment/laravel.env.example deployment/laravel.env
Copy-Item deployment/ai.env.example deployment/ai.env
```

> **Do not overwrite existing `.env` files.** They may contain working passwords and configuration.

| File | Purpose |
| --- | --- |
| `deployment/.env` | Docker database settings, website port, shared token, paths |
| `deployment/laravel.env` | Laravel configuration, API credentials, `APP_KEY` |
| `deployment/ai.env` | FastAPI, Gemini, OpenAI, embeddings, AI agent settings |

### Step 3 — Set up Repo B path and credentials

Open `deployment/.env` and set `AI_REPO_PATH` to the correct Repo B directory. Fill in the required fields in all three environment files. Obtain actual values from your project administrator; do not invent or commit credentials.

Important variables in this project include:

| Variable | What it is for |
| --- | --- |
| `AI_REPO_PATH` | Location of Repo B during the Docker build |
| `AI_API_KEY` | Gemini news writing |
| `EMBEDDING_API_KEY` | Gemini document embeddings |
| `EVALUATOR_API_KEY` | OpenAI news evaluation |
| `OPENAI_API_KEY` | Laravel comment moderation |
| `APAKHABAR_AI_SERVICE_TOKEN` | Shared Laravel–FastAPI authentication token |
| `APP_KEY` | Laravel encryption key |

Keep `AGENT_ENABLED=true` and `EVALUATOR_ENABLED=true` in `deployment/ai.env` when the LangGraph workflow and evaluation are needed. For a brand-new installation, configure a Laravel `APP_KEY`; when restoring encrypted existing data, **preserve the original key**.

**Security:** Never push real `.env` files, tokens, or passwords to GitHub.

### Step 4 — Create the translation-model volume

The translation service uses a Docker volume that must exist before startup. For a fresh setup, the example volume name is:

```powershell
docker volume create apakhabar-docker_translation_models
```

Check that `TRANSLATION_MODELS_VOLUME` in `deployment/.env` matches the volume you're using. Existing installations may intentionally use a different pre-existing volume. An empty volume needs its initial language models downloaded; it can take additional startup time and memory.

### Step 5 — Start Docker Desktop, then build and start

From Repo A:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1 -Build
```

`-Build` is appropriate for the **first build**, or after changes to app code, dependencies, or Dockerfiles. Building can take longer than a normal start. Do not run a second `docker compose up` in another terminal while it is still building.

### Step 6 — Check it works

The launcher should print the website and API addresses plus container status. Open:

- **Laptop website:** http://localhost:8088
- **Laptop API test:** http://localhost:8088/api/news
- **Web-server health check:** http://localhost:8088/healthz

`/healthz` returning `200` confirms the Nginx health endpoint, **not necessarily the Laravel app**. Also test `/` and `/api/news`.

For a **brand-new database**, the required Laravel tables must be initialized using reviewed project migrations. **Do not** run `migrate:fresh`, reset, or drop a database with existing data. Ask the project administrator for the approved initialization steps and database contents; they are not provided by GitHub alone.

## 4. Daily startup (after first-time setup)

Every time you want to work on the website:

1. Open **Docker Desktop**.
2. Open a terminal in **Repo A**.
3. Run the standard launcher:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1
   ```

4. Open **http://localhost:8088**. You may close the terminal once the command returns to the PowerShell prompt; Docker containers run in the background.

**No XAMPP, Apache, XAMPP MySQL, or `composer run dev` is required for this Docker workflow.**

### Which startup command should I use?

| Command | What it does | When to use it |
| --- | --- | --- |
| `docker compose ... up -d --no-build` | Directly starts/recreates services using existing images; does **not** auto-detect LAN IP. The exact Compose files must be supplied. | Advanced/manual Docker usage |
| `start-local.ps1` | Detects Wi-Fi/LAN IP, validates bindings, starts containers **without rebuilding** | **Recommended daily startup** |
| `start-local.ps1 -Build` | Detects LAN IP, rebuilds images, then starts containers | First-time build; changes to code/dependencies/Dockerfiles |
| `start-local.ps1 -CheckOnly` | Validates configuration and planned access without starting containers | Troubleshooting/validation |

For all `start-local.ps1` options, run the full PowerShell command, for example:

```powershell
# Normal daily startup
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1

# Rebuild images and start
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1 -Build

# Check configuration without starting
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1 -CheckOnly
```

Other options: `-LocalhostOnly` for laptop-only access and `-InterfaceAlias 'Wi-Fi'` to select a specific physical adapter.

## 5. How local website and LAN addresses work

The startup script detects an active **physical Wi-Fi/LAN IPv4 address** (ignoring virtual/VPN adapters) each time it runs. For example, if it detects `192.168.68.51`, you may see:

| Use | Example URL |
| --- | --- |
| Laptop website | `http://localhost:8088` |
| Laptop Laravel API | `http://localhost:8088/api` |
| Phone website on same Wi-Fi | `http://192.168.68.51:8088` |
| Phone Laravel API on same Wi-Fi | `http://192.168.68.51:8088/api` |

**These are examples, not permanent addresses.** Always use the IP printed by your own latest startup. Rerun the launcher after changing Wi-Fi networks, restarting your laptop, or changing local networking. If IP detection or the LAN binding fails, the script may fall back to **localhost-only** mode.

The website exposes port **8088** through Nginx. MariaDB, FastAPI, and LibreTranslate remain internal to Docker. For local LAN mode, Nginx binds to `127.0.0.1:8088` and the detected physical LAN IP; it does not need a wildcard `0.0.0.0:8088`. The Compose LAN override requires Docker Compose **2.24.4 or newer** for `!override`. Do not use the local launcher or LAN override for Azure production deployment.

## 6. Check Docker service status

From any terminal with Docker available:

```powershell
docker ps
```

Typical containers include:

- `apakhabar-docker-web-1` — Nginx website
- `apakhabar-docker-app-1` — Laravel / PHP-FPM
- `apakhabar-docker-db-1` — MariaDB
- `apakhabar-docker-ai-1` — FastAPI
- `apakhabar-docker-libretranslate-1` — translation
- `apakhabar-docker-scheduler-1` — Laravel scheduled tasks
- `apakhabar-docker-worker-documents-1`, `worker-generation-1`, `worker-video-1` — background jobs

Look for `Up` and, where configured, `(healthy)`. Some services may still be warming up after startup. A healthy Nginx container alone does **not** prove that every Laravel route works.

## 7. Start the mobile app (Expo)

The Expo app runs **outside Docker** in a separate terminal. Start Docker first using section 4, then:

1. Connect your phone and laptop to the **same Wi-Fi**.
2. Open another VS Code/PowerShell terminal in the **mobile repository** (example below).
3. Configure the mobile app to use the detected Docker LAN API address (not `localhost` on the phone).

   Example environment setting in the mobile app's appropriate local environment file:

   ```env
   EXPO_PUBLIC_API_BASE_URL=http://192.168.68.51:8088/api
   ```

   Replace `192.168.68.51` with **your current IP printed by the launcher**. Docker uses port **8088**; the mobile app's automatic development fallback may use port **8000** and therefore needs this override.

4. Start Expo:

   ```powershell
   cd C:\Testxampp\htdocs\ApaKhabar-Mobile-App
   npx expo start --lan --clear
   ```

5. Scan the Expo QR code on your phone using a compatible Expo Go setup.
6. On your **phone's browser**, test `http://YOUR_LAPTOP_WIFI_IP:8088/api/news` before debugging mobile app requests.

The website and mobile app now use the **same Laravel Docker API/database**, assuming this environment setting is correct. If you change Wi-Fi networks or IPs, rerun the Docker launcher, update the Expo API address if needed, and restart Expo.

## 8. Useful maintenance commands

Use these when diagnosing an issue:

| Task | Command |
| --- | --- |
| Show running containers | `docker ps` |
| Website/Nginx logs | `docker logs apakhabar-docker-web-1 --tail 50` |
| Laravel/PHP-FPM logs | `docker logs apakhabar-docker-app-1 --tail 50` |
| Restart website Nginx only | `docker restart apakhabar-docker-web-1` |
| Test Nginx health | `curl.exe -i http://localhost:8088/healthz` |
| Test Laravel API | `curl.exe -i http://localhost:8088/api/news` |

For **advanced manual Compose commands**, these base-file examples use localhost-only defaults rather than the automatic LAN launcher:

```powershell
# Show service status
docker compose --env-file deployment/.env -f deployment/compose.yaml ps

# View recent logs
docker compose --env-file deployment/.env -f deployment/compose.yaml logs --tail=50

# Stop services gracefully (preserves volumes)
docker compose --env-file deployment/.env -f deployment/compose.yaml stop

# Validate base Compose configuration
docker compose --env-file deployment/.env -f deployment/compose.yaml config --quiet
```

**Do not use `docker compose down -v` or destructive database commands.** The normal stop/restart actions do not remove persistent volumes.

## 9. Troubleshooting

### Problem A — Website shows **502 Bad Gateway**

**What this means:** Nginx received the browser request but could not talk to Laravel's PHP-FPM backend.

This was observed after the Laravel container was recreated during Docker startup while Nginx stayed running. Logs showed `connect() failed (111: Connection refused)` for `fastcgi://172.19.0.5:9000`. Restarting Nginx restored access. A stale resolved backend IP is a **likely explanation**, but it should be confirmed against the actual configuration/logs if the error repeats.

**Quick fix (does not delete data):**

```powershell
docker restart apakhabar-docker-web-1
```

Refresh **http://localhost:8088** and test **http://localhost:8088/api/news**.

If the website still returns 502:

```powershell
docker logs apakhabar-docker-web-1 --tail 50
docker logs apakhabar-docker-app-1 --tail 50
docker ps
```

- `Connection refused`: backend endpoint not accepting connections, or Nginx is targeting the wrong/old address.
- `host not found in upstream`: backend service-name / DNS resolution issue.
- `upstream timed out`: backend did not respond within the configured time.

**Important:** `http://localhost:8088/healthz` may return `200` while the Laravel website itself still returns `502`. Test `/` or `/api/news` as well. If this frequently happens after `-Build`, the Docker/Nginx configuration should be reviewed for service-name DNS refresh instead of relying on manual restarts.

### Problem B — Docker says “Waiting” repeatedly

Usually normal during startup: MariaDB, AI, and Laravel may need time to become healthy. Check for eventual `Healthy` output, then `docker ps`. If a service never becomes healthy, inspect its logs.

### Problem C — Website works on laptop, but not on phone

Check that phone and laptop are on the **same Wi-Fi**, that the phone uses the latest **LAN IP** (not `localhost`), and that the launcher printed a LAN website address. Some guest networks have Wi-Fi client isolation enabled.

If Windows Firewall blocks port **8088**, an administrator may add a narrowly scoped rule after checking the correct network interface and IP (run as Administrator and substitute your current Wi-Fi IP):

```powershell
New-NetFirewallRule -Name ApaKhabar-Docker-LAN-8088 -DisplayName 'ApaKhabar Docker development API (Wi-Fi)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8088 -LocalAddress YOUR_LAPTOP_WIFI_IP -RemoteAddress LocalSubnet -InterfaceAlias 'Wi-Fi' -Profile Private
```

After changing Wi-Fi/IP, review/update any address-specific firewall rule. To disable that development rule in Administrator PowerShell:

```powershell
Disable-NetFirewallRule -Name ApaKhabar-Docker-LAN-8088
```

Avoid broad firewall exposure or publishing internal DB/AI ports.

### Problem D — Mobile app loads but cannot fetch news

Make sure Docker is running and that the mobile environment uses `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAPTOP_WIFI_IP:8088/api`, **not** port `8000`, `127.0.0.1`, or `localhost`. Test `/api/news` from the phone's browser and restart Expo with `npx expo start --lan --clear` after changing its environment value.

### Problem E — Changes to the backend are not showing

Run a rebuild if your Docker image copies the changed application code/dependencies:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1 -Build
```

If the website then shows 502, use the Nginx restart workaround in Problem A and report repeated occurrences to the maintainer.

### Problem F — Docker cannot start or a port is already in use

Verify Docker Desktop is running, inspect the error text, and check for another process already using **8088**. The launcher can fall back from LAN to localhost when LAN binding fails, but it cannot fix a localhost port conflict automatically.

### Problem G — Missing database tables or missing teammate data

GitHub does **not** contain Docker database records by default. Check whether you initialized a new database or need an **approved backup/import** from the team. Never run destructive migrations against populated volumes.

## 10. Database and persistent data — please read

Docker uses its **own** MariaDB database, separate from any XAMPP database.

Typical internal settings:

```env
DB_HOST=db
DB_PORT=3306
DB_DATABASE=apakhabar_docker
```

The actual DB username/password come from `deployment/.env`; the Compose project's default username is `apakhabar` (the original guide also showed an installation-specific `apakahbar` value). **Use your configured values, not a guessed username.**

Docker volumes preserve MariaDB records, uploaded files, Chroma vectors, FastAPI uploads, and AI checkpoints across normal container restarts and recreations. Keep regular backups. **Do not delete existing volumes, reset the database, or run `migrate:fresh`.**

## 11. AI, external services, and optional features

| Service / API | Use |
| --- | --- |
| Gemini (writer) | Generate news drafts |
| Gemini (embeddings) | Generate document embedding vectors |
| OpenAI evaluator | Evaluate generated news |
| OpenAI moderation | Flag potentially harmful comments |
| Meta Graph API | Facebook/Instagram publishing |
| Cloudinary | Social-publishing media |
| Whapi | WhatsApp broadcasts |
| Bulk360 / Vonage | SMS broadcasts |
| Gmail SMTP | Email and password-reset messages |

AI generation flow: **Laravel → FastAPI → Chroma retrieval → Gemini writing → OpenAI evaluation → Laravel response**. Which features work depends on valid credentials and service readiness.

### Reindex document embeddings (advanced)

The guide's embedding configuration uses **`gemini-embedding-001` with 768 dimensions**. Changing embedding providers requires reindexing approved information into the appropriate Chroma collection.

```powershell
# Preview first
docker compose --env-file deployment/.env -f deployment/compose.yaml exec app php artisan ai:reindex-approved-information

# Execute only after reviewing the preview; this may incur Gemini API charges
docker compose --env-file deployment/.env -f deployment/compose.yaml exec app php artisan ai:reindex-approved-information --execute
```

### LibreTranslate translation service

LibreTranslate starts with the Docker stack and is available internally at `http://libretranslate:5000`, not as a public host port. The configured model cache contains English, Indonesian and Malay support; Indonesian↔Malay may translate via English. On a fresh installation, initial downloads may take time. The translation service uses a separate **external model volume**; see section 3.

The existing deployment documents `libretranslate/libretranslate:v1.9.6`, `LT_LOAD_ONLY=en,id,ms`, a 12,000-character limit, a batch limit of 20, and a cache at `/home/libretranslate/.local`. Avoid launching the historical `compose.translation.yaml` project simultaneously against the same volume. If translation is unavailable, the website may report translation temporarily unavailable (503). Translation loads CPU models into memory; allow additional Docker RAM (roughly 1–2 GiB initially) and assess actual usage.

## 12. Scheduler behavior (maintainer reference)

The scheduler uses `deployment/docker/scheduler.php` to run Laravel's `php artisan schedule:run` at minute boundaries, preserving schedules in `routes/console.php` and existing queue dispatches/overlap locks.

On `SIGTERM`, it stops launching new scheduled runs and lets active runs finish before exiting with code `0`. Its scheduler-only shutdown grace period is **60 seconds**, while document, generation, and video queue workers keep their **1,400-second** grace periods. Shutdown ordering drains scheduler activity before workers, then DB/AI dependencies; active work may extend overall shutdown duration.

If changing scheduler behavior, avoid forcing a shutdown timeout shorter than active tasks need; long work should normally be queued. The LAN Compose override inherits these settings.

**Previously verified on 13 November 2026:** idle/active isolated supervisor tests exited cleanly; base-stack shutdown was **3.96 seconds** and LAN-stack shutdown **4.95 seconds** under the tested workloads. The prior old scheduler required a **one-time** termination to migrate; this is not part of the daily setup. A reported 12–14-second task slowdown was **not reproduced** and must not be described as a confirmed fixed SQL timeout.

Optional isolated regression test (advanced, fake artisan tasks; no live database jobs):

```powershell
$deploymentPath = (Resolve-Path deployment).Path
docker run --rm --entrypoint php --mount "type=bind,source=$deploymentPath,target=/verify,readonly" apakhabar-docker-app:latest /verify/tests/scheduler-shutdown.php
```

## 13. Azure / production deployment (not covered by this local manual)

Future Azure deployment needs separate production environment variables, HTTPS/domain, secure DB connections, backups, firewall rules, and a public mobile API address. Local Docker database records and uploaded files are **not automatically transferred** to Azure. Do **not** reuse the LAN startup script or its local bindings as a production deployment configuration.

---

## Final checklist

- [ ] Docker Desktop is running.
- [ ] Repo A and Repo B are available; `AI_REPO_PATH` is correct.
- [ ] Required `.env` files and API credentials are configured privately.
- [ ] Translation-model volume exists.
- [ ] `start-local.ps1` completed; `docker ps` shows running containers.
- [ ] Website (`/`) and `/api/news` load successfully on the laptop.
- [ ] For Expo: phone and laptop share Wi-Fi, mobile API URL uses detected LAN IP and port `8088`.
- [ ] If 502 happens, restart only Nginx and inspect logs if it persists.

**For regular development: open Docker Desktop → run `start-local.ps1` → open `http://localhost:8088`.**

## Separate production configuration (Azure preparation)

`compose.production.yaml` is standalone. Do not combine it with `compose.yaml`
or `compose.lan.yaml`. The local launcher and local files retain their current behavior.
The production file preserves all nine services, worker commands, scheduler shutdown
ordering, upload limits and persistent mount paths. Only Nginx publishes ports.
The network permits outbound access for AI providers and other integrations.
JSON container logs rotate at 10 MB with three files; Laravel logs to stderr.
No Azure resources, TLS certificates, secrets, backups or migrated data are created
by these files. Configuration validation is not runtime or production readiness verification.

### Prepare private configuration

On the eventual Linux host, keep the two source repositories in the same relative
layout as locally, or set `AI_REPO_PATH` and `AI_DOCKERFILE` explicitly. Include the
reviewed AI repository changes in the deployed revision. From the main repository:

```sh
cp deployment/production/.env.example deployment/production/.env
cp deployment/production/laravel.env.example deployment/production/laravel.env
cp deployment/production/ai.env.example deployment/production/ai.env
chmod 600 deployment/production/.env deployment/production/laravel.env deployment/production/ai.env
```

Edit these files privately on the host. Never paste secrets into chat. The actual
files and private TLS keys are ignored by Git and excluded from the main build
context. The AI Dockerfile has its existing allowlist-only build context.
Use literal `NAME=value` assignments (optionally quoted), without interpolation,
backslash escapes, multiline values or inline comments. The validator intentionally
rejects ambiguous dotenv syntax. A value containing `$` or a backslash needs a
reviewed alternate secret injection strategy before deployment.

- `.env`: Compose inputs, public HTTPS origin, database credentials, shared token,
  explicit volume names, repository paths and an absolute TLS directory.
- `laravel.env`: Laravel production settings and integrations. Keep APP_URL,
  DB_DATABASE, DB_USERNAME, DB_PASSWORD and APAKHABAR_AI_SERVICE_TOKEN identical to
  `.env`; Compose explicitly overrides these settings in every Laravel service.
- `ai.env`: FastAPI settings and shared token. Gemini embeddings require
  EMBEDDING_API_KEY independently of the writer's AI_API_KEY. Retain the existing
  collection's embedding model and dimensions. The normal production build supports
  Gemini/OpenAI embeddings; local model dependencies need a separate reviewed build.

Replace every populated placeholder. For integrations intentionally disabled, clear
their related placeholder values together. SMTP is needed for email-based account
flows; configure and test a real sender. OpenAI moderation and the configured AI
writer, embedding and enabled evaluator credentials are required. Presence checks
cannot confirm credential validity or provider permissions. Configure Cloudinary
and Meta credentials before exercising their features. Review other optional
broadcast channels before enabling them.

Retain the existing APP_KEY when moving encrypted data; do not generate or rotate
it blindly. Previously exposed credentials still require provider-side remediation
and a separate APP_KEY migration assessment. This configuration does not fix Git
history exposure.

### Domain, certificates and OAuth

Point a chosen domain to the eventual VM. Provision a valid certificate externally
before starting Nginx. `TLS_CERT_DIR` must be an absolute host directory containing
`fullchain.pem` and `privkey.pem`; mount it read-only. If using certificate symlinks,
ensure their targets are also reachable inside the mounted directory, or publish
regular files into this directory using a controlled renewal hook. Restrict key
permissions while allowing container Nginx to read it. Never put the directory in
Git or either repository's build context.

Nginx redirects HTTP to HTTPS and tells PHP-FPM that requests are secure. The
validator expects standard host ports 80/443. The private container-only port 8080
is an Nginx liveness check, not a Laravel/database/provider health test.
The preflight checks certificate-file presence only: verify certificate validity,
chain, hostname, key match and Nginx syntax on the target host before traffic.

Use a DNS-based certificate challenge or an external provisioning method; this
configuration does not serve HTTP ACME challenges. Automate renewal externally and
reload Nginx after renewed files are installed. Reloading or starting services is
a later operational step and has not been performed during preparation.

Set FACEBOOK_REDIRECT_URI to the exact APP_URL origin followed by
`/admin/social/facebook/callback`. Register the same URI with Meta. Provider-side
app configuration and callback testing remain required.

### Volume identity and migration

All production volume names are explicit and distinct. The default production
names create a separate data set when the stack is eventually started. Never start
against an empty database expecting local data to appear automatically. MariaDB
initialization variables only apply to a fresh database volume; changing passwords
in env files does not change existing database users.

Inspect existing volume identities and take database-consistent backups before
selecting any existing volume. Do not attach the live local database/AI/storage
volumes to a second running stack. No volumes are renamed, deleted, copied or
migrated by this preparation. Named volumes on your laptop do not transfer to Azure.
Back up MariaDB, Laravel storage, AI uploads, Chroma and checkpoints, and preserve
or deliberately rebuild model caches. Restore and verify in isolation first.

The translation-model volume is external and must already exist with appropriate
models and ownership on the target host. Choose its name deliberately. Do not
create an empty replacement and assume translation is ready. The launcher still
does not create this external volume automatically.

### Read-only validation

From the main repository, with Python 3.10+ and Docker Compose available:

```sh
python3 deployment/validate-production.py
# On the target host: also check Engine access and the external translation volume.
python3 deployment/validate-production.py --docker
```

The first command checks files, placeholders, safe production settings, matching
credentials, internal endpoints, persistent paths, TLS-file presence and resolved
Compose settings. It needs the Compose CLI but does not need a running Engine.
It captures resolved configuration privately and never prints values or raw Docker
errors. `--docker` only inspects the external volume; it does not start containers.
A failing check exits nonzero. Do not run `docker compose config` without `--quiet`
against real configuration in shared logs: its output includes secrets.

Production structure can be validated with templates and dummy values, but that
cannot satisfy the production preflight. Do not use templates as real credentials.
Use this exact Compose selection for later reviewed operational commands:

```sh
docker compose --env-file deployment/production/.env -f deployment/compose.production.yaml config --quiet
```

Avoid ambient environment variables overriding Compose inputs. The Python preflight
sanitizes matching variables for its subprocess; run eventual operational commands
from a controlled shell. Do not use the local launcher to start production.

### Remaining gates before Azure testing and public launch

Preparation does not start the stack. Before Azure testing, resolve exposed
credentials, choose a domain/certificate process, select VM capacity, and prepare
verified database/volume restores. Permit inbound 80/443 and restrict SSH to intended
administrators through Azure and host firewalls; do not expose internal service ports.
Before public launch, test Laravel, all workers, scheduler, AI providers, translation,
media uploads, Meta callbacks, email and the mobile API. Set the mobile release
EXPO_PUBLIC_API_BASE_URL explicitly to the production HTTPS `/api` URL.

Automated off-host backups, retention and restore drills still need implementation.
Set resource limits after measuring AI, translation, video and database workloads;
this preparation does not invent VM capacity or impose untested memory limits.
Video temporary crop files remain container-local. Gemini reindex completion,
native AI `.env` alignment, local LAN OAuth callback behavior, and obsolete testing
Compose services remain unresolved and unchanged. Container liveness alone cannot
verify any of these items. The known obsolete `compose.testing.yaml` is not part
of production validation.
