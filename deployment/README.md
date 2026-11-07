# Unified hosted AI Docker deployment

The single Compose project is `apakhabar-docker` in Repo A. Its `ai` image builds Repo B from `AI_REPO_PATH`; neither source tree is moved or copied into the other repository. Nginx is the only service with a host port. Laravel, MariaDB, queue workers, scheduler, FastAPI, persistent Chroma, uploads, and LangGraph checkpoints stay on the Compose network. PHP application and worker images include FFmpeg and ffprobe. Optional LibreTranslate remains under the `translation` profile.

## Request path

`Laravel NewsGenerationService -> ai:8001/news/generate -> FastAPI AgentService -> LangGraph EditorialWorkflow -> Gemini writer -> independent OpenAI Reflection judge -> Laravel`.

FastAPI also serves document extraction and retrieval. Chroma uses OpenAI embeddings through `/embeddings`; Ollama is not called by current Repo B code. Gemini and the judge use distinct OpenAI-compatible Chat Completions endpoints, keys, model IDs, timeouts, and prompts. The separate Laravel `OPENAI_API_KEY` config is for comment moderation at `/v1/moderations`, not the AI judge.

The current application code has an `AGENT_ENABLED=false` legacy generation branch and a writer self-review path when `EVALUATOR_ENABLED=false`. Compose forces both flags true. No llama.cpp or Ollama services or model mounts are present. Outbound HTTPS from `ai` must reach `generativelanguage.googleapis.com` and `api.openai.com`; Laravel's existing integrations also need outbound access.

## Configure

Copy `.env.example`, `laravel.env.example`, and `ai.env.example` to their untracked counterparts in `deployment/`. Keep distinct Docker database passwords and a shared Laravel/FastAPI service token in `.env`. Set `AI_API_KEY` to a Gemini key and `EVALUATOR_API_KEY` to an OpenAI key in `ai.env`. Set `EMBEDDING_API_KEY` to an OpenAI key there as well; it may equal the judge key. Verify the chosen `AI_MODEL` and `EVALUATOR_MODEL` are available to the respective accounts. The model IDs in `ai.env` are `gemini-2.5-flash`, `gpt-4.1-mini`, and `text-embedding-3-small`. AI secrets must not enter Vite variables, Docker build arguments, or tracked files.

`deployment/ai.env` owns the FastAPI provider, model, workflow, and Docker storage settings. Compose supplies the shared service token from `deployment/.env` to both Laravel and FastAPI. Hosted requests cannot work until the three API key variables in `ai.env` are supplied. Repo B's own `.env` is excluded from the image build and is not used by this Compose project.

The embedding switch changes the Chroma collection fingerprint and dimension from prior Ollama embeddings. Preserve `ai_chroma` and reindex documents/information through the application before expecting old content in the new collection. Do not delete the old volume as part of this configuration change.

## Verify and operate

Run `docker compose --env-file .env -f compose.yaml config --quiet` from `deployment/` after setting secrets. Build and start only after checking the Docker engine and the two provider accounts. `/health` verifies the FastAPI process, not provider credentials, quota, generation, or judging. Exercise a disposable generation and RAG indexing/query to verify those paths. No migration, seeder, model download, or XAMPP access runs in an image entrypoint. Avoid running Docker and XAMPP workers against the same database.

Older `PHASE2*.md` reports and `compose.testing.yaml` describe the previous local-model testing setup; they are historical and should not be used as an override for this architecture.
