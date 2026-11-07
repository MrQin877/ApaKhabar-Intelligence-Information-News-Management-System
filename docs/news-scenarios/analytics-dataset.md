# Fictional analytics dataset — 7 November 2026

Installed in local apakhabar_dev using NewsScenarioAnalyticsSeeder. This is synthetic presentation activity, not observed audience behaviour. News titles, content and publication dates were preserved. Existing accounts and Meta statistics were preserved. No external publications, messages, or API requests were made.

Added 80 fictional residents identified by email domain news-scenario.example.test, 314 user/post viewer pairs, 392 simulated views, 92 likes, 28 topic-specific published comments and 2,572 hourly activity records. The summed unique-view count is per article, not 314 distinct people. The comments are scenario records, not actual AI moderation outcomes. No moderator actions were fabricated.

All seven current articles were published today, so their engagement belongs to today. Use Today or Last 30 Days in the dashboard. Registration and hourly activity span prior weeks, but no news engagement predates its article. Existing short videos and broadcasts were not populated by this run.

The reserved .test email domain identifies the dataset without visible DEMO labels. Accounts have random non-shared-login-ready credentials. The seeder runs only in local/testing and refuses duplicate insertion when scenario emails exist. It is not invoked by DatabaseSeeder.

Backup: storage/app/private/backups/before-scenario-analytics-20261107-102537.sql (with SHA-256 sidecar).

Validation: automated test confirms counter consistency, publication dates, no future comments/activity, repeat-run idempotence and no external calls, notifications or queued jobs. Database totals verified after insertion. Dashboard formulas/layout unchanged.
