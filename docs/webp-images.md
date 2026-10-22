# News image optimization

The existing `NewsImageOptimizer` uses local PHP GD only: no image API, subscription, trial, or network request is required for WebP conversion.

## Scope and formats

- Manual news `cover_photo` uploads (JPG/PNG, up to 5 MiB) and assistant draft `image` uploads (JPG/PNG/WebP, up to 10 MiB) call the same optimizer.
- Encodes WebP at GD quality **80**, after EXIF orientation correction, with maximum width **1920 px**; aspect ratio and transparency are preserved. Small originals are not enlarged. Height can exceed 1920 for portraits; the limit is width, not longest edge.
- Decoded input is capped at 24 megapixels and available PHP memory. A large camera image may be rejected at a lower memory limit even below 24 MP. WebP height must not exceed 16383 pixels.
- Originals use `news-images/<sha256>.webp` on `NEWS_MEDIA_DISK` (default `public`). Repeated identical encodings reuse a path. Preview uploads may use a temporary news-image subdirectory.
- Draft `image` stores the optimized URL. `image_variants` stores crop URLs. Publication uses the website crop in `news.image` when one exists; otherwise it uses the original optimized cover. Replacing an assistant image clears stale crops/variants and invalidates review.
- Website crops are 1600 x 900 WebP, quality 80. Facebook/Instagram crops remain JPEG (quality 95) at their existing platform dimensions. Social JPEG fallbacks flatten transparency on white, retain the WebP original, and use the configured media disk.
- Already stored images and arbitrary external image URLs are not bulk converted or rewritten. OCR/document uploads use their separate original-byte storage pipeline.
- Existing social publishing still uses the project's configured Cloudinary/Meta integration. That existing delivery integration is separate from the free local GD optimization; this change does not remove it or claim social publishing is offline.

## Runtime prerequisites

Run `php scripts/check-image-support.php` with the PHP binary used by the application and workers. It checks GD JPEG/PNG/WebP, EXIF, fileinfo, mbstring, and actual WebP alpha encoding/decoding. It does not test HTTP headers, a live cloud bucket, or Apache/FPM's separately loaded PHP configuration.

### XAMPP

Enable `gd`, `exif`, `fileinfo`, and `mbstring` in the active `php.ini` (load mbstring before exif on Windows), then restart Apache and workers. Verify the Apache PHP configuration as well as CLI; they can use different binaries/INI files. Keep upload/post limits at least as large as the endpoint limits and allow multipart overhead. `config/php/uploads.ini` contains the project's local upload/memory settings.

Run `php artisan storage:link`; `public/storage` must point to `storage/app/public`. Apache must serve `.webp` with `Content-Type: image/webp` (the inspected XAMPP mime.types already contains the mapping). Do not expose a permanent public phpinfo endpoint.

### Docker / cloud

This repository has a translation-service Compose file, not a Laravel PHP application image. The deployment PHP image must install GD built with JPEG and WebP support, plus EXIF/fileinfo/mbstring. Merely installing GD without libwebp support is insufficient. Run the preflight inside both web and worker containers before rollout. The CI PHP setup explicitly enables GD/EXIF.

Use a persistent shared public volume plus storage link, or configure `NEWS_MEDIA_DISK=s3` with the existing filesystem settings. Ensure public read access or CDN delivery and correct Content-Type metadata (`image/webp` for website, `image/jpeg` for social variants). Verify bucket policies support the configured public visibility. Set APP_URL/asset/CDN URLs for the deployment and refresh cached configuration. No additional optimization service is needed.

Docker and real cloud delivery require deployment testing; fake S3 tests validate the application disk/URL behavior, not credentials, bucket ACLs, CDN headers, or network reachability.

## Browser verification

1. Upload a JPG wider than 1920 px in the manual news editor. Save the draft and publish to the website. In DevTools Network, disable cache and inspect the image response: URL ends in `.webp`, response Content-Type is `image/webp`, and bytes decode as WebP. Check naturalWidth/naturalHeight, not CSS display dimensions. The original is at most 1920 px wide; the website crop is 1600 x 900.
2. Repeat using a transparent PNG and a phone JPEG with EXIF rotation, in both manual and AI-assistant draft uploads. Check transparency against a contrasting background and visually correct rotation. Replace an image and check the saved draft/crop preview uses the new image.
3. Preview all platform crops: website WebP; Facebook/Instagram JPEG with a white alpha background. Confirm the website published record references its website variant while the draft retains its source URL.
4. Expand the Network response to confirm actual MIME; a `.webp` filename alone is not proof. GD quality 80 is verified in code/tests and cannot reliably be inferred from browser file properties. WebP may be larger than a tiny/simple input; compression is not a guarantee of smaller size for every file.
5. Check an older JPG/PNG article still displays unchanged. Upload a JPG/PNG OCR document and verify its original download is unchanged.
6. Repeat on the deployed Apache/FPM/container and real storage/CDN. Live social posting requires the existing account configuration and explicit publishing action; automated tests mock external providers.


## Verification checkpoint - 20 October 2026

Status: **Partial verification**. All image-specific tests pass, but the broader selected suite has one unrelated category test failure, and live browser/container/cloud delivery is not verified.

The resumed review found the previous WebP fixes already committed in `42e4cb1`; no production implementation was rewritten:

- Instagram JPEG fallback writes and reads NEWS_MEDIA_DISK consistently for both PNG and WebP, including cloud storage, with image/jpeg metadata.
- Facebook's uncropped local WebP sources are converted to JPEG with GD before the existing delivery integration.
- Assistant image fixtures include required draft fields; manual cover fixtures now contain valid PNG bytes (the former fixture had an IDAT CRC error). Facebook publication fixtures include the required category. Production validation was not relaxed.

Verification results:

- Selected PHP suites: **167 passed, 1 failed, 1786 assertions**. Suites: WebpOptimizationTest, ManualEditorTest, ImageCropsTest, InstagramPublishingTest, FacebookPublishingTest, DocumentPreviewTest, UploadLimitsTest.
- Remaining failure: ManualEditorTest, `AI category resolution ignores inactive and deleted categories including when none remain`. It expects null with no active categories, while NewsCreatorController::resolveCategoryId calls firstOrFail (line 730). This is unrelated to image processing and was left unchanged.
- All 7 frontend image crop tests pass, including parity with PHP crop calculations.
- `npm run build` passes (Vite build and TypeScript no-emit check).
- PHP syntax checks pass for 12 relevant implementation/test/preflight files. Pint passes for the 8 previously changed PHP files.
- Preflight passes on both C:/xampp/php/php.exe and C:/Testxampp/php/php.exe (PHP 8.2.12, GD JPEG/PNG/WebP, EXIF, fileinfo, mbstring, actual WebP alpha round trip).
- `docker compose -f compose.translation.yaml config --quiet` passes. Docker daemon is unavailable. This Compose file only defines LibreTranslate; no application PHP Dockerfile exists to verify GD build flags.
- S3 coverage uses fake storage; social-provider calls are mocked. No real cloud uploads or social posts were sent by verification.

The browser checks above, Apache/FPM runtime checks, real bucket/CDN MIME delivery, and PHP application container checks remain manual deployment gates. WebP conversion itself is entirely local GD; existing Cloudinary/Meta delivery remains separate.
