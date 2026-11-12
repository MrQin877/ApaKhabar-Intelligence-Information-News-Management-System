# Unified hosted AI Docker deployment

The single Compose project is `apakhabar-docker` in Repo A. Its `ai` image builds Repo B from `AI_REPO_PATH`; neither source tree is moved or copied into the other repository. Nginx is the only service with a host port. Laravel, MariaDB, queue workers, scheduler, FastAPI, persistent Chroma, uploads, and LangGraph checkpoints stay on the Compose network. PHP application and worker images include FFmpeg and ffprobe. Optional LibreTranslate remains under the `translation` profile.

## Request path

`Laravel NewsGenerationService -> ai:8001/news/generate -> FastAPI AgentService -> LangGraph EditorialWorkflow -> Gemini writer -> independent OpenAI Reflection judge -> Laravel`.

FastAPI also serves document extraction and retrieval. The current Docker AI environment uses `gemini-embedding-001` at 768 dimensions for Chroma. Gemini writing and OpenAI judging use separate hosted Chat Completions endpoints and keys. The separate Laravel `OPENAI_API_KEY` config is for comment moderation at `/v1/moderations`.

The current application code has an `AGENT_ENABLED=false` legacy generation branch and a writer self-review path when `EVALUATOR_ENABLED=false`. Keep both flags true in `ai.env` for the independent judge workflow. No llama.cpp or Ollama services are present. Outbound HTTPS from `ai` must reach `generativelanguage.googleapis.com` and `api.openai.com`; Laravel's existing integrations also need outbound access.

## Configure

Copy `.env.example`, `laravel.env.example`, and `ai.env.example` to their untracked counterparts in `deployment/`. Keep distinct Docker database passwords and a shared Laravel/FastAPI service token in `.env`. Set `AI_API_KEY` to a Gemini writing key, `EVALUATOR_API_KEY` to an OpenAI judging key, and `EMBEDDING_API_KEY` to a Gemini embedding key in `ai.env`. The two Gemini keys may be the same if permitted by the account. AI secrets must not enter Vite variables, Docker build arguments, or tracked files.

`deployment/ai.env` owns the FastAPI provider, model, workflow, and Docker storage settings. Compose supplies the shared service token from `deployment/.env` to both Laravel and FastAPI. Hosted writing and judging need their respective API keys. Repo B's own `.env` is excluded from the image build and is not used by this Compose project.

The embedding provider, model, and dimensions determine the Chroma collection fingerprint. Gemini and EmbeddingGemma have different fingerprints even at 768 dimensions. Preserve `ai_chroma`; existing approved vectors remain in their old collection. After the AI service is running, preview eligible information with `php artisan ai:reindex-approved-information` in the Docker Laravel container. Review the count and use `--execute` to index approved, active information from unarchived documents into the new Gemini collection. Add `--owner=ID` to limit a run. The command upserts in batches and can be resumed; it does not delete old collections. Each embedding request may incur provider charges.

## Local EmbeddingGemma cache

Local EmbeddingGemma remains optional. Build the AI image with `docker compose --env-file deployment/.env -f deployment/compose.yaml build --build-arg INSTALL_LOCAL_EMBEDDINGS=true ai` when selecting it. Compose mounts a separate persistent `ai_model_cache` volume at `/app/data/huggingface` and sets `HF_HOME` there. Repo B loads this model with `local_files_only=True`, so the model must already exist in that cache before local RAG indexing or search. Container recreation retains the cache volume.

Accept the model's access terms on Hugging Face and create a read token with access to that model. Then run `powershell -ExecutionPolicy Bypass -File deployment/seed-embeddinggemma.ps1` from Repo A. The script prompts for the token without echo, downloads into the project-labeled cache volume, clears the process environment variable, and verifies an offline 768-dimensional query in a disposable container. Do not paste the token into chat or put it in a tracked file. Do not change `EMBEDDING_MODEL`, dimensions, or the Chroma volume to work around an empty cache. A successful image build verifies packages only; it does not populate or test the model cache.

## Verify and operate

Run `docker compose --env-file .env -f compose.yaml config --quiet` from `deployment/` after setting secrets. Build and start only after checking the Docker engine and the two provider accounts. `/health` verifies the FastAPI process, not provider credentials, quota, generation, or judging. Exercise a disposable generation and RAG indexing/query to verify those paths. No migration, seeder, model download, or XAMPP access runs in an image entrypoint. Avoid running Docker and XAMPP workers against the same database.

Older `PHASE2*.md` reports and `compose.testing.yaml` describe the previous local-model testing setup; they are historical and should not be used as an override for this architecture.
