# Video Pendek: setup and verification

## Local setup

New Shorts keep their original, edited video, and selected cover on Laravel's public disk under `shorts/`; run `php artisan storage:link` and set `APP_URL` to the public site origin. `Terapkan` exports locally, and `Simpan Draf` persists local media and edit settings. Website-only publication keeps that local URL. Instagram/Facebook publication uploads the final local edit to Cloudinary once before queuing Meta jobs; failures leave the draft and local files intact. Existing valid Cloudinary Shorts and cached social assets are reused. Superseded local edits, abandoned export files, and deleted draft media are cleaned up.

1. Start the existing MySQL server. Back up the database, then run `php artisan migrate`. The new migration adds `short_videos` and `short_video_publications`; it does not rewrite news/image data.
2. Install FFmpeg locally (includes ffprobe). Set `FFPROBE_BINARY` to its full executable path in `.env`, or put it on PATH. Restart PHP after changes. Upload validation fails closed if ffprobe is unavailable.
3. Keep Cloudinary credentials configured for Instagram/Facebook publication and older Cloudinary-backed Shorts. New upload, edit, and website-only playback use public local storage.
4. PHP/web server must accept 100 MiB uploads: `upload_max_filesize=100M`, `post_max_size=110M`, enough temporary disk space, and an upload/request timeout long enough for Cloudinary (up to 180 seconds). The local serve script loads `config/php/uploads.ini`; XAMPP Apache must use equivalent settings in its own php.ini. Existing Laravel image/OCR endpoint limits remain unchanged.
5. Keep `QUEUE_CONNECTION=database`. Run `php artisan queue:work --queue=video-publishing --tries=1 --timeout=90` and `php artisan schedule:work` (production: scheduler every minute). `composer dev` includes both. Other worker commands, including `dev:ssr`, need this additional dedicated worker separately.
6. Connect each user's Instagram professional account / Facebook Page in Settings > Social Media Integration. Existing Meta app permissions, approved app mode, Page access and token validity still apply. This feature adds no OAuth scopes. Facebook Page video publishing uses the existing Page publishing permissions; verify permission approval and Reel eligibility against the configured Graph API version.

## Optional Docker worker

`docker compose -f compose.shorts.yaml up --build -d`

The image includes PHP extensions and ffprobe. It runs only the dedicated queue worker, not the web server or MySQL. Set `SHORTS_DB_HOST` if the database is not on the host machine; grant the database user access from the container. Use the SAME APP_KEY and database as the web application so saved credentials decrypt correctly. The scheduler must still run in the web environment. Local MySQL bound only to loopback may need configuration before a container can connect. Restart workers after deployments.

## Supported upload profile

The app deliberately accepts a conservative subset, with automatic orientation/Fit normalization when needed: MP4/H.264/yuv420p, <=100 MiB, <=15 minutes, AAC audio <=48 kHz/stereo when present, with rotation metadata accepted as source input. Final exports have baked-in orientation. Social destinations also require 23?60 FPS, progressive video, width <=1920, bitrate <=25 Mbps, >=3 seconds. Facebook currently uses a conservative 9:16, >=540x960, 4?60-second profile. Wider provider format support is not implied. Actual Meta processing may reject additional content/account-specific constraints.

### Explicit Edit & Crop Video

The draft's Edit menu opens a single 9:16 editing canvas (no separate preview panel). Drag or use arrow keys to pan, adjust zoom, play/pause, seek, mute, and adjust start/end times. Batal discards the selection. Terapkan saves the source and FFmpeg output locally; an untouched exact 9:16 source is a no-op.

Uploads default to Sesuaikan (Fit): the complete oriented image is contained in 9:16 with a blurred background. Pangkas (Crop) opens the existing draggable/zoomable editor; Batal discards pending changes and Terapkan confirms them. Source validation accepts rotation for normalization, while final export and publication validation still reject residual transforms. Already upright square-pixel 9:16 videos are reused. An initial confirmed edit is exported once during upload, without an intermediate Fit export.

The server reads the preserved local original (or downloads a legacy Cloudinary original), probes it again, applies FFmpeg autorotation once before geometry, normalizes pixel aspect ratio, fits or crops without stretching, and exports H.264/AAC MP4 at 1080×1920 with square pixels. FFprobe checks the output before saving it locally. Output and platform limits remain in force.

The original URL/path/metadata remain in `metadata.crop_source`, and crop settings in `metadata.video_crop`. Reopening the editor uses that original to avoid repeated lossy crops. Custom covers are retained; video-frame covers are regenerated at the adjusted frame offset. Export failure leaves the saved video untouched. Only owned drafts may be edited; stale and concurrent crop requests are rejected.

Install FFmpeg in the **web server environment**, not just the queue worker. `FFMPEG_BINARY` is optional; by default the app uses `ffmpeg` beside the configured `FFPROBE_BINARY`. Allow sufficient PHP/proxy request time for export (up to 300 seconds) and social Cloudinary upload. Export is synchronous and the dialog shows a busy state; there is no new queue or migration.

New frame and custom JPG/PNG covers are stored locally. Legacy Cloudinary covers remain valid. ApaKhabar and Instagram use the selected cover; the implemented Facebook Reel workflow uses an automatic Facebook cover.

The upload editor uses a responsive two-column layout: portrait playback and media information on the left, title/description and inline cover tabs on the right. `Dari Video` selects a frame from the filmstrip/slider; `Unggah Foto` selects a JPG/PNG. Switching tabs preserves both selections within the editor, and only the active source is sent on Save Draft or Publish. Saving persists the active thumbnail and frame offset through the existing cover API. Reopening a draft restores the tab corresponding to its saved thumbnail. The Edit Video menu contains Fit/Crop and video replacement. Gallery covers default to Fit, correct JPEG EXIF orientation, and save as 1080x1920 JPEGs. The top-right Pangkas Sampul button opens a 9:16 Fit/Crop dialog with drag, zoom, Batal and Terapkan. Originals and settings persist in `metadata.cover_original` and `metadata.cover_crop`; unchanged settings reuse the existing thumbnail. Instagram uploads the final local cover once and caches it in `metadata.social_cover`, without changing the website thumbnail. Facebook retains its automatic cover selection.

## Publication safety

- Social video upload completes before website and social publication records are committed. Selected platforms have one unique publication row each.
- Account ID, connection ID, graph host/version, and encrypted token snapshot are saved at publication time. Switching accounts later cannot redirect a job. Retry can refresh credentials only for the SAME account.
- A database lease prevents concurrent jobs. Every remote write persists intent first. Unknown outcomes are reconciled with read-only status requests, not blindly replayed.
- Unknown container creation responses cannot safely be retried automatically because no remote ID was recovered. An Instagram publish timeout can confirm a published container without recovering its media ID; it remains marked uncertain and requires operator investigation. Do not create a duplicate draft to bypass this protection.
- Recovery scheduler resumes stalled queued/processing rows and pending permalink lookups. Definite provider rejections are retryable. Maximum automatic polling is 120 attempts at 30-second intervals.
- Archive removes the video from the homepage and stops unstarted jobs. Draft deletion removes its local media; published local media and legacy Cloudinary assets are retained.
- Access is Admin/Moderator, with ownership checks for all video operations. Management lists show the current user's videos.

## Manual acceptance checks

1. Upload a real supported MP4 as Admin and Moderator: verify immediate local player, progress, server validation, local asset and automatic cover. Try invalid MIME, codec and oversized video.
2. Choose a frame, save/reopen the draft, then try a custom cover. Confirm title, description and thumbnail persist.
3. Publish website-only: mandatory ApaKhabar checkbox stays selected; newest video appears among the six homepage cards. Video URL is prepared for future playback; cards intentionally do not add a new playback page.
4. Test Instagram-only optional destination, Facebook-only optional destination, then both. Check saved account names, async status changes, provider IDs/permalinks and real remote posts. Confirm selected IG cover and Facebook automatic cover.
5. Change selected Meta account after queueing; the queued post must stay pinned. Test failed/expired credentials and retry. Never use a production account for artificial uncertain-outcome experiments.
6. Stop/restart worker, confirm recovery, reopen status dialog, archive a video, and delete a draft. Check mobile layout and shared Tulis Manual publishing dialogs.

## API references used

- https://github.com/fbsamples/reels_publishing_apis/tree/main/insta_reels_publishing_api_sample
- https://github.com/fbsamples/reels_publishing_apis/tree/main/fb_reels_publishing_api_sample
- https://developers.facebook.com/docs/instagram-platform/content-publishing/
- https://developers.facebook.com/docs/video-api/guides/reels-publishing/

Live provider publishing, browser upload/thumbnail interaction and Docker image execution require environment acceptance testing; mocked HTTP tests do not establish provider acceptance.


## Verification results (21 October 2026)

- Focused PHP suite: **94 passed, 0 failed, 504 assertions** (ShortVideoTest, HomepageTest, FacebookPublishingTest, InstagramPublishingTest). Includes corrected multipart request assertions and four account/retry safety cases.
- Broader News suite: **344 passed, 7 failed, 3264 assertions** before those four additional safety cases. These counts overlap the focused run and must not be added together.
- Remaining failures: one ManualEditorTest category fallback with no eligible category; two MetaConnectionTest disconnect cases missing the now-required category in their manual-news payload; four NewsRetryTest cases missing the required category. Those controllers/tests were not changed by Shorts implementation. No validation was weakened to make them pass.
- Frontend selected checks: **5 passed, 0 failed** (homepage category filter, six Shorts covers/titles, three shared-result-dialog state checks).
- TypeScript, targeted ESLint, production Vite build, 15 relevant PHP syntax checks, route registration (9 routes), scheduler registration and Docker Compose syntax passed. Docker image build/runtime and browser acceptance were not verified.
- New tables migrate successfully in the SQLite test environment. Actual MySQL migration remains pending; no local database/credentials were changed.

## Database diagnosis

The application targets loopback TCP port 3306. No MySQL process/listener was found; the MySQL94 Windows service is stopped. The connection fails before authentication, so this is not evidence of an incorrect password. The existing database directory was found under `C:/xampp/mysql/data/apakahbar`, not the other `C:/Testxampp/mysql/data` installation. CLI PHP also comes from `C:/xampp/php/php.exe`. The former MySQL error log shows a successful startup on October 20, with no current startup attempt to diagnose. Start MySQL from **C:/xampp/xampp-control.exe**, then recheck. Do not start both installations on the same port. Database existence and grants still require a live connection to confirm.

## Exact Windows FFprobe setup

Upload inspection invokes **ffprobe**. Uploads requiring orientation/Fit normalization and explicit changed crop saves also invoke **ffmpeg**. The FFmpeg Windows distribution includes both. Use the Windows builds linked by https://ffmpeg.org/download.html (Gyan or BtbN), download an appropriate 64-bit archive, and extract so `C:/Tools/ffmpeg/bin/ffprobe.exe` and `ffmpeg.exe` exist. No paid service is required for local processing.

Add `C:\Tools\ffmpeg\bin` through Windows **Edit environment variables for your account > Path > New**, then reopen PowerShell/IDE. For Apache running as a service, use System Path (administrator) or configure FFPROBE_BINARY as an absolute path; restart Apache. Do not replace the entire existing PATH.

```powershell
Test-Path C:\Tools\ffmpeg\bin\ffprobe.exe
& C:\Tools\ffmpeg\bin\ffprobe.exe -version
Get-Command ffprobe, ffmpeg
where.exe ffprobe
ffprobe -version
ffmpeg -version
```

Set FFPROBE_BINARY to the absolute executable path if PATH is not inherited by PHP. Docker's image installs the FFmpeg package (including ffprobe); a host Windows executable path is not usable inside Linux containers. Current background jobs do not invoke ffprobe; validation runs in the web process, so installing it only in the worker does NOT fix local web uploads.

## Environment setting names (no secret values)

- Application/database: APP_KEY, APP_URL, DB_CONNECTION, DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD.
- Runtime: QUEUE_CONNECTION, CACHE_STORE, FFPROBE_BINARY. DB_QUEUE_RETRY_AFTER is optional; retain an interval longer than the worker timeout and lease.
- Cloudinary: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
- Existing Meta connections: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_REDIRECT_URI, FACEBOOK_LOGIN_CONFIG_ID, INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID, META_GRAPH_VERSION, FACEBOOK_GRAPH_VERSION.
- Optional Docker host override: SHORTS_DB_HOST.

Social account IDs/tokens for this feature come from the authenticated user's SocialConnection record, not the legacy environment-only FACEBOOK_PAGE_ACCESS_TOKEN or INSTAGRAM_ACCESS_TOKEN fallback.

## Commands after starting the correct MySQL instance

```powershell
Set-Location C:\Testxampp\htdocs\ApaKhabar-Intelligence-Information-News-Management-System
Test-NetConnection 127.0.0.1 -Port 3306
php artisan config:clear
php artisan migrate:status
php artisan migrate --path=database/migrations/2026_10_21_000001_create_short_videos.php
php artisan route:list --path=admin/short-videos
composer dev
```

Use the targeted migration only after existing migrations are already applied. It creates two new tables with indexes/foreign keys, without ALTER/UPDATE/DELETE on existing tables. Its rollback drops only those new tables and would remove their Shorts data, so do not roll it back after use without a backup.

Alternatively run these in separate terminals:

```powershell
php scripts/serve.php
npm run dev
php artisan queue:work --queue=video-publishing --tries=1 --timeout=90
php artisan schedule:work
```

Windows CLI PHP lacks PCNTL, so Laravel can run jobs but cannot enforce Unix signal-based worker timeouts. HTTP/process timeouts remain configured. Prefer the Linux Docker worker for production; PCNTL is included there. Database workers cannot drain this queue until MySQL and migrations are available.

```powershell
docker compose -f compose.shorts.yaml config --quiet
docker compose -f compose.shorts.yaml up --build -d
docker compose -f compose.shorts.yaml exec shorts-worker ffprobe -version
docker compose -f compose.shorts.yaml logs --tail=100 shorts-worker
```

Do not run an unmonitored test worker against real queued posts: a worker processes selected social publications. For automated tests, providers/queues are mocked:

```powershell
php vendor/bin/pest tests/Feature/News/ShortVideoTest.php tests/Feature/News/HomepageTest.php tests/Feature/News/FacebookPublishingTest.php tests/Feature/News/InstagramPublishingTest.php --compact
node --test --test-name-pattern="video results|legacy image|Shorts|category" tests/js/short-video-results.test.mjs tests/js/home-carousel.test.mjs
npx tsc --noEmit
npm run build
```

## Feature file inventory

New: app/Http/Controllers/Admin/ShortVideoController.php; app/Jobs/PublishShortVideo.php; app/Models/ShortVideo.php; app/Models/ShortVideoPublication.php; app/Services/Shorts/{CloudinaryVideoService,VideoInspector,ReelPublisher,MetaVideoRejected}.php; database/migrations/2026_10_21_000001_create_short_videos.php; config/shorts.php; resources/js/pages/admin/short-videos.tsx; docker/shorts-worker.Dockerfile; compose.shorts.yaml; tests/Feature/News/ShortVideoTest.php; tests/js/short-video-results.test.mjs; docs/short-videos.md.

Integrated: routes/web.php; routes/console.php; app/Http/Controllers/Home/WelcomeController.php; resources/js/components/{app-sidebar,publish-news-dialog,publish-result-dialog,publication-preview,home-shorts}.tsx; resources/js/lib/manual-publish.ts; resources/js/pages/welcome.tsx; tests/js/home-carousel.test.mjs (Shorts fixture); composer.json; .env.example; config/php/uploads.ini; bootstrap/app.php.

Pre-existing homepage/header/carousel changes were preserved. Existing image publisher services were not modified. This verification pass added safety/result-dialog tests, documentation, and explicit mbstring dependency installation for Docker; it did not redesign UI or change credentials.
