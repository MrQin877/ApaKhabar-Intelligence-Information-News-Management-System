# Phase 2C runtime verification — 26 October 2026

## Outcome

Partial pass. Local website, manual news, Shorts processing, actual embeddings, persistent semantic retrieval and isolated queue execution passed. Full AI news generation and browser notification verification remain blocked/unverified. Do not switch development or deploy to Azure on the strength of these results.

All six test services were stopped with exit code 0 at completion; volumes retained. Judge, production scheduler and translation remained stopped. One disposable timeout-worker container intentionally exited 1 and was automatically removed.

## Isolation

Used `compose.yaml` plus `compose.testing.yaml` throughout. Backend network is internal, selected integration credentials are masked, mail uses the log driver, and workers use the separate `phase2b_jobs` table. Only Nginx publishes `127.0.0.1:8088`. No XAMPP database access, migrations, seeders, external publication, notifications, model downloads or Azure actions were performed in this phase. The Ollama server image was pulled; existing model files were mounted read-only.

The testing override now caps Ollama at 2 GiB / 4 CPUs, one loaded model and one parallel request, with a 30-second keep-alive. Ollama was stopped before starting the writer. Application logic was not changed.

## Results

| Workflow | Observed result |
| --- | --- |
| Laravel / Nginx / MariaDB / FastAPI | Healthy during testing; website reachable on port 8088 |
| Media snapshot | 76 storage files, 20,930,105 bytes copied into Docker storage after SHA256/conflict checks; all hashes reverified after tests |
| Existing media URLs | All 47 copied public JPG/JPEG/PNG/WebP/MP4 URLs returned HTTP 200 to HEAD requests |
| Manual News Posting | Authenticated HTTP draft create, edit and website-only publish each returned 200; resulting news active, draft published, social IDs empty |
| Public news page | Disposable news page returned 200 with the expected title |
| Real Shorts processing | `ProcessShortVideo` consumed on `default`: crop/trim of disposable four-second 640x480 source produced 540x960, two-second output, thumbnail and processing status `ready`; job completed in about 775 ms |
| Video seeking | HTTP 206 and exactly 1,024 bytes for a requested range; thumbnail returned 200 |
| Draft completion toast | Not visually verified. Source has draft polling and success/error toast handling in `short-publication-panel.tsx`; this is not runtime UI proof. Browser inventory had no connected browser session and the available ApaKhabar native window was minimized; UI observation failed. |
| Actual embeddings | FastAPI information-index endpoint generated embeddings using cached `qwen3-embedding:0.6b` through Ollama; HTTP 200, one item indexed in 12.37 seconds |
| Semantic retrieval / persistence | Search retrieved the intended isolated information ID before and after FastAPI restart using persistent embedded Chroma; both HTTP 200. Test vector then deleted via API. |
| Laravel → FastAPI generation | Laravel's configured service URL/token reached `/news/generate`; provider returned 503 in 0.35 seconds while llama.cpp was loading. Subsequent FastAPI health returned 200. No article generated. |
| Full LangGraph → writer workflow | NOT PASSED. Writer subsequently loaded, but memory reached 3.80 GiB under its 4 GiB cap. Inference was stopped rather than retrying a resource-heavy workflow. No successful complete graph or resumed generation is claimed. |
| Long AI timeout / recovery | Provider-unavailable response and FastAPI health recovery observed. Long-running inference, client timeout and checkpoint resume remain unverified. |
| Judge | Disabled and untested |
| Queue assignments | Disposable success probes completed on `default`, `documents`, `generation`, `video-publishing` using the corresponding one-off worker service images sequentially |
| Worker timeout | Disposable generation job with one-second timeout intentionally exceeded it; worker exited 1, one failure recorded, queue drained to zero. This exercises timeout mechanics, not a 1,250-second workload. |
| Scheduler | Six existing definitions listed. A separate Schedule object executed one disposable callback successfully; registered production events and scheduler daemon were never run. |

The queue probes do not establish real document ingestion, full queued generation or social publication readiness. Knowledge indexing tested the real embeddings/retrieval service, not PDF/OCR ingestion. UI upload/edit gestures were not exercised; Shorts processing used the actual model/service/job with disposable input.

## Resource observations

Docker allocation: 7.61 GiB, 12 CPUs; CPU inference.

- Writer cgroup peak: **4,078,702,592 bytes (3.80 GiB)** during startup, with current usage approximately 3.79 GiB. Limit 4 GiB; only about 206 MiB remained at peak. Zero OOM/cap events, zero automatic restarts, zero CPU throttling. CPU counter approximately 38.06 seconds, including about 34.19 seconds system CPU. Stopped before sustained inference.
- Ollama sampled after embedding generation: **1.265 GiB / 2 GiB**. This is a working-set sample, not an exact peak.
- FastAPI sampled 165 MiB after indexing, 134 MiB near shutdown; PHP 188 MiB, DB 130 MiB, Nginx 15 MiB near shutdown. Idle CPU approximately 0–0.15%; embedding/inference instantaneous CPU peaks were not captured.
- AI restart was deliberate for persistence testing; automatic restart counters remained zero. Writer and Ollama were never loaded simultaneously.

The present 4 GiB writer cap has insufficient demonstrated headroom for realistic generation. The current 7.61 GiB Docker allocation is not validated for concurrent writer, embeddings, workers and database. Increase capacity only after checking host available RAM, or select a smaller writer/remote inference; then measure sustained peak usage. No safe exact allocation has been established. The base 8192-token context is untested; the testing override used 1024. Increasing Docker RAM alone will not increase the explicit writer cap.

## Integrity and cleanup

- Final verification: **81 foreign-key checks, zero orphans**. Restored `jobs` count remained zero; isolated queue drained to zero.
- All 76 source and destination storage hashes matched. The snapshot includes non-media storage files; 47 were public media URLs. No existing Docker file with different contents was overwritten.
- Disposable news/draft, video record/files, account, queue markers, intentional failure and vector were removed. Copied original media and persistent volumes remain.
- The failed isolated agent run/checkpoint may remain in the Docker-only checkpoint database as diagnostic evidence (`phase2c-generation`, owner `phase2c-test`); existing checkpoints were not altered or bulk-cleared.
- Compose configuration validation passed. XAMPP, original storage/models and previous LibreTranslate project were preserved.

## Remaining before cutover

1. Resolve writer memory headroom, then wait for writer readiness before submitting the full generation test. The early 503 came from staged `--no-deps` startup; base Compose already declares healthy inference dependencies.
2. Verify complete LangGraph generation, actual queued document ingestion, long-request timeouts, failed-run resume and model output/schema compatibility with a realistic prompt/context budget.
3. Verify draft completion toast in an authenticated browser, including processing failure and retry, without social publication.
4. Load-test workers with realistic disposable jobs, graceful shutdown and the configured timeout/retry budgets. Current worker timeouts are 1250/1250/90 seconds; queue retry-after is 1500 seconds, shutdown grace 1400 seconds.
5. Before enabling the real scheduler, review each event against copied data and ensure only one environment owns scheduled work. Never consume restored jobs as part of testing.

## Future Azure suitability

Service separation, internal service discovery and separate persistent data provide a useful starting point. This is not an Azure-ready deployment: inference sizing, durable database/media/vector/checkpoint placement, secrets, TLS, backups/restores, image pinning, readiness, deployment automation and single-owner scheduling still need design and verification. No cloud deployment or permanent local cutover occurred.
