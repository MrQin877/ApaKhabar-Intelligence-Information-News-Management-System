# Facebook and Instagram publishing setup

## What is OAuth?

OAuth is a way to give ApaKhabar permission to use your social media accounts without giving ApaKhabar your Facebook or Instagram password. You sign in on Meta's website, approve access, and choose which Page or Instagram account ApaKhabar can publish to. Meta gives ApaKhabar an access token, which acts as a permission pass. That access can expire or be revoked, so you may need to reconnect later.

## Setup overview

| Part | Who completes it? | What it does |
| --- | --- | --- |
| 1. Configure Meta OAuth | Developer / system administrator | Enables Facebook Login for this ApaKhabar installation. |
| 2. Prepare publishing accounts | Facebook Page / Instagram account owner | Makes the accounts eligible for publishing. |
| 3. Connect in ApaKhabar | ApaKhabar Administrator / Moderator | Authorises and selects the accounts they want to publish to. |

Complete these parts in order. The developer normally configures the Meta application once per installation; publishing users then connect their own eligible accounts.

> Reference screenshots in this guide come from external websites. They show example accounts and may use older menu layouts. Follow the text for ApaKhabar-specific values, and keep screenshot source credits when sharing this guide.

## Part 1: Developer — configure Meta OAuth

### 1.1 Open or create the Meta application

1. Open [Meta for Developers — My Apps](https://developers.facebook.com/apps/) and sign in. Complete developer registration if prompted.
2. Select the Meta application used for ApaKhabar. If none exists, select **Create App** and choose a business app or supported use case that offers **Facebook Login for Business**. Meta's creation screens can vary.
3. Add or enable **Facebook Login for Business** for the application.
4. Complete the app details and any business, privacy policy or data-deletion requirements shown in the dashboard.

Both Facebook and Instagram connections in this project use the **same Meta application and Facebook callback**. A separate Instagram Login application is not required for this flow.

### 1.2 Find the App ID and App Secret

Open **App settings > Basic** (called **Settings > Basic** in older dashboards).

| Meta dashboard value | ApaKhabar server setting | Meaning |
| --- | --- | --- |
| App ID | `FACEBOOK_APP_ID` | Identifies your Meta application. |
| App Secret | `FACEBOOK_APP_SECRET` | Private credential used by the server during authorisation. |

These are the credentials people sometimes call the Meta “API keys”. An App ID, App Secret, login Configuration ID and account access token are different values; do not substitute one for another.

![Reference Meta Basic settings screenshot showing App ID and a masked App Secret](https://fusionauth.io/img/docs/lifecycle/authenticate-users/identity-providers/social/facebook-app-basic-settings.png)

*Developer reference A: Where to find the App ID and App Secret. Source: [FusionAuth — Facebook identity provider](https://fusionauth.io/docs/lifecycle/authenticate-users/identity-providers/social/facebook). Use your own application's values.*

### 1.3 Register the return address (OAuth callback)

The callback is the address Meta sends the user back to after they approve access.

1. Open **Facebook Login for Business > Settings**.
2. Enable **Client OAuth Login** and **Web OAuth Login**. Use strict redirect matching.
3. Under **Valid OAuth Redirect URIs**, register the exact callback for the running ApaKhabar website:

   ```text
   https://YOUR-APAKHABAR-DOMAIN/admin/social/facebook/callback
   ```

4. Save the settings. Use exactly the same value for `FACEBOOK_REDIRECT_URI` on the server.

For local development, this repository documents `http://localhost:8000/admin/social/facebook/callback`. Start login from `http://localhost:8000` in the same browser session. If Meta automatically allows localhost in Development mode and will not save it, follow that development exception. Do not substitute a LAN IP. Production requires a working HTTPS site; changing the URL text alone does not enable HTTPS.

![Reference screenshot of Meta Client OAuth settings and Valid OAuth Redirect URIs](https://assets.wpdeveloper.com/2024/06/image-19.png)

*Developer reference B: OAuth settings and callback registration. Source: [WPDeveloper — Auto Share WordPress Posts on Instagram](https://wpdeveloper.com/auto-share-wordpress-posts-on-instagram/). The example URLs belong to another product: replace them with ApaKhabar's callback above.*

### 1.4 Create the two login configurations

Open **Facebook Login for Business > Configurations**. Create one configuration for Facebook publishing and another for Instagram publishing. Choose **User access tokens** for both, matching this project's implementation.

| Configuration | Permissions to include | Save its Configuration ID as |
| --- | --- | --- |
| Facebook publishing | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` | `FACEBOOK_LOGIN_CONFIG_ID` |
| Instagram publishing | `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish` | `INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID` |

Allow access to the applicable Page and linked Instagram assets. Copy each configuration's **Configuration ID**, rather than the App ID or account ID.

![Reference configuration screen showing User access token and Configuration ID](https://i.sstatic.net/yr28zOY0.png)

*Developer reference C: Finding the Configuration ID and User access token selection. Source: [Stack Overflow — Facebook Login configuration example](https://stackoverflow.com/questions/78890190/fb-login-and-fb-getloginstatus-return-authresponse-null-status-unknown). This picture is a visual reference only: use the two separate permission sets in the table above.*

### 1.5 Save the settings on the ApaKhabar server

Edit the Laravel server's private `.env` file:

```dotenv
APP_URL=https://YOUR-APAKHABAR-DOMAIN
FACEBOOK_APP_ID=YOUR_META_APP_ID
FACEBOOK_APP_SECRET=YOUR_META_APP_SECRET
FACEBOOK_REDIRECT_URI=https://YOUR-APAKHABAR-DOMAIN/admin/social/facebook/callback
FACEBOOK_LOGIN_CONFIG_ID=YOUR_FACEBOOK_CONFIGURATION_ID
INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID=YOUR_INSTAGRAM_CONFIGURATION_ID
```

Replace the placeholders with your values. For local development, use the localhost origin described above. Keep the repository's existing Graph API version settings unless making a separately verified upgrade. Then run from the Laravel project directory:

```shell
php artisan config:clear
```

Keep the App Secret and access tokens on the server. Do not put them in frontend code, a `VITE_` variable, screenshots or shared documentation. See [developer reference](#developer-reference-migration-and-implementation) for migration, deployment and legacy credential details.

### 1.6 Check test and public access

In Development mode, test with eligible app-role/test accounts that can publish to the Page and access its linked Instagram account. Before allowing other users to connect, complete Meta's applicable permission review, Advanced Access, business verification and live-app requirements shown for your app. Switching to Live alone does not grant publishing permissions.

Use Parts 2 and 3 to test the real connection. Check Facebook and Instagram separately and verify that the intended accounts appear.

**Do I need to manually generate a long-lived token in Graph API Explorer?** No, not for the normal Settings connection. ApaKhabar handles the authorisation-code exchange, token validation and long-lived user-token exchange on the server, then retrieves eligible accounts. Manually retrieving a Page token and saving `FACEBOOK_PAGE_ACCESS_TOKEN` is a separate legacy/fallback setup for a fixed Page; it does not configure OAuth for users. Keep any existing fallback credentials until the migration described in [developer reference](#developer-reference-migration-and-implementation) is complete.

Implementation reference: [developer reference](#developer-reference-migration-and-implementation). Platform reference: [Meta — Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business).

## Part 2: Account owner — prepare Facebook and Instagram for publishing


### Account requirements

| To publish to | What you need |
| --- | --- |
| Facebook | A Facebook Page and permission to create and publish posts on that Page. |
| Instagram | An Instagram Professional account (Business or Creator), linked to a Facebook Page that you can publish to. |
| Either platform | An Administrator or Moderator account in ApaKhabar and an administrator-configured Meta integration. |

Facebook publishing uses a **Page**, rather than a personal Facebook profile. You do not need to enable professional mode on your personal Facebook profile.

If you only want to publish to Facebook, complete Part 2 Step 1 and Part 3. For Instagram publishing, complete all account preparation steps in Part 2, then Part 3. Skip any account preparation you have already completed.

> The screenshots below are reference images from external guides, not screenshots of ApaKhabar or your accounts. Meta's menu names and screen layouts may differ by app version, device and language. Sources are provided below each image.

### Step 1: Create or choose a Facebook Page

If you already manage a suitable Page, use that Page and check that you have permission to publish posts.

Otherwise:

1. Log in to Facebook.
2. Open **Menu > Pages > Create new Page**. On desktop, you can also visit [Create a Facebook Page](https://www.facebook.com/pages/create/).
3. Enter the **Page name**, choose a **category**, and add a description if requested.
4. Select **Create Page** and follow the remaining setup prompts.

![Reference screenshot of Facebook Page creation, with fields for Page name, category and bio](https://www.mxgive.com/assets/images/blogs/facebook-page-step-4.jpg)

*Figure 1: Creating a Facebook Page. Source: [MxGive — How to Set Up a Church Facebook Page](https://www.mxgive.com/how-to-set-up-a-church-facebook-page). The example category is illustrative; choose one suitable for your organisation.*

### Step 2: Switch Instagram to a Professional account

1. Open the Instagram app and go to your **profile**.
2. Tap **☰** to open **Settings and activity** (sometimes called **Settings and privacy**).
3. Find **For professionals**, then select **Account type and tools**.
4. Tap **Switch to professional account**.
5. Follow the prompts, choose a suitable category, and select **Business** or **Creator**.
6. Complete the setup. If Instagram offers to connect a Facebook Page, choose the Page from Step 1; otherwise, continue with Step 3 below.

![Reference screenshots showing Instagram Account type and tools and Switch to professional account](https://www.guidingtech.com/wp-content/uploads/Professional-vs-Personal-account-on-Instagram-1-side.jpg)

*Figure 2: Switching Instagram to a Professional account. Source: [Guiding Tech — Professional vs. Personal Account on Instagram](https://www.guidingtech.com/instagram-professional-vs-personal-account/).*

### Step 3: Link Instagram to your Facebook Page

1. Open Facebook and **switch into the Page** prepared in Step 1.
2. Open **Settings & privacy > Settings**.
3. Find **Linked accounts**, then select **Instagram**.
4. Select **Connect account** and log in to the Instagram Professional account from Step 2.
5. Follow the prompts to confirm the connection. Check that the correct Instagram account appears as linked to the Page.

![Older reference screenshot of Facebook Page settings showing Connect to Instagram and the Connect Account button](https://d33v4339jhl8k0.cloudfront.net/docs/assets/5d089f8504286318cac45fd7/images/5f4d094d042863444aa108c6/file-77wEx8IAe9.png)

*Figure 3: Connecting Instagram to a Facebook Page. Source: [Elfsight — How to connect Facebook Page with Instagram account](https://codecanyon.elfsight.com/article/762-how-to-connect-facebook-page-with-instagram-account). This older screen shows Instagram directly in Page settings; newer layouts place it under Linked accounts. See also the [illustrated Leadsie guide](https://www.leadsie.com/blog/link-instagram-facebook-page).*

## Part 3: ApaKhabar user — connect accounts in Settings

1. Log in to ApaKhabar as an **Administrator** or **Moderator**.
2. Open **Settings > Integration**.
3. Select **Connect Facebook** or **Connect Instagram**.
4. Continue through **Facebook Login**, using the Facebook account that manages your Page.
5. Grant the requested permissions and include the Page and linked Instagram account you want ApaKhabar to access.
6. When ApaKhabar displays the available accounts, select the correct **Facebook Page** or **Instagram account** and confirm.
7. Check that the platform shows **Connected**. Repeat these steps for the other platform if you want to publish to both.

Instagram also uses Facebook Login in ApaKhabar. Completing the connection grants access; it does not publish a post automatically.

There is no external screenshot of ApaKhabar's own connection screen in this guide. For a report or appendix, capture the actual **Settings > Integration** page and account selector after configuration, and hide personal details. Suggested caption: **Authorising ApaKhabar through Facebook Login (OAuth)**.

### If your account does not appear

- **Facebook Page missing:** check that you signed in with the Facebook account that has publishing access to that Page and included it during authorisation.
- **Instagram missing:** check that it is a Professional account, is linked to the correct Facebook Page, and that both assets were included during authorisation.
- **Permission denied or connection expired:** reconnect through **Settings > Integration** and complete the permission prompts.
- **Connection still unavailable:** ask the system administrator to check the Meta application configuration and permission access. Development-mode apps may restrict connections to eligible app-role/test accounts.

## Further references

- [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Meta: Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/)

When reusing this guide in an appendix, retain screenshot source credits and adapt figure numbers to the report's numbering scheme.

## Developer reference: migration and implementation

This section preserves the deployment and implementation details for maintainers. For first-time setup, start with Parts 1–3 above.

### Configuration behaviour

When a configuration ID is supplied, the authorization request sends `config_id`; permissions come from that dashboard configuration. Without an ID, the code retains the existing explicit `scope` flow for compatibility with standard Facebook Login. Server-side token validation always requires the permission set for the target platform. A missing or wrongly configured Business Login configuration cannot be fixed by enabling a UI button.

### Credentials and compatibility

Both OAuth buttons depend on the shared Facebook app credentials, independently of legacy account tokens. `FACEBOOK_REDIRECT_URI` also applies to Instagram authorization. Existing Graph API version settings are retained.

`INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, and `INSTAGRAM_REDIRECT_URI` are no longer read by the application and may be removed. They are not needed to publish with an already stored direct-Instagram token. New authorizations, including reconnecting a legacy account, always use Meta/Facebook Login.

Keep these fallback variables until every intended publishing user has connected the corresponding platform through OAuth:

- `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`
- `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`

The fallback applies only when the signed-in user has no saved platform record. A saved expired/disconnected record prevents fallback. Removing fallback values before migration makes users with no connection unable to publish. Environment Instagram tokens retain their existing `graph.instagram.com` behavior; tokens are not guessed or converted.

Keep `APP_KEY` unchanged: it decrypts saved credentials. Keep `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; the image publishing dependency is unchanged. Clear/rebuild Laravel configuration cache after environment changes.

### Database migration and compatibility

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

### Flow and security

1. The platform-specific Connect/Switch/Reconnect action starts Facebook authorization. The random state is bound to the session, user, target platform and a ten-minute lifetime.
2. The shared Facebook callback consumes state once, exchanges the code server-side, validates the app and platform-specific permissions, and exchanges the user token for a long-lived token.
3. Pages are retrieved using cursor pagination on a fixed Graph endpoint. Instagram requests expand `instagram_business_account{id,username}` and offer only Pages with a linked professional account and publishing tasks.
4. The selector shows the Instagram handle and linked Page name, or the Facebook Page name. Pending tokens are encrypted in server cache for ten minutes. Only names, IDs and an opaque selection ticket reach the browser.
5. Selection is tied to the authenticated user/session and the platform in the encrypted pending payload. A browser-supplied platform is ignored. Choosing Instagram writes only the Instagram record, using the linked Instagram ID and Page token; it never changes the Facebook record.
6. Existing credentials remain intact until selection succeeds. Cancellation, invalid state, missing permissions, no eligible accounts, an invalid selection or an expired ticket cannot replace them.
7. Confirmed disconnect clears the selected platform's stored credentials, leaves an invalidated record preventing fallback, and cancels the session's pending shared flow/selection. Other saved platform credentials remain unchanged.

Database tokens use Laravel's encrypted cast and are hidden from model serialization. No access tokens are returned in UI props or API responses. Meta and transport errors are sanitized rather than logged verbatim. Existing authentication, role, CSRF, rate-limit and session-lock protections remain in place.

### Routes and files

- Existing `GET /admin/social/facebook/connect` and `GET /admin/social/instagram/connect` both start the shared flow.
- Existing `GET /admin/social/facebook/callback` handles both platforms.
- New `POST /admin/social/meta/account` saves the chosen Page or linked Instagram account.
- New `POST /admin/social/meta/cancel` cancels selection.
- Existing Facebook Page/cancel POST routes remain aliases for compatibility.
- The former `GET /admin/social/instagram/callback` only returns a reconnect message; it does not exchange old direct-login codes or modify saved credentials.
- Existing connection status and disconnect routes remain.

Changes are in `MetaConnectionController`, `MetaConnections`, `MetaCredentials`, `SocialConnection`, `InstagramService`, `config/meta.php`, `routes/web.php`, and the Settings Integration selector. The old direct-Instagram OAuth exchange has been removed. `.env.example` documents the shared app and two Business Login configuration IDs.

### Verification

#### OAuth discovery only

Connect, Reconnect and Switch Account use only the current OAuth user's `/me/accounts` results (including pagination). No saved Page ID or legacy environment account ID/token is used to discover or select accounts. An empty result stops the flow with a clear message and leaves saved connections unchanged. Instagram candidates come from linked professional accounts on those returned Pages. Explicit selection and Page-token validation are still required before saving.

Legacy environment credentials remain available through `MetaCredentials::forPlatform()` only when no saved row exists. This unchanged resolver serves publishing and availability/status; it does not provide OAuth account choices. Existing disconnected rows continue to suppress legacy publishing fallback. Diagnostic redaction may read legacy tokens solely to remove them from diagnostic text.

Tests mock Meta APIs and cover both permission sets, shared callback state, configuration IDs, linked-account filtering, encrypted token storage, cross-platform isolation, failure/cancellation, expired tickets, disconnect, API host routing, migration preservation, and existing Facebook/Instagram publishing behavior. Real Meta consent and app/dashboard permission access must still be verified against the configured app; automated tests do not publish to real accounts.

Official references:

- [Instagram API with Facebook Login](https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login)
- [Meta: Pages, Page tokens and linked Instagram accounts](https://www.postman.com/meta/instagram/request/lpx8lul/get-access-tokens-of-pages-you-manage)
- [Meta: Instagram publishing using Facebook Graph](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-59e5000b-326c-42a1-8545-b984c7fd0e40)
- [Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/)

The main Meta developer documentation was access/rate limited during inspection; Meta's official Postman collection was accessible for the account and publishing API details.

