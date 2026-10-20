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

## Section dashboard (layout version 2)

The shared analytics layout stores ordered sections (`id`, optional `title`,
`columns`, `order`) and ordered widget references (`id`, `size`, `order`). Widget
references never own analytics records or moderator permissions. Admin editing
uses a draft; Save persists it, Cancel restores server configuration, and Reset
only replaces the draft until saved.

Sections use 1–3 logical columns. Small is 1×1, Medium 1×2, Wide 2×1, and Large
2×2. Each widget has an allowed preset list in `analytics-sections.ts` and
`SectionLayout.php`. A monotonic row-major first-fit scan prevents overlap and
preserves reading order instead of filling earlier holes with later widgets.
Rows have a 280px minimum plus 16px gaps and can grow for wrapping content.
Changing a section to one column converts Wide to Small where supported,
otherwise Medium; Large converts to Medium. Responsive presentation applies the
same rule without saving it: below 1200px, at most two columns; below 900px,
one column with editing disabled. These thresholds use the dashboard container.

Charts use the existing shadcn ChartContainer/ChartTooltip components with
Recharts. Compact cards show a limited labeled breakdown and a separate detail
view exposes the full original report. Cards do not scroll or clip their data;
the expanded dialog may scroll as a separate reading surface.

Legacy grid layouts are converted on read into a `migrated` section preserving
widget identity and saved order. Width/height map to compatible presets. The
original stored layout is unchanged until the first version-2 save, when it is
also retained as a migration backup in `analytics_setting_changes`. Missing
layouts receive default sections. Version-2 layouts preserve intentional widget
removals; unknown IDs and duplicates are discarded on load and rejected on save.
Moderator responses filter both report data and section widget references on the
server, remove empty sections, and reindex the remaining items.

Validation: analytics feature tests cover shared persistence, permissions,
legacy conversion/backups and malformed layouts; JS tests exercise all preset
footprints across column counts, deterministic packing, moves and draft isolation.
Interactive browser testing was discontinued at the user's request; final chart
rendering and drag interactions have not been visually verified.

### Widget visualization mapping

The section dashboard and expanded view share `widget-visualizations.tsx`:
Overview uses four KPI cards; publication categories use horizontal bars and a
separate daily area chart; age uses all eight ordered vertical bars; citizenship
uses a donut plus gender stacks; ethnicity uses wrapped labels and horizontal
bars; activity uses `rows` for its area chart and backend weekday/hour cells for
the heatmap; broadcasts use three KPIs and a recorded-notification read rate;
Meta uses separate platform cards and separate series per metric; engagement
uses the backend empty-state note. Charts reuse shadcn ChartContainer, tooltips,
legends, Card and Progress. Large breakdowns remain available in the expanded
view. Heatmaps explicitly allow horizontal scrolling on narrow containers.

Date-only chart labels are kept as strings to avoid timezone shifts. Heatmap
hours are already bucketed by the server's analytics timezone (shown in its
note). Meta sync timestamps use the browser's local timezone because the page
props do not provide a user timezone preference. No observations are generated
for missing dates. Single observations render as points. Animation is disabled
for chart series, including for users who prefer reduced motion.

### Direct layout editing (current)

All nine widgets now support Compact (1×1), Wide (2×1), Tall (1×2), and
Large (2×2). Rows are exactly 260px with 16px gaps; two-row cards are 536px.
The same maximum applies to every widget. Responsive rendering limits width
without changing the stored desktop layout. Existing sections remain intact.

In edit mode, drag a title to reorder or move between sections. Drag the corner
to preview a snapped size, then release to apply it; arrow keys on the corner
resize without a pointer. A cancelled gesture does not modify the layout.
Adding a widget takes one selection, and removal has Undo. Layout changes
save automatically through a serialized queue after completed gestures, with
visible pending/error states, Retry, and navigation protection for unsaved work.
Moderator visibility and period remain explicit settings, separate from layout
editing; the dashboard follows section order rather than a second order control.

Bounded cards preserve the existing chart families: age donut, citizenship
gender stacks, ethnicity horizontal bars, publication trend chart, activity area
chart/heatmap, and separate Meta time series. Compact cards omit secondary
breakdowns with a Detail action; expanded reports retain full rows and notes.
No prior-period comparisons or other fabricated metrics are introduced.

Bounded chart contents now observe their actual available width and height.
At 560px content width, Meta platforms and publication/activity panels sit
side by side; narrower cards stack them. Each social platform receives an
explicit height budget, with miniature axes-free charts in compact stacks.
Tooltips retain observations; full axes, sync details and all metrics remain
in Detail. Age legends, KPI columns, distribution row counts and plot heights
also adapt to the measured content area. The compact activity heatmap retains
all 24 hourly cells and seven days, showing fewer hour labels rather than
combining or dropping observations.

### Approved information redesign (supersedes Detail-dialog behavior above)

Dashboard cards no longer open a Detail dialog. Definitions live in the header
info tooltip. Compact cards expose key figures directly; taller/wider cards
show larger charts and breakdowns. Unbounded category/ethnicity lists use
in-card paging, so every row remains accessible without exceeding 2×2.

The card palette is analytics-scoped: Emerald, Teal, Amber, Violet and Coral;
Facebook/Instagram retain their official colors. KPI cards show registered
villagers, registrations, active readers and profile completeness. Registration
comparison is the count difference against the preceding equal-length calendar
period in the analytics timezone, excluding staff. No response velocity is
invented. Age includes a centered total, dominant known age bucket, all counts
and percentages. Citizenship includes male/female/unspecified ratios and WNI
share; ethnicity includes completeness and ranked percentages. Publications
use a gradient area chart plus category counts/percentages and lifetime views.
Broadcast steps distinguish broadcasts from recorded/read notifications; they
are not confirmed device delivery or a conversion funnel across equal units.
Activity always shows all 168 heatmap cells and highlights the observed peak
(with tie counts), not a guaranteed optimal send time. Meta cards show the last
seven returned observations per metric; daily deltas appear only when consecutive
calendar-day observations exist and the previous value is positive. Missing or
failed observations remain unavailable. Engagement stays explicitly unavailable.

Verification includes all four sizes at desktop, 390px and 320px widths, inline
paging, definition tooltips and unavailable-data states using a temporary local
component harness. It does not contact live Meta APIs or modify account data.
