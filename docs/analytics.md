# Villager analytics

The Laravel application owns this feature; the Python AI service is unchanged.

## Registration and profile contract

Both `POST /register` and `POST /api/register` require `date_of_birth` (`YYYY-MM-DD`, no future date, at most 120 years ago) and `citizenship` (`wni`, `wna`, `dual`). Optional `gender` values are `male`, `female`, `undisclosed`; `ethnicity` is optional text up to 100 characters. Empty optional fields become null through Laravel middleware. These fields never select the account role.

Existing accounts remain usable with missing fields. The public website prompts them to complete their profile at `/settings/profile`. Browser and mobile profile updates accept the same fields; when supplied, birthday/citizenship cannot be cleared. Mobile profile responses include `profile_completion_required`. Generic User serialization hides demographics; only owner profile/auth responses explicitly include them.

The separate mobile frontend is not in these workspaces. Its registration form must send the two required fields before this backend contract is deployed to its users, and its profile form should offer the optional fields.

## Access and dashboard sharing

`GET /admin/analytics` and `?export=csv` are admin-only, enforced in the controller. `PUT /admin/analytics/dashboard` accepts an ordered distinct allowlist of widget IDs and `period_days` of 7, 30 or 90. The persisted configuration is shared by all moderators. It is not a per-user preference. Changes are audited in `analytics_setting_changes`.

The dashboard constructs only authorized widgets. Moderators cannot fetch hidden reports using URL or query changes; their dashboard ignores report filters and uses the administrator's period. Revocation takes effect on the next request, with no analytics response cache. Information already viewed cannot be recalled. Old broadcast list/detail analytics are admin-only; moderators receive approved broadcast summaries on the dashboard instead.

Engagement is intentionally a placeholder. Integrate the groupmate's implementation under the `engagement` widget, using the same server-side allowlist and agreed metric definitions.

## Metric definitions

- Demographics describe **current registered villager accounts**, not a population census or historical profile snapshot. Officers/moderators are excluded. Missing answers remain in totals. Citizenship percentages use all registered villagers as denominator. Gender counts include a separate unspecified column.
- Age is completed years on the current date in `ANALYTICS_TIMEZONE` (default `Asia/Jakarta`). No age value is stored.
- News category reports select news records by creation time, retaining archived news. News records are materialized during publishing in this application. Broadcast reports use `sent_at`, retaining archived broadcasts. Re-sending changes that timestamp in the existing system; it is not an immutable send-attempt history.
- News view counters are lifetime fetch counts, not unique readers or views earned in the selected period. They are labelled accordingly. No duplicate engagement/view event pipeline has been added.
- Active villagers perform `feed_open` or `post_open`. Website events are sent only for a signed-in villager on a foreground news/feed page. Stored rows are unique per villager/platform/UTC hour, and combined reports deduplicate across platforms. The heatmap counts distinct villagers per weekday/hour across the selected period, not total sessions. Daily rows count distinct villagers each calendar day.
- The mobile client should call authenticated `POST /api/activity` with `{ "event": "feed_open" }` or `{ "event": "post_open" }` on foreground screen opens. Do not send background polling events. User ID, timestamp and platform come from the server, never the body. Mobile tracking is not automatic until the external mobile frontend adds this call.
- Activity begins with deployment; previous activity cannot be inferred. Activity rows are retained for 365 days and removed when the user is deleted. The scheduled pruning job must run.
- Broadcast summary counts stored notification records for broadcasts sent in the period and their current read status, not confirmed device delivery.

## Meta insights

Select official connections in Analytics. Each admin may select their own connected accounts, at most one per platform; selected accounts feed the global report. Use the Insights authorization links to request `read_insights` (Facebook) / `instagram_manage_insights` (Instagram Facebook Login flow), without changing the publishing-only permissions required elsewhere. When using Meta Business Login configuration IDs, add these permissions in the Meta application configuration. Provider approval and professional-account requirements still apply.

`PUT /admin/analytics/meta` saves selected connection IDs. `POST /admin/analytics/meta/sync` queues a unique `SyncMetaInsights` job; the scheduler also queues it hourly. Run the default queue worker and Laravel scheduler. Tokens stay encrypted in the existing social connection store; raw provider exceptions are not logged or returned.

The initial connector fetches one daily metric per platform: Facebook `page_views_total` (Page visits) and Instagram `reach` (daily reach). Metric availability must be verified with the actual connected account and configured Graph API version; an unsupported metric produces Unavailable, never fabricated zero. `analytics.facebook_metric` can be configured only with a corresponding UI label update. Meta's SDK documents the time-series / daily Insights response shape: https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/instagraminsightsresult.py

Each sync refreshes the latest seven days to collect provider corrections. Snapshots retain provider period-end timestamps in UTC; the displayed date is the UTC date just before that endpoint. Local activity timezone does not shift Meta provider buckets. Only returned observations are shown, so missing dates are not zeros. Daily reach is never summed into monthly unique reach or combined with local villagers. Previous snapshots remain visible with an explicit failed-sync status after a provider error. Switching an account cannot mix the former account's snapshots into the new report.

This is a daily account-insights foundation, not all metrics from Meta Business Suite or per-post social insights. Live authorization and API availability require validation with real connected accounts. Tests use fake provider responses and make no real Meta requests.

## Setup and verification

Apply the two `2026_10_19` migrations, rebuild frontend assets, and restart long-running queue workers. Set `ANALYTICS_TIMEZONE` for the actual village (Jakarta, Makassar, or Jayapura as appropriate). Do not run seeders or replace existing villagers' missing demographics with fake values.

Focused tests: `php artisan test tests/Feature/AnalyticsTest.php tests/Feature/Auth/RegistrationTest.php tests/Feature/Settings`.
Frontend: `npm run build`.
