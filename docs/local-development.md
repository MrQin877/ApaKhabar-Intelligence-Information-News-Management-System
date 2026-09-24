# Local development URLs

## Laravel and React website

Run in separate terminals in this repository:

```sh
php artisan serve --host=0.0.0.0 --port=8000
npm run dev
```

Local Laravel `APP_URL` is `http://localhost:8000`. Open that address.
The React website is served by Laravel/Inertia;
Vite supplies its assets. API requests default to the page's own origin, so
localhost and LAN access need no IP in JavaScript or `.env`.

`resources/js/lib/api.ts` centralizes fetch requests. `VITE_API_BASE_URL` is an
optional backend origin (without `/api`). Leave it blank for this application:
its existing session/CSRF authentication expects same-origin requests. Changing
it does not configure cross-origin authentication or move Inertia navigation.
Restart Vite after editing environment variables.

## Expo mobile app

In `C:\Testxampp\htdocs\ApaKhabar-Mobile-App`, run:

```sh
npx expo start --lan --clear
```

Connect the phone and laptop to the same WiFi and scan Expo's QR code. Allow
access to TCP port 8000 through the laptop firewall if needed. After changing
WiFi, restart Expo and reconnect/reload the app to refresh the development host.

`services/apiConfig.ts` supplies the shared Axios client's `API_BASE_URL` and
the news image `BACKEND_BASE_URL`. Resolution order:

1. `EXPO_PUBLIC_API_BASE_URL`, if nonempty (complete URL including `/api`).
2. Legacy `EXPO_PUBLIC_API_URL`, if nonempty, for existing deployments.
3. In development, Expo's `Constants.expoConfig.hostUri` hostname, port 8000.
   Expo web uses `http://localhost:8000` in development.
4. Without usable development metadata: Android emulator `10.0.2.2:8000`,
   otherwise `localhost:8000`.

Leave both override variables unset/empty for automatic detection. The local
mobile `.env` has been switched to this default. A physical phone cannot use
the simulator fallback: if detection is unavailable, set only
`EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAPTOP_HOST:8000/api` in the mobile `.env`.
Restart Expo after changing it. Existing production environment URLs and the
original platform fallbacks remain supported; production never uses Expo host detection.
Expo's tunnel forwards Metro only; to use a tunnel for Laravel, expose Laravel
separately and put its URL in the same override.

Expo reads public variables using direct `process.env.EXPO_PUBLIC_...`
references; see the [Expo environment variable documentation](https://docs.expo.dev/guides/environment-variables/).

## Backend links and test fixtures

Laravel functionality is unchanged. `APP_URL` still controls URLs generated
outside an HTTP request; set it to a reachable hostname if testing queued links
on a phone. `MOBILE_PASSWORD_RESET_RETURN_URL` and
`MOBILE_VERIFICATION_RETURN_URL` are separate app deep-link destinations, not
API URLs. Installed-app scheme defaults avoid LAN IPs. If you explicitly use an
Expo Go `exp://...` return URL, that destination still needs to match the current
Expo session. API host detection does not rewrite backend email configuration.

`MobilePasswordResetLinkTest.php` uses reserved `.example.test` hostnames
to verify that reset links preserve the incoming request host. These fixtures
never need to match your laptop.
