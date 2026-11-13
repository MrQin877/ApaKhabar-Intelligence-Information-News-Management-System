# Profile photos

Authenticated API, using the existing bearer token:

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST /api/profile/photo` | Multipart `photo` file | Updated profile with `avatar` and `profile_photo_url` |
| `DELETE /api/profile/photo` | No body | Updated profile with null image URLs |
| `GET /api/profile` | No body | Current profile and image URLs |

The target is always the authenticated user; another user ID has no effect.
Photos are public because they appear beside public comments. The editor explains
this before upload. No login token is needed to load an image.

Accept JPEG, PNG or WebP, up to 5 MiB and 4096 pixels per side. The server
re-encodes to JPEG, at most 1024 pixels on the longest side, stripping metadata and
embedded content. SVG, GIF and non-image files are rejected. Random filenames
prevent stale image caches after replacement.

MariaDB stores only `users.profile_photo_path`. Files live on the existing public
disk, under `storage/app/public/profile-photos/`, in the existing
`apakhabar-docker_laravel_storage` volume. Nginx mounts it read-only and serves
`/storage`. Back up MariaDB and Laravel storage together. Do not delete volumes.

Apply only the additive migration when deploying:

```powershell
docker compose --env-file deployment/.env -f deployment/compose.yaml run --rm --no-deps app php artisan migrate --path=database/migrations/2026_11_14_000001_add_profile_photo_path_to_users.php --force
```

Never use `migrate:fresh` or reset the database. Deploy matching Laravel and Nginx
assets after rebuilding. Existing accounts and comment records are not rewritten.

Repo C replaces **Lihat Profil** with **Edit Foto Profil**. Confirming the existing
gallery crop uploads and saves immediately; removing a photo also saves immediately.
The avatar changes only after server confirmation. Failed requests and cancelled
gallery/crop operations preserve the previous photo. No separate Save action or
automatic-save information banner is displayed. Missing photos show the first
letter of the user's name on the editor, profile, comments, and replies.
The SDK-compatible `expo-image-picker` is required. Expo Go includes it; custom
development/standalone builds need rebuilding for the native module and gallery
configuration. Camera and microphone permissions are disabled.

News and Shorts comments/replies read `avatar` from their current author. Existing
website avatar components and mobile comment rows already render this field.
Refresh/reopen the page or comment sheet to see changes made on another device.

Automated tests use disposable SQLite users. The ignored local fixture
`deployment/runtime-test/profile-photo-check.php` checks upload, restart
persistence, and removal in a network-isolated container with SQLite and the real
storage volume. It refuses a non-SQLite database. Real phone gallery/permission
checks are still required before release.
