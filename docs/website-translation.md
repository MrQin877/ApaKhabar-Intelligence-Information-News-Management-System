# English / Indonesian website translation

The existing globe button cycles ID ? EN and saves `apakhabar-language` in browser localStorage. A saved `ms` choice falls back to ID and is overwritten. Website API targets are only `en` and `id`; optional source is `auto`, `en`, or `id`. Malay is not a website option. Existing LibreTranslate model files are retained; no service replacement or model download is required.

Reviewed menu/UI labels use `resources/js/lib/translation/dictionary.ts`. Other displayed text (news titles, descriptions, article paragraphs, menus, placeholders, titles, aria labels and image alt text) uses Laravel and the existing LibreTranslate container. Input values, editors, code, names/identifiers marked `translate="no"`, third-party documents and image pixels remain original.

## Failure investigation, 2026-11-13

Two real browser pages loading `/news/14` simultaneously reproduced a 503 for the same English batch (4 strings, 58 characters). Other batches returned 200; the failed batch succeeded after an automatic retry. Laravel's matching 15:26:04 log recorded a `RuntimeException` with null upstream status. An earlier 15:20:47 record showed the same failure class for Malay. LibreTranslate was healthy; direct translation and long-article responses worked.

The application acquired a single global inference lock **before looking up cached translations**, using an immediate acquisition attempt. An ordinary overlapping request was therefore rejected locally, including a fully cached batch. The frontend retried these artificial failures and could keep a persistent header warning. Earlier cache-write warnings were also present; their root-owned cache subtree was repaired in the previous investigation. The current reproduced failure was local lock contention, not an upstream response failure. General app access logs also contain 419/429 records from other traffic; these are not attributed to translation without matching browser requests.

## Current behavior

- Cache reads happen first. Fully cached requests bypass inference locking. Cold requests wait up to 50 seconds for the shared lock (`LIBRETRANSLATE_LOCK_WAIT`), then re-read the cache so overlapping identical calls reuse the completed result. The existing bounded upstream timeout remains 45 seconds.
- The API accepts 20 strings, 3,000 characters per string, 12,000 total. The frontend sends at most four strings / 1,400 UTF-16 code units and chunks long nodes at 700 Unicode code points. Newlines and chunk-boundary whitespace are preserved outside inference; HTML elements and events are not replaced.
- Nonempty translations are cached for seven days using the existing v2 source/target/text/service key. Duplicate strings are deduplicated. A bounded in-memory frontend cache reuses successful responses across language switches; no content is stored in localStorage.
- Source hints `lang="id"` / `lang="en"` or `data-translation-source` are supported. Known source = target requires no translation request. Unknown sources retain LibreTranslate's existing automatic detection.
- There are no automatic frontend failed-request retries, Retry buttons, or persistent header error messages. An HTTP/network failure leaves originals visible and stops remaining pending batches for that pass, avoiding a request storm during an outage. Failed keys are remembered for that translator instance so mutations do not resubmit them. A later language switch can make a new attempt; successful results are reused.
- The globe button retains its design and accessible working status. Failure never blocks reading or editing the page. Safe Laravel logs record exception class, reason, upstream HTTP status when available, elapsed time, languages, text count and character count; never submitted text, credentials, or upstream error bodies.

## Verification

```sh
php artisan test tests/Unit/WebsiteTranslationTest.php
node --test tests/js/website-translation.test.mjs
npm run build
```

11 PHP tests / 31 assertions passed, including cached requests while the inference lock is held, busy fallback, API rejection of MS targets/sources, cache failures, response validation and deduplication. The optional Playwright browser regression passed long formatted content, paragraph preservation, language cleanup, source hints, successful cache reuse, dynamic content, original fallback and exactly one failed request without automatic retries. Production build and TypeScript check passed (bundle-size warning only).

Actual updated Laravel service ? LibreTranslate results with fresh article paragraphs:

| Direction | Source characters | Fields | Paragraphs retained | Cold complete run | Cached run |
| --- | ---: | ---: | ---: | ---: | ---: |
| ID ? EN | 10,234 | title + description | 48 / 48 | 90.28 s | 0.003 s |
| EN ? ID | 10,470 | title + description | 48 / 48 | 78.93 s | 0.002 s |

Article totals span multiple small requests. Checks validate nonempty responses, field counts and every numbered paragraph marker. Real output included ?The library also provides reading materials for the family.? and ?Perpustakaan juga menyediakan bahan bacaan untuk keluarga.? Model wording still requires editorial judgment.

The live test uses no HTTP fakes:

```sh
docker cp app/Services/WebsiteTranslation.php apakhabar-docker-app-1:/tmp/WebsiteTranslation.php
docker cp tests/Live/website-translation.php apakhabar-docker-app-1:/tmp/website-translation-live.php
docker exec -u www-data apakhabar-docker-app-1 php /tmp/website-translation-live.php
```

Run container checks as `www-data` to avoid creating root-owned cache files. Standard future deployments use the existing Compose app/web build and your normal LAN overlay. The running local images were updated using a small layer containing only the changed translation PHP/config files and verified frontend assets; no model, database, or worker reset is required.


Deployed browser verification (`node tests/Live/website-translation-browser.cjs`) passed after recreating only app/web with the existing LAN configuration:

- Two simultaneous page loads: all observed translation batches 200.
- Two identical fresh, uncached EN requests: 200 / 200 with identical actual LibreTranslate responses; no lock-contention 503.
- EN ? ID article text changed; switching back to EN reused in-memory results with zero new translation requests.
- A saved MS preference became ID; the public MS target was rejected with 422.
- A controlled browser-level 503 resulted in exactly one failed request, no mutation-driven retries, unchanged original text, no Retry button and no persistent error text. This 503 was deliberately injected; ordinary requests passed.
- App, web and LibreTranslate remained healthy. Other containers were not recreated.

Changed source files for the EN/ID update: `app/Services/WebsiteTranslation.php`, `app/Http/Controllers/WebsiteTranslationController.php`, `config/translation.php`, `resources/js/components/website-language.tsx`, `resources/js/lib/translation/website-translator.ts`, `resources/js/lib/translation/dictionary.ts`; regression/live tests and this document record verification. Refresh an already-open browser page once to load the updated frontend assets.
