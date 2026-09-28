# Settings > Integration: shared Meta OAuth

Admin and moderator users manage their own Facebook and Instagram publishing connections at `/settings/integration`. Both new connection flows use the same Meta application and Facebook callback. Instagram must be a Professional account linked to a Facebook Page.

## Meta dashboard setup

In the existing Meta application:

1. Under **Facebook Login for Business > Settings**, enable **Client OAuth Login** and **Web OAuth Login**. Use strict redirect matching.
2. Register the exact callback used by Laravel under **Valid OAuth Redirect URIs**:

   ```text
   http://localhost:8000/admin/social/facebook/callback
   ```

   Start the application and OAuth on `http://localhost:8000`, retaining the same browser session. If Meta automatically permits localhost in Development mode and declines to store it, use that development exception; do not substitute a LAN address. For deployment, use a working HTTPS origin and register its exact callback. Do not merely change a URL to HTTPS without providing HTTPS service.
3. Under **Facebook Login for Business > Configurations**, create two configurations in the same app using **User access tokens** (this implementation exchanges user tokens and retrieves `/me/accounts`, not system-user assets):
   - Facebook publishing: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
   - Instagram publishing: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
4. Enter the configuration IDs in `FACEBOOK_LOGIN_CONFIG_ID` and `INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID`, respectively. These are configuration IDs, not app IDs or account IDs. Ensure the applicable Page and linked Instagram assets are authorized. Avoid adding unrelated permissions.
5. Ensure the Facebook user has content publishing access to the Page and the Professional Instagram account is linked to that Page. In development, use eligible app-role/test accounts; access for other users depends on the app's required permission access/review and live setup.

When a configuration ID is supplied, the authorization request sends `config_id`; permissions come from that dashboard configuration. Without an ID, the code retains the existing explicit `scope` flow for compatibility with standard Facebook Login. Server-side token validation always requires the permission set for the target platform. A missing or wrongly configured Business Login configuration cannot be fixed by enabling a UI button.

## Environment

```dotenv
APP_URL=http://localhost:8000
FACEBOOK_APP_ID=<existing Meta app ID>
FACEBOOK_APP_SECRET=<existing Meta app secret>
FACEBOOK_REDIRECT_URI=http://localhost:8000/admin/social/facebook/callback
FACEBOOK_LOGIN_CONFIG_ID=<Facebook publishing configuration ID>
INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID=<Instagram publishing configuration ID>
META_GRAPH_VERSION=v25.0
FACEBOOK_GRAPH_VERSION=v26.0
```

Both OAuth buttons depend on the shared Facebook app credentials, independently of legacy account tokens. `FACEBOOK_REDIRECT_URI` also applies to Instagram authorization. Existing Graph API version settings are retained.

`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, and `INSTAGRAM_REDIRECT_URI` are no longer read by the application and may be removed. They are not needed to publish with an already stored direct-Instagram token. New authorizations, including reconnecting a legacy account, always use Meta/Facebook Login.

Keep these fallback variables until every intended publishing user has connected the corresponding platform through OAuth:

- `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`

The fallback applies only when the signed-in user has no saved platform record. A saved expired/disconnected record prevents fallback. Removing fallback values before migration makes users with no connection unable to publish. Environment Instagram tokens retain their existing `graph.instagram.com` behavior; tokens are not guessed or converted.

Keep `APP_KEY` unchanged: it decrypts saved credentials. Keep `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; the image publishing dependency is unchanged. Clear/rebuild Laravel configuration cache after environment changes.

## Database migration and compatibility

`2026_09_27_180000_add_auth_source_to_social_connections.php` adds nullable `auth_source` and backfills existing rows:

- Existing Instagram: `instagram_login`.
- Existing Facebook: `facebook_login`.
- All newly selected Meta connections: `facebook_login`.

The migration preserves IDs, encrypted tokens, expiry and timestamps. Null-source Instagram records are also treated as legacy Instagram Login for compatibility. Run this migration before using the new connection-save path.

Both publishing and status checks resolve the correct API host:

| Connection | Host |
|---|---|
| Facebook-authorized Instagram | `graph.facebook.com` |
| Existing direct-Instagram connection or environment fallback | `graph.instagram.com` |
| Facebook Page | `graph.facebook.com` |

Instagram still uses the existing JPEG preparation, Cloudinary upload/probe, caption handling and `media` -> `media_publish` sequence. Credentials are captured once per publish operation. No editor or website-publishing changes are needed.

## Flow and security

1. The platform-specific Connect/Switch/Reconnect action starts Facebook authorization. The random state is bound to the session, user, target platform and a ten-minute lifetime.
2. The shared Facebook callback consumes state once, exchanges the code server-side, validates the app and platform-specific permissions, and exchanges the user token for a long-lived token.
3. Pages are retrieved using cursor pagination on a fixed Graph endpoint. Instagram requests expand `instagram_business_account{id,username}` and offer only Pages with a linked professional account and publishing tasks.
4. The selector shows the Instagram handle and linked Page name, or the Facebook Page name. Pending tokens are encrypted in server cache for ten minutes. Only names, IDs and an opaque selection ticket reach the browser.
5. Selection is tied to the authenticated user/session and the platform in the encrypted pending payload. A browser-supplied platform is ignored. Choosing Instagram writes only the Instagram record, using the linked Instagram ID and Page token; it never changes the Facebook record.
6. Existing credentials remain intact until selection succeeds. Cancellation, invalid state, missing permissions, no eligible accounts, an invalid selection or an expired ticket cannot replace them.
7. Confirmed disconnect clears the selected platform's stored credentials, leaves an invalidated record preventing fallback, and cancels the session's pending shared flow/selection. Other saved platform credentials remain unchanged.

Database tokens use Laravel's encrypted cast and are hidden from model serialization. No access tokens are returned in UI props or API responses. Meta and transport errors are sanitized rather than logged verbatim. Existing authentication, role, CSRF, rate-limit and session-lock protections remain in place.

## Routes and files

- Existing `GET /admin/social/facebook/connect` and `GET /admin/social/instagram/connect` both start the shared flow.
- Existing `GET /admin/social/facebook/callback` handles both platforms.
- New `POST /admin/social/meta/account` saves the chosen Page or linked Instagram account.
- New `POST /admin/social/meta/cancel` cancels selection.
- Existing Facebook Page/cancel POST routes remain aliases for compatibility.
- The former `GET /admin/social/instagram/callback` only returns a reconnect message; it does not exchange old direct-login codes or modify saved credentials.
- Existing connection status and disconnect routes remain.

Changes are in `MetaConnectionController`, `MetaConnections`, `MetaCredentials`, `SocialConnection`, `InstagramService`, `config/meta.php`, `routes/web.php`, and the Settings Integration selector. The old direct-Instagram OAuth exchange has been removed. `.env.example` documents the shared app and two Business Login configuration IDs.

## Verification

### OAuth discovery only

Connect, Reconnect and Switch Account use only the current OAuth user's `/me/accounts` results (including pagination). No saved Page ID or legacy environment account ID/token is used to discover or select accounts. An empty result stops the flow with a clear message and leaves saved connections unchanged. Instagram candidates come from linked professional accounts on those returned Pages. Explicit selection and Page-token validation are still required before saving.

Legacy environment credentials remain available through `MetaCredentials::forPlatform()` only when no saved row exists. This unchanged resolver serves publishing and availability/status; it does not provide OAuth account choices. Existing disconnected rows continue to suppress legacy publishing fallback. Diagnostic redaction may read legacy tokens solely to remove them from diagnostic text.

Tests mock Meta APIs and cover both permission sets, shared callback state, configuration IDs, linked-account filtering, encrypted token storage, cross-platform isolation, failure/cancellation, expired tickets, disconnect, API host routing, migration preservation, and existing Facebook/Instagram publishing behavior. Real Meta consent and app/dashboard permission access must still be verified against the configured app; automated tests do not publish to real accounts.

Official references:

- [Instagram API with Facebook Login](https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login)
- [Meta: Pages, Page tokens and linked Instagram accounts](https://www.postman.com/meta/instagram/request/lpx8lul/get-access-tokens-of-pages-you-manage)
- [Meta: Instagram publishing using Facebook Graph](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-59e5000b-326c-42a1-8545-b984c7fd0e40)
- [Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/)

The main Meta developer documentation was access/rate limited during inspection; Meta's official Postman collection was accessible for the account and publishing API details.
