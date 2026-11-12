# Phase 2B results — 26 October 2026

Staged testing completed. All five started services were healthy during testing and were subsequently stopped cleanly (exit 0): MariaDB, Laravel PHP-FPM, Nginx, FastAPI, and llama.cpp writer. Persistent volumes and the SQL backup were retained. XAMPP was not switched off or modified. The previous LibreTranslate project remains stopped with its original exit status 137.

## Verified

- Fresh transactional XAMPP export: 52 InnoDB tables, stable counts before/after export; SQL stored under ignored `runtime-test/`. Imported into an empty Docker database using separate credentials. All 52 counts matched and MariaDB table checks passed. Laravel checked 81 foreign-key relationships with zero orphaned references. No migrations or seeders ran.
- Localhost port 8088: home, login, news, videos and health endpoints returned 200. Disposable-user login and authenticated admin Inertia response passed. Built JS/CSS assets returned 200. Public media returned 200; private path was denied with 403. Public/private storage writes passed as www-data. Existing media was not copied or overwritten.
- FastAPI health: 200. Laravel reached FastAPI by service DNS; protected endpoint returned 401 without token and 200 with token.
- Embedded Chroma: explicit test vector persisted across FastAPI restart and queried successfully. FastAPI's KnowledgeService empty-search API passed. Chroma, uploads and checkpoints use distinct named volumes. This does not establish real embedding/retrieval quality; Ollama was not started.
- Writer: existing Gemma GGUF mounted read-only; CPU, four inference threads, one slot, 1024-token context, 4 GiB limit. Small chat request returned HTTP 200 and `OK` in 0.91 seconds (16 prompt tokens, 2 completion tokens). FastAPI structured-output model health probe also returned 200.
- Queue: a single bounded `queue:work` process inside the app container consumed only `phase2b-safe` from separate `phase2b_jobs`. Disposable video generation with FFmpeg and duration verification with ffprobe passed. Intentional failure entered failed_jobs; queue drained to zero. Restored jobs were not consumed. This checks the worker executable and database queue, not production document/video workflow behavior.
- Scheduler definitions listed successfully; scheduler execution remained disabled.

## Resource observations and limits

Docker allocation: 12 CPUs, 7.61 GiB RAM. Intel Iris Xe; CPU inference only.

After short inference, docker stats reported approximately writer 1.138 GiB, FastAPI 120 MiB, PHP 119 MiB, MariaDB 104 MiB, Nginx 13 MiB. These idle working-set figures are not peaks. Writer cgroup memory.peak was 4,061,581,312 bytes (3.78 GiB), close to its 4 GiB cap. No OOM or memory-limit events occurred. Writer accumulated about 23.58 CPU seconds with zero CPU throttling; an exact instantaneous inference CPU peak was not captured. FastAPI startup sampled at 217% CPU, then roughly 0.22% idle.

Inference was stopped after observing the high peak. Long prompts, full agent workflows, 8192-token context, parallel requests, simultaneous embeddings, judge and translation were not tested. The small inference result must not be treated as proof that the full stack fits 7.61 GiB.

## Docker configuration fix and safety

`compose.testing.yaml` blocks outbound traffic for database, application, AI and workers, masks selected integration credentials, uses log mail and a separate queue table, disables database events and enables no restart policy. Only Nginx additionally joins `test-ingress`: a fully internal network alone made the published host port inaccessible on this Docker Desktop setup. Do not omit the testing override when continuing tests against the restored data.

Disposable account, test failure record, generated video, storage probes, and Chroma test collection were removed. The separate empty queue table remains in the Docker copy. Judge, Ollama, scheduler, dedicated worker services and both translation profiles were never started. No external publishing or notifications were invoked.

## Remaining before development cutover or Azure

- Test real Ollama embeddings and document ingestion/retrieval with copied data, then representative generation and video editing workflows under monitored memory limits.
- Resolve memory capacity before enabling larger context or concurrent inference. Keep judge disabled until its model and capacity are established.
- Copy and verify existing media separately before relying on restored records; only disposable media paths were exercised.
- Validate dedicated worker containers, graceful job shutdown, production timeouts and scheduler behavior in a controlled dataset.
- Review existing Composer SMS provider filename warning and OAuth callback URLs.
- Azure is not deployment-ready based on these local tests. Hosting architecture, durable data/checkpoint strategy, managed secrets, TLS, backups/restores, health/readiness behavior, image version pinning, resource sizing, and deployment automation still need design and verification. No Azure deployment was attempted.
