ï»¿# ApaKhabar â€” Docker Deployment

This guide explains how to set up and run ApaKhabar using Docker.

Docker runs the Laravel website, FastAPI AI service, MariaDB database, and background workers together. You do not need XAMPP or `composer run dev`.

## 1. Project Overview

ApaKhabar uses two separate repositories:

- **Repo A â€” ApaKhabar Website:** Laravel backend, website, and Docker configuration.
- **Repo B â€” ApaKhabar AI Service:** FastAPI, document extraction, RAG, and AI news generation.

Docker Compose is managed in Repo A and connects to Repo B through `AI_REPO_PATH`.

The Docker environment includes:

- **Laravel + Nginx** â€” Runs the website and backend APIs.
- **MariaDB** â€” Stores news, users, comments, broadcasts, and other data.
- **FastAPI** â€” Handles AI document extraction, retrieval, and news generation.
- **Queue Workers** â€” Handle document processing, AI generation, and video publishing.
- **Scheduler** â€” Runs scheduled Laravel tasks.
- **Chroma** â€” Stores document embeddings for RAG.
- **LibreTranslate** â€” Internal translation service, started with the main project.

## 2. API Usage

ApaKhabar uses the following external APIs:

- **Google Gemini (Writer):** Generates news content from provided information.
- **Google Gemini (Embeddings):** Converts approved document information into vectors for AI retrieval.
- **OpenAI (Evaluator):** Reviews and evaluates AI-generated news.
- **OpenAI Moderation:** Detects potentially harmful comments.
- **Meta Graph API:** Publishes news to Facebook and Instagram.
- **Cloudinary:** Handles media for social media publishing.
- **Whapi:** Sends WhatsApp broadcasts.
- **Bulk360 / Vonage:** Sends SMS broadcasts.
- **Gmail SMTP:** Sends emails and password reset links.

### AI News Generation Workflow

1. Laravel sends a request to FastAPI.
2. FastAPI retrieves relevant approved information from Chroma.
3. Gemini generates the news content.
4. OpenAI evaluates the generated content.
5. FastAPI returns the result to Laravel.

Keep `AGENT_ENABLED=true` and `EVALUATOR_ENABLED=true` in `deployment/ai.env` to enable the LangGraph workflow and independent evaluation.

## 3. Requirements

Install the following:

- Docker Desktop with Linux containers enabled.
- Git.
- Repo A and Repo B.

Make sure `AI_REPO_PATH` in `deployment/.env` points to the correct Repo B folder.

## 4. Environment Setup

Open a terminal in the **Repo A root folder**.

Create the environment files from the provided examples:

```powershell
Copy-Item deployment/.env.example deployment/.env
Copy-Item deployment/laravel.env.example deployment/laravel.env
Copy-Item deployment/ai.env.example deployment/ai.env
```

Only copy these files during first-time setup. Do not overwrite existing configured files.

### Environment Files

- `deployment/.env` â€” Docker database credentials, port, and shared AI service token.
- `deployment/laravel.env` â€” Laravel configuration and external API credentials.
- `deployment/ai.env` â€” Gemini, OpenAI, embeddings, and FastAPI settings.

Fill in the required API keys, passwords, and environment values.

Important AI variables:

- `AI_API_KEY` â€” Gemini API key for news generation.
- `EMBEDDING_API_KEY` â€” Gemini API key for document embeddings.
- `EVALUATOR_API_KEY` â€” OpenAI API key for AI evaluation.
- `OPENAI_API_KEY` â€” OpenAI API key for Laravel comment moderation.
- `APAKHABAR_AI_SERVICE_TOKEN` â€” Shared token used by Laravel and FastAPI.

For a new installation, configure a Laravel `APP_KEY`. If restoring existing encrypted data, retain its original key.

**Never commit real `.env` files or API keys to GitHub.**

## 5. Start Docker

First, open Docker Desktop and make sure the Docker Engine is running.

Run the following commands from the Repo A root directory.

| Command | What it does | When to use it |
| --- | --- | --- |
| `docker compose ... up -d --no-build` | Starts/recreates services using existing images and the explicitly selected Compose files; does not detect the LAN IP. | Direct Compose startup; the base-file command in section 6 uses localhost only. |
| `start-local.ps1` | Detects the LAN IP, validates configuration and starts services without rebuilding. | Recommended daily PowerShell startup. |
| `start-local.ps1 -Build` | Performs the same LAN detection and validation, then builds images and starts services. | First build or changes to application code, dependencies or Dockerfiles. |
| `start-local.ps1 -CheckOnly` | Detects the LAN IP, validates configuration and prints planned URLs without changing containers. | Check the setup before starting. |

### Recommended PowerShell Startup

```powershell
# Daily startup
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1

# First build or changed code/dependencies/Dockerfiles
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1 -Build

# Validate only; do not start or change containers
powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\start-local.ps1 -CheckOnly
```

The launcher automatically detects the current physical LAN/Wi-Fi IPv4 address
and applies `compose.lan.yaml` for phone access; no manual `LAN_IP` edit is needed.
It falls back to localhost if LAN discovery fails and does not rewrite `.env`.
See the physical-phone section below for adapter selection and LAN details.

Building starts Laravel, MariaDB, FastAPI, Nginx, LibreTranslate, the queue workers,
and scheduler. Before first startup, configure the external translation model
volume as described in section 9. For a new database, initialize the required
Laravel tables using reviewed migrations. Do not reset an existing database.

### Open Website

Once all required containers are healthy:

http://localhost:8088

### Physical phone / Expo on local Wi-Fi (development only)

Use the recommended PowerShell launcher commands above for local phone access.

Add `-Build` for a first build or changed application code, `-CheckOnly` to detect and validate without changing containers, or `-LocalhostOnly` for laptop-only access. Paths resolve relative to the script, so it can also run from another directory. The launcher uses the existing Compose project and volumes; it never runs `down`, removes volumes, or migrates the database. An external translation model volume must already exist (section 9).

The launcher selects an up physical adapter with a preferred, non-link-local IPv4 address and a default route, ordered by route plus interface metric. It excludes virtual/VPN adapters; use `-InterfaceAlias 'Wi-Fi'` to choose between physical adapters. Detection is repeated on every start and overrides any stale `LAN_IP` only in the child Compose process environment. No IP is written to `.env`. Missing/disconnected adapters or failed discovery result in localhost-only access.

The LAN override **replaces** the base ports with exactly `127.0.0.1:8088:80` and `DETECTED_IP:8088:80`. These distinct addresses can coexist; a wildcard `0.0.0.0:8088` would overlap them. Compose must support `!override` (2.24.4 or newer). The launcher validates the resolved mappings and checks that other services publish no ports before startup. If Docker rejects the LAN binding, it retries with the base localhost-only configuration; a localhost port already occupied by another application still needs to be freed. Other startup errors are reported without an automatic retry.

Laravel's `APP_URL` uses the LAN address for mobile media and generated links while LAN access is enabled. Localhost remains available. MariaDB, FastAPI, and LibreTranslate publish no host ports; the displayed `/api` URLs are Laravel APIs, which call FastAPI internally. The launcher prints website/API URLs and container status after startup; services may still be warming up. Do not use this launcher or LAN override for Azure.

On the same Wi-Fi, set the mobile app's `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAPTOP_WIFI_IP:8088/api`, then restart Expo with `npx expo start --lan --clear`. The automatic Expo development fallback uses port 8000, so supply this explicit override for Docker. Check `/api/news` in the phone browser first. Wi-Fi client isolation can block communication even with correct Docker settings.

If Windows blocks the connection, run a narrowly scoped rule in an Administrator PowerShell, substituting the current Wi-Fi address:

```powershell
New-NetFirewallRule -Name ApaKhabar-Docker-LAN-8088 -DisplayName 'ApaKhabar Docker development API (Wi-Fi)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8088 -LocalAddress YOUR_LAPTOP_WIFI_IP -RemoteAddress LocalSubnet -InterfaceAlias 'Wi-Fi' -Profile Private
```

Rerun the launcher after changing networks; `up` recreates containers whose configuration changed while retaining their volumes. Docker Desktop restart policies reuse the last binding, so use the launcher after a laptop/network restart too. Update any manually created address-specific firewall rule after the Wi-Fi address changes; the launcher does not modify firewall rules. To return to laptop-only access, run the launcher with `-LocalhostOnly`; disable the development firewall rule with `Disable-NetFirewallRule -Name ApaKhabar-Docker-LAN-8088` in Administrator PowerShell.

## 6. Common Docker Commands

Run these commands from the Repo A root directory.

### Start Everything

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml up -d
```

### Build and Start

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml up -d --build
```

### Start Without Rebuilding

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml up -d --no-build
```

### Check Container Status

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml ps
```

### View Logs

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml logs --tail=50
```

### Stop All Services

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml stop
```

### Restart Services

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml restart
```

### Validate Docker Configuration

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml config --quiet
```

Stopping containers does not delete your database or persistent volumes.

If you update application code, dependencies, or Dockerfiles, rebuild the affected images to apply the changes.

## 7. Database and Storage

Docker uses its own MariaDB database, separate from XAMPP.

Default database settings:

```env
DB_HOST=db
DB_PORT=3306
DB_DATABASE=apakhabar_docker
DB_USERNAME=apakahbar
```

Use the actual username configured in `deployment/.env`. The Compose default in the current project is `apakhabar`.

The following data is stored in persistent Docker volumes:

- MariaDB records.
- Laravel uploaded files.
- Chroma vectors.
- FastAPI uploads.
- AI agent checkpoints.

Docker volumes preserve data when containers are stopped or recreated. However, they should still be backed up regularly.

Teammates do not automatically receive existing database records when pulling from GitHub.

## 8. Gemini Embeddings

ApaKhabar uses `gemini-embedding-001` with 768 dimensions for document retrieval.

When changing embedding providers, approved information must be reindexed into the new Chroma collection.

### Preview Information

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml exec app php artisan ai:reindex-approved-information
```

### Reindex Approved Information

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml exec app php artisan ai:reindex-approved-information --execute
```

The second command sends requests to the Gemini API and may incur charges.

Review the preview before running the reindex command.

## 9. Website Translation

LibreTranslate starts automatically with normal `docker compose up -d`; no profile is required. Laravel uses `http://libretranslate:5000`. The service publishes no host port and is reachable through the Compose network. Keep the historical root `compose.translation.yaml` project stopped to avoid running a second translation server.

`TRANSLATION_MODELS_VOLUME` in `deployment/.env` selects an external Docker volume. This installation reuses `apakhabar-intelligence-information-news-management-system_translation_models` from the old stopped container. The old container and volume are retained. Both services use `libretranslate/libretranslate:v1.9.6`, the same `/home/libretranslate/.local` cache layout, `LT_LOAD_ONLY=en,id,ms`, a 12,000-character limit and a batch limit of 20. Cached packages include Englishâ†”Indonesian and Englishâ†”Malay; Indonesianâ†”Malay uses English as a pivot.

For a fresh teammate setup, the example selects `apakhabar-docker_translation_models`. Create that external volume once before startup:

```powershell
docker volume create apakhabar-docker_translation_models
```

An empty volume requires initial language-model downloads. To reuse an existing compatible cache instead, set `TRANSLATION_MODELS_VOLUME` to its exact Docker volume name. Never run both old and new services against the same cache concurrently. Existing volumes are not removed by this integration.

Check readiness with `docker compose --env-file deployment/.env -f deployment/compose.yaml ps libretranslate`. The `/languages` API should list `en`, `id`, and `ms`. Website requests go through `/website/translate`; if the service is temporarily unavailable, Laravel returns a safe 503 and the website shows its translation-unavailable message.

The image uses four Gunicorn workers. Translation loads CPU models into memory as requests arrive; allow roughly 1â€“2 GiB of additional Docker memory initially and measure under real concurrency before setting a hard limit. CPU-only ONNX device-detection and Requests dependency-version warnings may appear in this pinned upstream image; health and translation tests should be checked independently.

## 10. Microsoft Azure Deployment

ApaKhabar will later be deployed to Microsoft Azure using Docker.

Before cloud deployment, configure:

- Production environment variables.
- HTTPS and a public domain.
- Secure database connections.
- Persistent storage and backups.
- Firewall and network settings.
- Mobile API connection to the Azure backend.

The Expo mobile application runs separately and connects to Laravel through its API.

Local Docker database records and uploaded files are not automatically transferred to Azure.

## Important Notes

- Open Docker Desktop before running Docker commands.
- XAMPP and `composer run dev` are not required.
- Keep both Repo A and Repo B available when building images.
- Keep API keys and passwords private.
- Do not delete existing Docker volumes or databases.
- Do not run destructive migrations such as `migrate:fresh`.
- Rebuild images when changing application code or dependencies.


## Scheduler shutdown

The scheduler uses `deployment/docker/scheduler.php` to launch the existing
`php artisan schedule:run` at minute boundaries. All schedules in
`routes/console.php` and their overlap locks/queue dispatches are unchanged.

On SIGTERM the supervisor stops accepting new minute runs, waits for every active
run to finish, then exits with code 0. It does not terminate active task processes.
The scheduler explicitly overrides PHP-FPM's inherited SIGQUIT with SIGTERM and
uses a 60-second shutdown budget. If future scheduled callbacks regularly take
longer, increase this scheduler-specific budget before deploying them; long work
should continue to be dispatched to the existing queues. Document, generation
and video queue workers retain their 1,400-second grace periods.

The scheduler depends on the workers as well as MariaDB and AI. Compose reverses
this dependency order on shutdown: scheduler drains, workers drain, then their
DB/AI dependencies stop. This prevents schedule callbacks/queue dispatches from
trying to reach services that have already stopped. LibreTranslate is independent
of the current schedule callbacks and can stop concurrently. The LAN override
inherits these shutdown settings without modification.

After pulling this change, rebuild the Laravel image and recreate the scheduler:

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml build scheduler
docker compose --env-file deployment/.env -f deployment/compose.yaml up -d --no-build scheduler
```

For LAN mode, include `-f deployment/compose.lan.yaml` and set `LAN_IP` to the
current Wi-Fi IPv4 address, as required by that override. Avoid `stop -t` overrides
shorter than the configured task-draining budget.

Isolated regression test (fake artisan tasks; no database or application jobs):

```powershell
$deploymentPath = (Resolve-Path deployment).Path
docker run --rm --entrypoint php --mount "type=bind,source=$deploymentPath,target=/verify,readonly" apakhabar-docker-app:latest /verify/tests/scheduler-shutdown.php
```

Validation on 13 November 2026:

- Previous scheduler: inherited SIGQUIT, grace 1,400 seconds, `schedule:work`
  running as PID 1. It continued launching minute runs after a stop request and
  after normal TERM/INT signals. The diagnostic stop remained blocked for 419.18
  seconds until an explicitly approved one-time termination of the idle old
  container allowed migration. This is not a normal graceful baseline measurement;
  the originally reported complete-stop time was about 125 seconds.
- Replacement: isolated active task drained in 2.01 seconds; idle test exited in
  0.01 seconds. Existing minute callbacks ran successfully in roughly 3-31 ms.
- Base full-stack stop: 3.96 seconds; scheduler exited code 0.
- LAN full-stack stop: 4.95 seconds, scheduler exited code 0 about 0.30 seconds
  after SIGTERM. Docker events confirmed workers and MariaDB stopped afterward;
  no scheduler SIGKILL occurred. Existing independent AI/translation services hit
  their own pre-existing stop deadlines in that test; their settings were not
  changed by this scheduler fix.

The previously reported 12-14 second per-task slowdown was not reproduced with
the database kept healthy; it should not be treated as a measured SQL connection
timeout diagnosis. The verified fix removes continued scheduling during shutdown
and ensures dependency availability while runs drain.

These times are workload-dependent. An active queue job can still legitimately
extend full-stack shutdown up to its worker's grace period. No database volumes,
uploads, migrations, schedule definitions or queued jobs were removed.
