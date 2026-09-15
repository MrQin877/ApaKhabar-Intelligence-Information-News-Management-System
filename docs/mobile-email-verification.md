# Mobile email verification

The Expo app lives at `../ApaKhabar-Mobile-App`. It uses Expo Router and the existing `apakhabarmobileapp` scheme. Web and mobile share the same `emails.email_verified_at` record.

## API

Use the existing bearer token and `Accept: application/json`.

| Endpoint | Request | Result |
| --- | --- | --- |
| `GET /api/profile` | None | User including `email_verified_at` and `phone_verified_at` (ISO timestamps or null) |
| `PATCH /api/profile` | `{ "name": "Name", "email": "person@example.com" }` | Updated user; changing email resets verification |
| `POST /api/email/verification-notification` | Empty body | `{ "status": "verification-link-sent", "email": "person@example.com" }` |

Login and registration user payloads also include both timestamps. Resend reads the saved email from the authenticated user, never from a request recipient. Unverified users can access all three endpoints. Resend returns `already-verified` without sending when appropriate, 422 for a missing email, 401 for missing authentication, and 429 with `Retry-After` for throttling (one request per minute). Profile validation returns standard Laravel 422 errors.

## Email links and configuration

Mobile registration and resend use `MobileVerifyEmail`, extending Laravel's existing notification. Its signed HTTPS link points to `/mobile/email/verify/{id}/{hash}` and expires after `auth.verification.expire` minutes (60 by default). The browser endpoint verifies the signature, expiry and current email hash without requiring a web session or bearer token. Verification updates the shared email record and dispatches `Verified` once. Invalid links display a retry explanation with HTTP 403. The existing web verification routes and notification remain unchanged.

The browser result has a “Buka ApaKhabar” button, a website fallback, and instructions for returning manually. The app always fetches profile status instead of trusting link parameters.

Set Laravel `APP_URL` to a backend URL reachable from the phone and email browser, and configure the existing Laravel mail transport. Set Expo `EXPO_PUBLIC_API_URL` to that backend's `/api` URL.

`MOBILE_VERIFICATION_RETURN_URL` is server-controlled; it is never taken from request input:

- Installed app default: `apakhabarmobileapp:///verify-email`.
- Expo Go development: `exp://YOUR_EXPO_HOST:8081/--/verify-email` (use your actual Expo development URL).
- Expo web deployment: `https://YOUR_EXPO_WEB_HOST/verify-email`.

Reload cached Laravel configuration after changing environment settings. Expo Go and installed applications use different link formats: see [Expo linking documentation](https://docs.expo.dev/linking/into-your-app/).

## Mobile behavior

Profile fetches server state on focus and foreground return. Verified email and phone show independent Approved badges. Email editing requires Save before resend, uses PATCH `/profile`, hides approval for unsaved edits, and reports validation errors. Successful resend opens `/verify-email`. That screen shows the saved address, resend, manual refresh and profile navigation. Foreground and browser-focus refresh use the same server check. Requests have timeouts and duplicate-tap guards; failures remain visible and can be retried.

## Validation

Run `php vendor/pestphp/pest/bin/pest --compact tests/Feature/Auth/MobileEmailVerificationTest.php tests/Feature/Auth/EmailVerificationTest.php tests/Feature/Settings/ProfileUpdateTest.php`.

Device acceptance checks:

1. Sign in with an unverified email and a verified phone. Only the phone should show Approved.
2. Edit the email. Confirm resend is disabled until Save succeeds.
3. Resend from Profile and confirm that the verification screen opens and the message reaches the saved address.
4. Open the message in a browser with no website login. Complete verification and tap Buka ApaKhabar.
5. Confirm the verification screen and Profile fetch the new status. Repeat by returning manually and tapping the refresh button.
6. Try an expired, changed or old-email link; expect the retry page. Test offline refresh, double taps and resend throttling.
7. Confirm normal web resend and verification still work.

Automated backend tests use fake notifications; actual SMTP delivery and installed-device link handling require the configured environment.

The targeted verification/profile suite passes 22 tests (133 assertions). The seven changed Expo files pass ESLint and have no TypeScript diagnostics. The full Expo type check still reports 26 errors in unrelated files, mainly the nested `apakhabar-mobile` starter project and existing UI components. The older registration/authentication suites have 11 failures caused by outdated direct `users.email`/`users.role` queries and factory attributes; those columns are stored in related tables in this application.
