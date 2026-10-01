# Repository features and file map

Use this as a navigation guide; route definitions and implementation code remain authoritative. Paths are relative to the repository root.

## Directories

| Directory | Responsibility |
| --- | --- |
| `app/Http/Controllers` | HTTP validation, authorization, responses, feature entry points |
| `app/Http/Middleware` | Role/API authentication and shared Inertia state |
| `app/Services` | Feature coordination and external provider integrations |
| `app/Jobs` | Queued document extraction and news generation |
| `app/Models` | Persistent application records and relationships |
| `resources/js/pages` | Inertia screens for public, admin, authentication, settings |
| `resources/js/components` | Shared UI, publishing dialogs, AI workspace components |
| `resources/views` | Blade responses, including normalized document previews |
| `routes` | Browser, mobile/API, settings, and scheduled/console entry points |
| `database/migrations` | Versioned database schema and data transitions |
| `database/seeders` | Seed data; inspect before running against an existing database |
| `config`, `.env.example` | Configuration definitions and setup template |
| `scripts/serve.php` | Cross-platform local PHP launcher with upload configuration |
| `tests/Feature` | Feature and integration behavior tests |

## Feature entry points

| Feature | Primary files / functions |
| --- | --- |
| AI Assistant page | `Admin/NewsCreatorController.create()`; `resources/js/pages/admin/intelligentnewscreator/chat.tsx` |
| Conversation and intent | `app/Services/AssistantConversationService.php` |
| Async drafting | `NewsCreatorController.generateAsync()`, `agentProgress()`; `app/Jobs/GenerateIntelligentNews.php`; `app/Services/NewsGenerationService.php` |
| Source normalization before generation | `NewsGenerationService.originalDocuments()` |
| Document library | `NewsCreatorController.documents()`, `storeDocument()`, `retryDocument()`, `archiveDocument()`, `restoreDocument()`; `documents.tsx` |
| Extraction and progress | `app/Jobs/ProcessIntelligenceDocument.php`; `NewsCreatorController.documentProgress()` |
| Document preview | `NewsCreatorController.previewDocument()`; `resources/views/documents/preview.blade.php` |
| Information moderation | `NewsCreatorController.reviewInformation()`, `bulkReviewInformation()`, `indexInformation()` |
| Category proposal decision | `app/Http/Controllers/Admin/AssistantCategoryController.php` |
| Draft editing/version snapshots | `NewsCreatorController.updateDraft()`, `storeDraftVersion()`; `app/Models/IntelligentNewsDraft.php` |
| News workspace/manual editor | `Admin/NewsWorkspaceController` (`index`, `create`, `store`, `edit`, `update`); `index.tsx`, `editor.tsx` under the intelligentnewscreator pages |
| Publish/archive/restore | `NewsWorkspaceController.publish()`, `archive()`, `restore()` |
| Social publishing | `app/Services/FacebookPublishingService.php`, `InstagramService.php`, `InstagramImageService.php`, `CloudinaryService.php` |
| Social account connection | `Admin/MetaConnectionController`; `app/Services/News/MetaConnections.php`, `MetaCredentials.php` |
| Public news | `News/NewsController`; `app/Services/News/NewsService.php`; `welcome.tsx`, `newsdetails.tsx` |
| Likes/comments/replies | `News/PostLikeController`, `News/CommentController`; `News/InteractionService` |
| Categories | `Admin/NewsCategoryController`; `resources/js/pages/admin/categories/index.tsx` |
| Broadcasts | `Admin/BroadcastController`; `resources/js/pages/admin/broadcasting`; `SmsService`, `Village/NotificationService` |
| Notifications | `Village/NotificationController`; `resources/js/pages/notifications/index.tsx` |
| Mobile authentication | `Auth/AuthController`, `app/Services/Auth/AuthService.php`, `app/Http/Middleware/ApiAuth.php` |
| Verification/recovery | Controllers under `app/Http/Controllers/Auth`; phone challenge/rate limiting under `app/Services/Settings` |
| Profile/security | Controllers under `app/Http/Controllers/Settings`; `resources/js/pages/settings` |
| Website translation | `WebsiteTranslationController`, `app/Services/WebsiteTranslation.php`, `resources/js/components/website-language.tsx` |

Controller paths in the table are under `app/Http/Controllers` unless explicitly prefixed. Service/model paths are shown where ambiguity matters.

## Main route groups

- `/news`, `/news/{id}`: public news; authenticated engagement routes add likes/comments/replies.
- `/admin/ai-assistant`: assistant, asynchronous generation, progress, draft updates, and category decisions.
- `/admin/documents`, `/admin/information`: library, preview, extraction retry, and moderation.
- `/admin/news`: manual and AI draft workspace and shared publishing.
- `/admin/social`: publishing account connection and selection.
- `/admin/broadcasting`: broadcast management; `/notifications`: notification state.
- `/settings`: profile, security, appearance, and integrations.
- `/api`: mobile/public JSON endpoints defined in `routes/api.php`; protected routes use `ApiAuth`.

Admin browser routes require authentication, verification, and admin/moderator roles; category administration has an additional admin role requirement. Individual handlers also enforce feature-specific access. Do not assume a route is authorized simply because it exists.

## Testing map

`tests/Feature/IntelligentNews` covers assistant behavior, workflow state, document previews and upload limits. `tests/Feature/News` covers manual editing, AI publishing, schema migration, Meta connections, and publishing providers. `Broadcast`, `Auth`, and `Settings` cover their corresponding features. See the root README for check commands; provider mocks do not measure real model accuracy or prove live credentials work.
