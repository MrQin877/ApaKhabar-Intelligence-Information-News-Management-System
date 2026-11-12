# ApaKhabar — Docker Deployment

This guide explains how to set up and run ApaKhabar using Docker.

Docker runs the Laravel website, FastAPI AI service, MariaDB database, and background workers together. You do not need XAMPP or `composer run dev`.

## 1. Project Overview

ApaKhabar uses two separate repositories:

- **Repo A — ApaKhabar Website:** Laravel backend, website, and Docker configuration.
- **Repo B — ApaKhabar AI Service:** FastAPI, document extraction, RAG, and AI news generation.

Docker Compose is managed in Repo A and connects to Repo B through `AI_REPO_PATH`.

The Docker environment includes:

- **Laravel + Nginx** — Runs the website and backend APIs.
- **MariaDB** — Stores news, users, comments, broadcasts, and other data.
- **FastAPI** — Handles AI document extraction, retrieval, and news generation.
- **Queue Workers** — Handle document processing, AI generation, and video publishing.
- **Scheduler** — Runs scheduled Laravel tasks.
- **Chroma** — Stores document embeddings for RAG.
- **LibreTranslate** — Optional translation service.

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

- `deployment/.env` — Docker database credentials, port, and shared AI service token.
- `deployment/laravel.env` — Laravel configuration and external API credentials.
- `deployment/ai.env` — Gemini, OpenAI, embeddings, and FastAPI settings.

Fill in the required API keys, passwords, and environment values.

Important AI variables:

- `AI_API_KEY` — Gemini API key for news generation.
- `EMBEDDING_API_KEY` — Gemini API key for document embeddings.
- `EVALUATOR_API_KEY` — OpenAI API key for AI evaluation.
- `OPENAI_API_KEY` — OpenAI API key for Laravel comment moderation.
- `APAKHABAR_AI_SERVICE_TOKEN` — Shared token used by Laravel and FastAPI.

For a new installation, configure a Laravel `APP_KEY`. If restoring existing encrypted data, retain its original key.

**Never commit real `.env` files or API keys to GitHub.**

## 5. Start Docker

First, open Docker Desktop and make sure the Docker Engine is running.

Run the following commands from Repo A.

### First Time — Build and Start

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml up -d --build
```

This builds the images and starts Laravel, MariaDB, FastAPI, Nginx, the queue workers, and scheduler.

For a new database, initialize the required Laravel tables using reviewed migrations. Do not reset an existing database.

### Next Time — Start Existing Containers

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml up -d --no-build
```

### Open Website

Once all required containers are healthy:

http://localhost:8088

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

## 9. Optional Translation

LibreTranslate is optional and is not started by default.

To enable it:

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml --profile translation up -d libretranslate
```

The website can still operate without LibreTranslate.

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
