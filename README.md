# ApaKhabar Intelligence, Information and News Management System

ApaKhabar's Laravel application provides the public news website, an admin/moderator editorial workspace, document and information management, broadcasts, and APIs for the separate mobile application. It integrates with the separate **ApaKhabar AI Service** for extraction, retrieval, conversation, and agentic drafting.

## Technology and boundaries

- Laravel 12 / PHP 8.4.1+ (required by the committed dependency lockfile), Inertia 2, React 19, TypeScript, Tailwind CSS 4, Radix/shadcn-style components, and Vite 7.
- Eloquent application persistence; database connections are configured in `config/database.php` (default MySQL).
- Laravel queue workers for document processing and generation; scheduler for stalled-document recovery and expiry archiving.
- FastAPI AI Service over server-to-server HTTP. Generation, judge, and embedding models run outside this repository.
- Existing publishing integrations for the website, Facebook, and Instagram; external services require their own credentials and setup.

## Included features

| Area | Functions |
| --- | --- |
| Public news | News listing/detail, related-news API, categories, likes, comments and replies |
| AI Assistant | Conversation, source selection, document questions/analysis, explicit draft generation, clarification, progress, session history, category proposals |
| Document library | Upload, extraction, evidence review, approval/rejection, previews, retry, archive/restore, approved-information indexing |
| Editorial workspace | Manual and AI drafts, edit/preview, versions and quality findings, images, explicit multi-channel publication, archive/restore |
| Social integrations | Account connections, channel selection, publishing results and failure handling |
| Broadcasts | Create/list/detail, resend, archive/restore, notification delivery |
| Accounts | Browser and mobile authentication, role checks, email/phone verification, password recovery, profile/security settings |
| Other services | Notifications/read status, mobile push-token registration, website translation |

See [feature and file map](docs/repository-map.md) for implementation locations and principal methods. This inventory describes implemented routes and code, not a guarantee that every optional provider is configured.

## First-time setup

Install PHP with the extensions required by Composer, Composer, a Node.js version compatible with Vite 7, and your configured database server. Use the lockfiles to install dependencies.

```sh
composer install
npm ci
```

Copy `.env.example` to `.env` **only for a new checkout** (`cp` on macOS/Linux or `Copy-Item` in PowerShell). Configure database, application URL, mail, queue, cache, and any required integration settings before migrating.

```sh
php artisan key:generate
php artisan migrate
php artisan storage:link
composer run dev
```

Do not regenerate the application key on an existing deployment. Review seeders before using them; they are not required by the commands above. The browser application normally opens at `http://localhost:8000`.

`composer run dev` starts the PHP server, document worker, generation worker, scheduler, and Vite. It uses `php scripts/serve.php`, so Windows users do not need Bash for this command. It does **not** start the Python service or model servers.

## AI integration

Configure these Laravel settings and use the same service token in the Python service:

```dotenv
APAKHABAR_AI_URL=http://127.0.0.1:8001
APAKHABAR_AI_TIMEOUT=1200
APAKHABAR_AI_SERVICE_TOKEN=replace-with-a-shared-secret
APAKHABAR_AI_WEB_DISCOVERY=false
```

Use an asynchronous queue connection. Start FastAPI and the configured generation, embedding, and optional judge providers from the AI Service repository. The Python workflow has Planner, Researcher, Writer, and Reviewer roles; this Laravel repository owns authorization, approved sources, sessions, drafts, and publication. Neither A2A nor MCP is required by this integration.

Uploading does not automatically authorize news generation. AI results remain drafts. Users review/edit and confirm publishing, selecting Website, Facebook, Instagram, or multiple channels. Publication uses saved edited content. Quality scores are automated assessments, not measured accuracy percentages.

## Documentation

- [System architecture and data flow](docs/system-architecture.md)
- [Repository features, files, and functions](docs/repository-map.md)
- [AI Assistant UI architecture](docs/NEWS_CREATOR_UI_ARCHITECTURE.md)
- [Local development and mobile URLs](docs/local-development.md)
- [Upload limits](docs/upload-limits.md)
- [Meta connections](docs/meta-connections.md) and [integration setup](docs/meta-integrations.md)
- [Instagram publishing](docs/instagram-manual-publishing.md)
- [Website translation](docs/website-translation.md)
- [Mobile email verification](docs/mobile-email-verification.md), [password reset](docs/mobile-password-reset.md)

## Checks

```sh
php artisan test
npm run types:check
npm run lint:check
npm run build
```

`composer test` also clears configuration and runs PHP formatting checks. Focused suites live under `tests/Feature/IntelligentNews`, `News`, `Broadcast`, `Auth`, and `Settings`. Tests using mocked providers validate application behavior; live model quality and real social publishing require separate verification. Never use real publishing as a routine automated smoke test.

## News engagement and moderation

See [news engagement setup, retention, moderation, and testing](docs/news-engagement.md). Run the new migrations before serving the updated UI. Configure server-side `OPENAI_API_KEY`; without it, comments remain pending for admin review.
