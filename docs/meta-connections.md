# Meta authentication in the publish modal

No app IDs, app secrets, accounts, or callback registrations are bundled. Empty
configuration leaves Facebook unrendered with a setup notice, and Instagram
disabled. We do not draw a substitute Facebook Login button.

## Configuration

Copy these placeholders into the local `.env` and fill them in privately after
creating the developer apps:

```dotenv
META_GRAPH_VERSION=v25.0
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_REDIRECT_URI=
```

Run `php artisan config:clear` after editing. The app secrets and account access
tokens must never use a `VITE_` prefix or appear in frontend code. Deploy the
`create_social_connections_table` migration with the feature.

Configure Facebook Login for the site's actual origin in the Meta dashboard.
Enable the JavaScript SDK and request `pages_show_list`, `pages_read_engagement`,
and `pages_manage_posts`. Production use can require Meta review/advanced access.
The SDK renders `fb-login-button` with `continue_with`, large size and
`data-use-continue-as="true"`. Meta controls its blue color, white logo,
personalized label, profile image, dimensions, hover and login loading state.
ApaKhabar does not recolor or replace that rendered component. Browser privacy
settings or blockers can prevent personalization or SDK loading.

Facebook uses the SDK popup. Laravel verifies the returned token's app and
permissions, exchanges it server-side, and returns only names/IDs for eligible
Pages. The author explicitly chooses a Page; tokens never appear in that list.
Page choices are encrypted in a user-scoped server cache with a ten-minute TTL.

For Instagram, create the **Instagram API with Instagram Login** product for
professional Business/Creator accounts. Register an exact callback such as:

```
https://YOUR-APP-HOST/admin/social/instagram/callback
```

Set `INSTAGRAM_REDIRECT_URI` to that exact value. The editor and callback must
share the same origin and session. Use an approved HTTPS development hostname
where Meta requires it; an Expo/Metro tunnel does not expose Laravel.
Request `instagram_business_basic` and `instagram_business_content_publish`.
This is the Instagram professional login flow, not retired Basic Display login.
The button is a neutral white Instagram-branded authorization control, not a
claimed SDK-rendered widget. Its unmodified full-color logo is stored locally
at `public/images/brands/instagram.png` (source: Wikimedia Commons
`https://commons.wikimedia.org/wiki/File:Instagram_icon.png`).

## State and editor preservation

Opening the modal never invokes login. Explicit clicks open authorization in a
separate window; the original React form (including a selected cover File) is
not navigated or reset. Do not close/reload the original editor during login.
The Instagram callback checks one-use, session-bound OAuth state and returns a
same-origin message without credentials. The editor validates the popup source
and reloads only connection data. Popup-close polling covers lost messages.
The modal remains open. Denied consent, blocked popups, expired tokens and
missing permissions have explicit feedback. No automatic account selection or
publishing occurs during authentication.

Tokens are encrypted at rest and hidden from serialized models. Connection
status comes from the server, including known expiry/revocation; SDK login alone
does not enable a checkbox. Status is refreshed when opening the modal and after
authorization. A temporary Meta outage does not erase an existing connection.

**Scope:** this implements account authentication and connection controls.
Actual Facebook/Instagram post delivery is not implemented by the existing
publisher. It still rejects social destinations with an explicit message;
Website publishing continues to work. Selecting a social destination never
silently posts the article to Website instead. Add social delivery, failure
handling and duplicate-post protection before enabling production social posts.

## References

- [Meta Facebook Login button](https://developers.facebook.com/documentation/facebook-login/web/login-button)
- [Instagram business login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/)
- [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)

Tests use fake HTTP responses and fake credentials. Real Meta authorization,
SDK appearance/personalization, app review and callback registration must be
verified after supplying your developer app configuration.
