# Instagram manual publishing

The existing manual editor backend uses `NewsWorkspaceController::store/update/publish`
and `App\Services\InstagramService`. No frontend changes or Facebook publishing are included.

## Configuration

Set these server-only values in `.env`, then run `php artisan config:clear`:

```dotenv
INSTAGRAM_USER_ID=your_instagram_professional_account_id
INSTAGRAM_ACCESS_TOKEN=your_instagram_user_access_token
```

This integration uses Instagram API **with Instagram Login** at
`https://graph.instagram.com/{version}` (existing `META_GRAPH_VERSION`, default `v25.0`).
Use an Instagram professional-account token with `instagram_business_basic` and
`instagram_business_content_publish` permissions, not a Facebook Page token.
Configured credentials represent the shared ApaKhabar account. The existing authenticated,
verified admin/moderator routes and draft ownership checks still apply.

Uploaded covers require a publicly reachable `APP_URL` or public cloud media disk.
The current LAN development address is not reachable by Instagram. Supply a public
JPEG URL accessible without login; a LAN IP, localhost, local path, or private storage
URL will not work. Remote image fetching/format validation is performed by Meta;
API rejection is returned as a friendly error. No server-side download of arbitrary
image URLs is performed.

## Test one post

1. Fill the credentials above and clear config. Use a test Business account initially.
2. As an authenticated admin, submit the existing `POST /admin/news/manual` endpoint
   with CSRF protection and the normal editor payload:

```json
{
  "headline": "ApaKhabar Instagram test",
  "summary": "A test update from ApaKhabar.",
  "content": "<p>This is a manual news publishing test for Instagram.</p>",
  "content_format": "html",
  "image": "https://your-public-domain.example/news.jpg",
  "intent": "publish",
  "platforms": ["instagram"]
}
```

The existing modal also sees Instagram as connected when server credentials are configured.
For saved manual drafts, use `PUT /admin/news/manual/{draft}` with the same payload.
The existing reviewed-draft endpoint is `POST /admin/news/drafts/{draft}/publish`.
Caption is the headline, a blank line, and summary, converted to plain text (maximum 2200 characters).

3. Expect the existing success redirect to `/admin/news` and check the Instagram account.
   Instagram-only marks the draft published without creating a website news item.
   Select `["website", "instagram"]` to publish both. Website-only behaves as before.
4. Each selected platform is attempted independently. JSON clients receive
   `{success, results: {application: {success, message}, instagram: {success, message}}}`.
   Inertia receives the same result through the `publishResult` flash prop and displays
   a success, partial-success, or failure dialog. Invalid article input still returns
   normal field validation errors and an Inertia failure result.
5. Partial failures keep the saved draft available for retry. `published_news_id` and
   `instagram_media_id` remember completed platforms so retrying that same draft skips
   them. Successfully published content is not rolled back when the other platform fails.
   Retry the saved draft, not a new article submission. Edits after partial success do
   not update the already-published platform.

Logs are in `storage/logs/laravel.log`. Filter `manual_publish.` and group by `attempt_id`.
Stages include `request_received`, `selected_platforms`, `validation_passed` or
`validation_failed`, `application.started/success/failure`, `instagram.started`,
`instagram.image_url`, `instagram.media.started/success/failure`,
`instagram.media_publish.started/success/failure`, `instagram.success/failure`, and
`final_result`. HTTP status, sanitized Meta response bodies, exception messages, and
draft/news IDs are logged. Credential fields, known configured secrets, bearer tokens,
and URL query strings are redacted. Technical details are never sent to the result dialog.

Requests are bounded and are not automatically retried. A timeout at `media_publish`
can mean Meta published the post without returning a response: check Instagram before
retrying. Instagram cannot participate in the database transaction, so a database failure
after remote success likewise requires checking the account before retrying.

## Automated checks

```shell
php artisan test tests/Feature/News/InstagramPublishingTest.php tests/Feature/News/ManualEditorTest.php
```

These tests fake HTTP calls and do not publish real posts.

Reference: [Meta Instagram API collection](https://www.postman.com/meta/instagram/collection/6yqw8pt/instagram-api).
