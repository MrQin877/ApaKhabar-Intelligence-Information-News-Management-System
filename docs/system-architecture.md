# System architecture

Reviewed against repository code on 1 October 2026.

## Application layers

The browser renders React pages through Inertia. `routes/web.php` maps authenticated admin/moderator pages, public news, engagement, and editorial actions to Laravel controllers. `routes/settings.php` supplies account settings routes. `routes/api.php` supplies JSON endpoints for the separate mobile client, using `ApiAuth` on protected routes. Browser sessions/CSRF and mobile API authentication are different entry points; neither exposes the AI service token to clients.

Controllers validate requests and enforce access. Services coordinate AI requests, publishing, account actions, notifications, and provider integrations. Eloquent models persist records; filesystem disks hold source documents and images. `config/database.php`, `filesystems.php`, `queue.php`, and `services.php` define deployment-specific connections.

## AI and document processing

1. `NewsCreatorController.storeDocument()` validates uploads, stores originals, and creates document/extraction records.
2. `ProcessIntelligenceDocument` on the `documents` queue posts files to Python `/documents/batch-extract` with an opaque progress ID. It stores extracted information, evidence, and heuristic quality dimensions, then updates waiting sessions.
3. Moderator review controls information eligibility. Approved active information can be indexed in Python's separate approved-knowledge collection. Archived or rejected information must not become drafting evidence.
4. `AssistantConversationService` calls `/assistant/respond` for conversation/intent handling. Storage, extraction, questions, and analysis are distinct from requesting a draft.
5. `generateAsync()` dispatches `GenerateIntelligentNews` on the `generation` queue. `NewsGenerationService` constructs the evidence/request payload, reloads original documents through `/documents/upload`, calls the Python editorial workflow, and persists resulting runs, events, quality findings, drafts, and versions.
6. Authenticated progress routes combine queue state and Python progress. The UI displays stages and results, not private model reasoning.

Original-file payload delivery is not itself proof of verification: correctness also depends on the Python service consuming and checking that evidence. Missing evidence must not be presented as a verification pass.

Python owns one LangGraph workflow with Planner, ReAct-style Researcher, Writer, and Reflection Reviewer roles. A generation model serves the first three, an optional separate judge serves Reflection, and an embedding model supports retrieval. Tools are dispatched directly in Python; the integration uses HTTP, not A2A or MCP. Agent skills and model settings belong in the AI Service repository.

## Data ownership

| Records | Purpose |
| --- | --- |
| `IntelligenceDocument`, `IntelligenceExtractionRequest` | Original file lifecycle and extraction requests |
| `IntelligenceInformation` | Extracted facts, evidence, moderation, and index state |
| `IntelligentNewsSession`, `IntelligentNewsMessage`, `IntelligentNewsSourceSelection` | Conversation and selected-source context |
| `IntelligentNewsRun`, `IntelligentNewsRunEvent` | Execution metadata and visible progress |
| `IntelligentNewsDraft`, `IntelligentNewsDraftVersion`, `AiQualityEvaluation` | Editable draft, version history, evaluation |
| `News`, `NewsCategory` | Published news and category records |
| `SocialConnection` | Connected publishing accounts |
| `Broadcast`, `Notification` | Broadcast records and notifications |

Draft content uses `title`, `content`, and `excerpt`. Migration `2026_09_29_180000_unify_draft_article_columns.php` merges old text into content and removes separate legacy columns. `IntelligentNewsDraft` retains compatibility mapping/accessors for structured AI responses. Python still returns headline/lead/body/summary fields; this is an API boundary, not the database schema. Historical version JSON remains intact.

## Review and publishing

`NewsWorkspaceController.publish()` is shared by manual and AI drafts. AI publishing can confirm review in the publish dialog with the current version; a stale version or blocking quality result is rejected. Editing clears the prior review. Publishing reads the saved draft content and reuses the existing website/Facebook/Instagram integrations.

Channels return individual outcomes. Stored external publication identifiers support retry handling, and failures must not discard the reviewed draft. An API timeout is not proof a remote post failed; inspect per-channel results before retrying. Automatic AI generation does not publish or create approved categories. `AssistantCategoryController.decide()` handles explicit category decisions.

## Background execution and operations

`composer run dev` runs the server, Vite, scheduler, and these workers:

```sh
php artisan queue:work --queue=documents,default --tries=5 --timeout=1250
php artisan queue:work --queue=generation --tries=1 --timeout=1250
```

Document HTTP requests are capped at 1200 seconds; job timeout is 1250 seconds and default queue retry-after is 1500 seconds. Keep retry-after greater than job timeout. Restart long-lived workers after code/config changes. Use a process manager and a shared cache/queue design for multi-host deployments instead of relying on a development terminal.

`routes/console.php` schedules stalled-document recovery every minute for processing records older than 25 minutes and expiry archiving daily. `php artisan ai:reindex-approved` rebuilds eligible information vectors after embedding changes; `--owner=ID` scopes it. These functions require their providers to be available.

Idle time does not intentionally stop AI processing. Laptop sleep pauses local services and can break pending connections. A `RUNNING` log is only job start; verify document/run status before re-dispatching. Laravel, FastAPI, and each model server must be checked separately.

## Other feature paths

Public news and engagement use `NewsController`, `CommentController`, `PostLikeController`, and services under `app/Services/News`. Broadcasting uses `BroadcastController`, `SmsService`, and `Village/NotificationService`. Auth and settings have browser/mobile-specific verification and password recovery controllers. Website translation is handled by `WebsiteTranslationController` and `WebsiteTranslation`; social credentials and account selection use `MetaConnectionController` and `News/MetaConnections`.
