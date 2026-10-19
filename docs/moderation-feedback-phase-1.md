# Phase 1: administrator moderation feedback

## Scope

Verified administrators can flag published comments on `/news/{id}` and approve pending or restore removed comments through a private article review dialog. Existing moderators retain dashboard access but do not receive the new article correction capability. Rejected comments cannot be restored.

Corrections immediately apply existing remove/approve/restore transitions, append moderation history, and resolve outstanding reports exactly as the existing dashboard does. They also append an unverified feedback record. There is no verification endpoint, embedding generation, RAG, training, or change to automatic publication rules in Phase 1.

## Storage and access

- `comments.moderation_revision` detects stale correction dialogs, including status changes that return to the same status.
- `comment_moderation_assessments` stores the original flag, category booleans/scores, initial outcome and model metadata once per new comment. `flagged` / `not_flagged` describes the AI screen, while `initial_status` also reflects local promotion checks. Failures remain `unknown`.
- Existing comments get a `legacy_snapshot` on their first moderation decision/correction. Missing historical model versions, scores and assessment dates remain null; no old data is fabricated or reclassified.
- `comment_moderation_feedback` references the assessment and moderation history, contains the human label/category/explanation, administrator ID, timestamp, request UUID, revision and `unverified` status. It does not copy comment text or author identity.
- Assessment/feedback model updates and deletes are blocked. Application code appends records rather than rewriting them. Direct DBA SQL is outside this application-level protection.
- These records cascade with physical comment deletion, consistent with existing moderation history retention. Future retention/privacy changes must account for this. Account deletion nulls the administrator reference when the comment itself survives.
- Hidden data is fetched only from authenticated, verified, administrator-checked JSON endpoints with `private, no-store`. Public article JSON and Inertia comments remain published-only, including the existing ancestor-visibility filter.
- Feedback POSTs use CSRF-protected web routes, validation, transactions, comment row locks, unique request UUIDs, and expected revisions. Identical retries return the original result; changed payloads using the same UUID return 409. MySQL deadlocks receive bounded transaction retries.

Endpoints:

```text
GET  /admin/news/{news}/moderation-comments?page=1
GET  /admin/news/{news}/moderation-comments/{comment}
POST /admin/news/{news}/moderation-comments/{comment}/feedback
```

## XAMPP setup

1. Start Apache and MySQL in XAMPP. Use the project's existing `.env` MySQL connection and existing administrator account. Back up the database before applying any migration. No live migration was run as part of implementation.
2. From PowerShell:

```powershell
Set-Location C:\Testxampp\htdocs\ApaKhabar-Intelligence-Information-News-Management-System
& C:\Testxampp\php\php.exe artisan migrate:status
& C:\Testxampp\php\php.exe artisan migrate --path=database/migrations/2026_10_19_000002_create_moderation_feedback.php
npm run build
```

The existing engagement migration `2026_10_19_000001_add_news_engagement` must already be applied. If it is pending, review/apply that existing prerequisite before the new migration. Do not use `migrate:fresh`, reset migrations, or delete records.

3. Open the existing XAMPP virtual-host URL for the project, with Apache's document root pointing at the Laravel `public` directory, and visit `/news/{publishedArticleId}`. If no virtual host exists, use this development fallback while keeping XAMPP MySQL running:

```powershell
& C:\Testxampp\php\php.exe artisan serve --host=127.0.0.1 --port=8000
```

Then open `http://127.0.0.1:8000/news/{publishedArticleId}`. If a Vite development server is already active, it may continue serving assets; otherwise the production build is used. No queue worker or new OpenAI API model is required.

## Manual checks

1. Log in as a verified administrator. A small flag should appear beside published comments; ordinary visitors, villagers and moderators must not see it.
2. On a disposable test comment, click the flag. Confirm the original text is shown, a reason is required, and explanation is optional. Cancel first to verify no change. Reopen and confirm. The comment should disappear after an Inertia partial reload and a success message should appear.
3. Open **Tinjau komentar tersembunyi**. The removed comment should appear. Select **Setujui sebagai pantas**, select the reason, and confirm. It should return to the public list. If its parent is hidden, a restored reply remains hidden until the ancestor is published.
4. Test pending approval with an existing pending test comment. To create one predictably using existing behavior, submit a unique comment containing a link (held by the promotion check), then approve it from the private dialog. This tests the same approval path without relying on the live AI to produce a false positive.
5. Open two admin tabs. Load a correction dialog in the first; remove/restore that comment in the second. Submit the first dialog: expect 409 feedback and no overwriting of the newer decision. Close and reopen to refresh.
6. In browser developer tools, resend an already successful feedback POST unchanged: expect the same `feedback_id`, with no extra history or feedback. Resending with changed content and the same UUID must return 409.
7. As a villager, request the private GET endpoints and attempt the POST: expect 403. Guests receive 401 for JSON requests. Verify hidden text is absent from public article responses.
8. Submit a normal user report and a reply before flagging the parent. Flagging resolves the report, retains the reply record, and hides the thread. Restoring the parent makes published descendants visible again. Rejected comments must not appear as restorable items.
9. Inspect the following read-only query in phpMyAdmin:

```sql
SELECT f.id, f.comment_id, a.classification AS original_ai,
       a.requested_model, a.returned_model, a.source,
       f.classification AS administrator_decision, f.category,
       f.explanation, f.administrator_id, f.verification_status,
       h.from_status, h.to_status, f.created_at
FROM comment_moderation_feedback f
JOIN comment_moderation_assessments a ON a.id = f.assessment_id
JOIN comment_moderation_history h ON h.id = f.history_id
ORDER BY f.id DESC;
```

The first removal and later restoration should be separate feedback rows referencing the same original assessment. Both remain unverified. No correction should make an OpenAI request.

## Automated validation

```powershell
& C:\Testxampp\php\php.exe artisan test --compact tests/Feature/News/ModerationFeedbackTest.php tests/Feature/News/EngagementTest.php
node --test tests/js/news-engagement.test.mjs
npm run build
node node_modules/eslint/bin/eslint.js resources/js/components/admin-comment-feedback.tsx resources/js/components/news-engagement.tsx resources/js/pages/newsdetails.tsx resources/js/pages/admin/comments.tsx
```

The PHP suite uses in-memory SQLite, not the configured application MySQL database. Live MySQL locking/concurrency and browser interaction require the manual checks above.

## Later phases

Phase 2 adds reviewed verification/revocation and curated redacted examples. Semantic indexing, contextual classification, evaluation and live RAG routing follow separately. None is active in this phase; accumulated feedback does not retrain OpenAI moderation.
