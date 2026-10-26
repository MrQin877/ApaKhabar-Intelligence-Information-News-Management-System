# Unified local Docker deployment (Phase 1)

This directory prepares one Compose project for the Laravel repository and the separate `ApaKhabar-AI-Service` repository. Phase 1 is configuration only: it does not build images, create containers, copy data, or touch XAMPP.

## Files and paths

- `compose.yaml` owns the services, internal DNS, health checks, and isolated named volumes.
- `docker/laravel.Dockerfile` builds PHP 8.4 with FFmpeg/ffprobe, PHP extensions, Composer dependencies, and production Vite assets. Its `app` target runs PHP-FPM; its `web` target carries the same built public assets in Nginx.
- `docker/ai.Dockerfile` builds the separate Python source tree. It excludes evaluation and optional local EmbeddingGemma/Torch dependencies because the default runtime uses Ollama. Its Dockerfile-specific ignore file excludes local virtual environments, AI data, outputs, and repository secrets from the build context.
- `nginx/default.conf` serves static files and proxies Laravel requests to `app:9000`.
- `.env.example`, `laravel.env.example`, and `ai.env.example` are templates. The corresponding files without `.example` are ignored by Git. Never copy the existing XAMPP `.env` wholesale into Compose.

By default `AI_REPO_PATH` resolves to `C:\Testxampp\htdocs\PROJECT\ApaKhabar-AI-Service` from this repository layout. `AI_DOCKERFILE` is relative to the AI build context. If either repository moves, adjust both paths. The AI repository is not copied into the Laravel repository.

## Service communication

```text
browser -> 127.0.0.1:8088 -> web (Nginx) -> app (PHP-FPM)
app/workers/scheduler -> db:3306 (MariaDB)
app/workers -> ai:8001 (FastAPI, shared service token)
ai -> llama-writer:8080/v1 (Gemma writer)
ai -> llama-judge:8082/v1 (Qwen judge, optional profile)
ai -> ollama:11434 (existing Qwen embedding model; some RAG paths use Ollama directly)
ai -> /app/data/chroma (embedded Chroma PersistentClient)
app -> libretranslate:5000 (optional profile)
app/workers -> Meta Graph API, Cloudinary, mail, and other configured external APIs
```

Only the web service publishes a host port, bound to `127.0.0.1`. Internal services can still make outbound HTTPS calls. `libretranslate` has no host port in this project. When translation is disabled, requests to it will fail gracefully according to the existing Laravel integration.

The `worker-documents` service consumes `documents,default` with five tries and a 1250-second timeout; `default` includes local Shorts processing and therefore needs FFmpeg. `worker-generation` consumes `generation` with a 1250-second timeout. `worker-video` consumes `video-publishing` with a 90-second timeout; scale it to two replicas when ready to match `composer run dev`. The database queue retry period is 1500 seconds. The scheduler is a single `schedule:work` service. No migration or seeder runs in any image entrypoint.

## Storage and secrets

`mariadb_data`, `laravel_storage`, `ai_chroma`, `ai_uploads`, and `ai_checkpoints` are distinct Compose volumes. The Laravel storage volume is shared by PHP app and workers, and mounted read-only into Nginx so `/storage/...` URLs resolve through the built symlink. Chroma is embedded in FastAPI; it is **not** a separate database container. Back up the AI checkpoint SQLite file and its `.runs` companion together.

The writer GGUF and existing Ollama model directory are read-only bind mounts. No service runs `-hf`, `ollama pull`, or a model download command. `create_host_path: false` makes missing paths fail instead of creating empty directories. The optional judge uses a separate GGUF bind. The default AI environment uses the cached Ollama embedding model; switching to EmbeddingGemma requires a separately prepared read-only Hugging Face cache mount and environment change. Never change an embedding model or dimension against existing Chroma data without planning a new collection/reindex.

Create new Docker-only MariaDB passwords and a long nonempty AI service token. Put them in the untracked `deployment/.env`. Put Laravel's `APP_KEY`, Meta/Cloudinary, mail, and other needed integration values in untracked `deployment/laravel.env`. Put AI provider settings in untracked `deployment/ai.env`. For restored Laravel data, retain the backed-up `APP_KEY` so encrypted values remain readable. Do not add secrets to Dockerfiles, build arguments, or `VITE_` variables.

## Prerequisites still to verify

1. `deployment/.env` must point `WRITER_GGUF_PATH` to an existing GGUF file. A 2.65 GiB `gemma-4-E2B-it-Q4_0.gguf` was found in the local Hugging Face cache under `C:\Users\yingx\.cache\huggingface\hub\models--ggml-org--gemma-4-E2B-it-GGUF\snapshots\b4243c156154b6dca9324415f8c7ccc098b4aed1\`. Point to that file if it is the intended writer. Its 0.52 GiB `mmproj` companion is present but is not mounted by this text-only server configuration.
2. `OLLAMA_MODELS_PATH` must point to the existing `C:\Users\yingx\.ollama\models` directory, and its `qwen3-embedding:0.6b` model must load. Manifests for it and `qwen3:4b` exist; full blob integrity has not been tested.
3. The optional `judge` profile needs a judge GGUF file path and enough extra RAM/VRAM. The existing Qwen Ollama manifest is not itself a GGUF path.
4. Verify Docker Desktop's Linux engine, WSL 2, and NVIDIA GPU support before any build. The CLI is installed, but `docker info` could not connect to `dockerDesktopLinuxEngine` during Phase 1. No container image or health-check behavior could be verified against a running engine.
5. Confirm local RAM, VRAM, free disk, and context-size budgets. `WRITER_GPU_LAYERS=0` and `JUDGE_GPU_LAYERS=0` default to CPU. GPU use also needs an explicit Compose GPU allocation override and a suitable llama.cpp image; these have not been assumed.
6. Review whether the pinned base images and Python dependencies build on the machine. Phase 1 did not pull images or run builds. In particular, verify that the llama.cpp server image contains `curl` for its health check; otherwise replace that health check with a supported probe before enabling AI dependencies.
7. Configure `FACEBOOK_REDIRECT_URI` and the corresponding Meta developer-app callback for the Docker URL when testing OAuth. Keep Cloudinary, Meta, mail, and other server credentials in `laravel.env`.

## Phase 1 validation performed

From `deployment/`, both commands passed without starting Docker:

```powershell
docker compose --env-file .env.example -f compose.yaml config --no-env-resolution --quiet
docker compose --env-file .env.example -f compose.yaml --profile judge --profile translation config --no-env-resolution --quiet
```

Resolved paths were inspected: the Laravel build context is this repository; the AI build context is the sibling AI repository; the only published port is `127.0.0.1:8088:80`. Compose syntax validation does not prove images build or services are healthy.

## Phase 2 procedure (only after approval)

1. Back up XAMPP database, Laravel media, and AI data. Create the three untracked environment files from the templates, replace placeholders, and check paths with `Test-Path`. Leave XAMPP unchanged.
2. Start Docker Desktop's Linux engine and verify `docker info`. Validate Compose again with `--quiet` to avoid printing secrets. Build images only after reviewing the configured paths and dependency downloads.
3. Bring up infrastructure and health checks in isolation. Create a fresh Docker MariaDB database; never bind the XAMPP database directory or connect Docker workers to the live database.
4. Restore a **copy** of the XAMPP database and copy media and AI data into the dedicated Docker volumes. Review any pending migrations before running them against the copy; do not seed by default.
5. Test the web and AI services with workers and scheduler stopped. Verify authentication, media URLs, document extraction, Chroma retrieval, model aliases, FFmpeg, and callbacks with safe test data.
6. Enable one queue worker at a time, then the scheduler; test publishing with explicit test accounts and content. Scale video workers to two only after queue behavior is verified.
7. Plan a separate cutover and rollback. Never run both XAMPP and Docker workers/schedulers against the same database.
