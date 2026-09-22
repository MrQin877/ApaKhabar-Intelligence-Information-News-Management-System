# Mobile password-reset links

Mobile reset emails open Laravel's /mobile/reset-password entry point. It forwards the reset token and email to the server-configured MOBILE_PASSWORD_RESET_RETURN_URL. It preserves plus signs and other encoded characters in email addresses and does not accept a redirect destination from the request.

Set this variable in Laravel's .env to match how you run Expo:

- Expo Go: exp://YOUR_COMPUTER_LAN_IP:8081/--/reset-password
- Mobile website: http://YOUR_COMPUTER_LAN_IP:8081/reset-password (use your deployed HTTPS address in production)
- Installed app: apakhabarmobileapp:///reset-password

Keep Laravel APP_URL and Expo EXPO_PUBLIC_API_URL on the reachable backend address (for example http://YOUR_COMPUTER_LAN_IP:8000 and the same address with /api). Run Laravel on 0.0.0.0:8000 and Expo on a phone-reachable LAN address. The phone must be able to reach both servers. Update development URLs when the computer's Wi-Fi address changes.

After changing Laravel settings, run php artisan config:clear. Clear route caches with php artisan route:clear if routes were cached. Restart Expo after changing its .env.

Existing emails that reach /mobile/reset-password use the corrected redirect immediately. If the original email itself points to an unreachable backend address or the token has expired, request a fresh reset email.

Run php vendor/pestphp/pest/bin/pest --compact tests/Feature/Auth/MobilePasswordResetLinkTest.php to check redirect parameters and password reset completion. Notifications are faked in tests; actual email delivery and opening Expo on a phone need a device check.
