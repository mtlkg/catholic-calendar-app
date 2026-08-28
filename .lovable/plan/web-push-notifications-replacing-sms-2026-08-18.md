# Web push notifications (replacing SMS)

Replace the text-message channel with browser/phone push notifications. Push is free (no Twilio, no per-message cost, no 10DLC registration) and works on desktop Chrome/Edge/Firefox and on iPhone/Android when the site is added to the home screen.

## What people will get

- **New event from an organizer you follow** — push + email
- **24h reminder for an event you marked interested** — push + email
- **New DM to an organizer** — push + email
- **Reply to your discussion thread** — push + email

Every notification click opens the relevant page (event, organizer, dashboard message).

## Where people turn it on

- **Follow dialog** and **Interested dialog**: replace the phone/text checkbox with an "Also notify me on this device" button that asks for browser permission. Email stays the default; push is optional and works for guests (no account needed).
- **Dashboard → Profile → Notifications**: replace the phone-verification block with a device list — enable/disable push on this device, plus Email / Push toggles per notification type (same four rows as today).
- If the browser doesn't support push (e.g. iOS Safari not installed to home screen), show a short hint explaining to "Add to Home Screen" first, and keep email working.

## SMS removal

Remove the phone number field, verification code flow, SMS consent copy, and STOP/START handling from the UI and the notification pipeline. The SMS backend pieces stay unused (no Twilio connection is required or attempted), and the related database columns are left in place so nothing existing breaks.

## Technical details

- **Service worker**: add a dedicated push worker at `public/push-sw.js` (messaging worker, separate from any app-shell/PWA caching — no offline caching added). It handles `push` and `notificationclick` events.
- **Keys**: generate a VAPID key pair; public key ships in the client, private key stored as a backend secret.
- **New table** `public.push_subscriptions`: `id`, `user_id` (nullable, for guests), `endpoint` (unique), `p256dh`, `auth`, `locale`, `created_at`, `last_seen_at`. Service-role only grants; users manage their own rows through a security-definer RPC keyed by endpoint.
- **Link to guest opt-ins**: add `push_endpoint` to `organizer_follows` and `event_interests` so a guest follower/interested person can receive push without an account.
- **New edge function `send-push`**: signs VAPID JWTs and POSTs encrypted payloads to the push endpoints (Web Push protocol, using a Deno-compatible web-push library). Deletes subscriptions that return 404/410.
- **Update** `notify-followers-of-event`, `send-event-reminders`, `notify-conversation`: swap the `send-sms` calls for `send-push`, reading `push_*` columns in `notification_prefs` instead of `sms_*`.
- **Migration**: add `push_*` boolean columns to `notification_prefs` (defaulting on) alongside the existing email toggles.
- **Frontend**: new `src/lib/push.ts` (register worker, subscribe/unsubscribe, save to backend), rework `src/components/NotificationSettings.tsx`, `src/components/FollowButton.tsx`, `src/components/InterestedButton.tsx`.
- **i18n**: replace the `notify.*` SMS strings with push strings in English, French, and Spanish.
