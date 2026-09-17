# English / Indonesian website translation

The compact header button shows ID by default; clicking it switches to EN, and clicking again switches back. It appears in public, authentication and admin headers, including mobile navigation. The choice is saved as `apakhabar-language` in this browser. Indonesian is the default.

Common interface labels have reviewed wording in `resources/js/lib/translation/dictionary.ts`. Other displayed text is translated by Laravel through the local LibreTranslate service. Original database content, input values and editable drafts are not changed. Language switching restores original text before applying the new language. Errors leave originals visible. The button tooltip reports failure; switch languages to retry.

## Local service

Docker Desktop must be running:

```sh
docker compose -f compose.translation.yaml up -d
docker compose -f compose.translation.yaml logs --tail 30
```

The pinned v1.9.6 image binds only to `127.0.0.1:5005`. It installs English, Indonesian and Malay models (the existing site has mixed-language source text), and keeps them in a named Docker volume. The first installation needs internet. Subsequent translation works without internet provided Docker, Laravel and the models are available. Browsers still need access to the application server; this is not a browser-offline/PWA implementation. Do not remove the model volume if you need offline operation.

Laravel defaults to `http://127.0.0.1:5005`; `.env.example` documents overrides. If Laravel also runs in a container, give it access to the translation service on a private Docker network and use that service's hostname. No upstream API key is exposed to the browser. Run `php artisan config:clear` after changing configuration.

```sh
docker compose -f compose.translation.yaml stop
```

## Data flow and safeguards

`POST /website/translate` uses the normal web/CSRF middleware and a 60 requests/minute/IP rate limit. Only `en` and `id` targets are accepted, with 20 texts/batch, 3,000 characters/text and 12,000 characters/request limits. Translation is plain text, never inserted as HTML. Upstream connections have timeouts and return generic failures without logging submitted text or secrets.

The server caches results for seven days, keyed by source text, target and service URL, in the configured cache store (file by default). Treat this cache like other application data: it can contain displayed private content. The frontend only keeps translation results in memory, not localStorage.

## Extending and maintaining

- Add reviewed UI translations to the dictionary; both English and Indonesian source labels are recognized.
- Use `translate="no"` / `data-no-translate` for personal names, identifiers and other content that should remain original. Shared account identity is already excluded. Do not assume machine translation can reliably recognize every name inside prose.
- Scripts, styles, code, avatars, editable content and textarea content are excluded. Email/URL-only strings and numeric-only values are skipped. Inputs keep original values. Date strings with month names may be translated as display text.
- The observer covers React/Inertia navigation and portaled dropdowns. It only edits text node data and descriptive attributes (placeholder, title, aria-label, alt); it never replaces React-owned elements or changes link targets. New UI should prefer reviewed dictionary entries, and test dynamic text updates when changing component implementations.
- Text inside images, canvas, PDFs, third-party iframes, and browser-native validation UI is not translated. Page metadata/SEO remains in the source language. This is client-side displayed-content translation, not separately indexed localized URLs.
- Translation quality for long text and fragmented inline markup remains model-dependent. Editors must review any translation they intend to publish; this feature does not publish or overwrite content.

## Verification

```sh
php artisan test tests/Unit/WebsiteTranslationTest.php
npm run build
npm run types:check
```

Browser checks performed: dictionary translation, dynamic translation, preserving inputs/editors/identity, event handlers, text updates, cleanup, language switching, request-loop prevention, and failure fallback. Live Laravel-to-LibreTranslate smoke checks were verified in both directions with sample text.

References: https://docs.libretranslate.com/guides/installation/ and https://docs.libretranslate.com/api/operations/translate/
