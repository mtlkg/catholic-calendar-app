# SMS Notifications (Twilio)

Add text-message notifications alongside the existing emails, with per-channel user control.

## What gets a text

1. New event published by an organizer you follow
2. 24-hour reminder for an event you marked Interested
3. New direct message between organizers
4. New reply on a discussion thread you started

## How people opt in

- **Follow / Interested dialogs**: add an optional phone number field under the email field, with a short consent line ("Text me updates. Msg & data rates may apply. Reply STOP to opt out."). Leaving it blank keeps email-only behaviour exactly as today.
- **Organizer dashboard → Notification settings**: a new panel where a signed-in organizer saves a mobile number, verifies it with a 6-digit code, and toggles Email / SMS independently for each of the four notification types.
- Every text ends with "Reply STOP to opt out"; inbound STOP marks the number opted out and stops all future sends.

## Setup you'll need

SMS requires a Twilio account with a paid phone number (texts cost roughly 1 cent each in US/Canada). I'll open the Twilio connection card in chat so you can link it — nothing works until that's connected. I'll also flag Twilio's SMS Pumping Protection and Geo Permissions (limit to US/Canada) so nobody can run up your bill.

## Technical details

**Database**
- `notification_prefs` table: `user_id`, `phone_e164`, `phone_verified_at`, and boolean columns for `email_*` / `sms_*` per notification type. RLS: owner-only select/insert/update, plus GRANTs for `authenticated` and `service_role`.
- `phone_verifications` table: hashed code, phone, expiry, attempt counter. No client read access; only the edge functions touch it.
- `organizer_follows` and `event_interests` each get a nullable `phone_e164` column plus `sms_opt_in boolean default false` for guest (non-account) followers.
- `sms_suppressions` table mirroring the existing `suppressed_emails` pattern, filled by STOP replies.
- `sms_send_log` mirroring `email_send_log` for delivery auditing.

**Edge functions**
- `send-sms` — shared sender. Validates internal caller (same service-role check pattern as `send-transactional-email`), checks suppression + prefs, renders a localized template (en/fr/es, chosen from the recipient's stored locale), posts to the Twilio connector gateway `/Messages.json`, writes `sms_send_log`.
- `verify-phone` — JWT-verified; `start` sends a code, `confirm` validates it and stamps `phone_verified_at`.
- `twilio-inbound` — public webhook (`verify_jwt = false`) handling STOP / UNSTOP / HELP keywords into `sms_suppressions`.
- `notify-followers-of-event` and `send-event-reminders`: after the existing email step, call `send-sms` for recipients with a verified/opted-in number. Email failure and SMS failure are logged independently so one never blocks the other.
- New `notify-dm` / `notify-thread-reply` paths: database triggers on `direct_messages` and `discussion_replies` fire `net.http_post` to a `notify-conversation` function (same pattern as the existing `notify_followers_on_event_approved` trigger), which respects the recipient's prefs and sends email and/or SMS. DM texts are throttled to one per conversation per 10 minutes so a rapid back-and-forth doesn't spam.

**Frontend**
- `src/components/FollowButton.tsx` and `src/components/InterestedButton.tsx`: optional phone input + consent copy.
- New `src/components/calendar/NotificationSettings.tsx`, mounted in the organizer Dashboard, for number verification and the per-type Email/SMS matrix.
- All new strings added to the en/fr/es i18n files.

**Message copy** — short, one text each, localized, e.g.
`Sacred Heart Socials just posted: Youth Adoration Night, Fri Aug 21 7:00 PM EDT. thecatholiccalendar.org/e/abc  Reply STOP to opt out.`

## Notes

- Only verified numbers (for accounts) or explicitly opted-in numbers (for guest follows) ever receive a text.
- Existing email flows stay unchanged by default; SMS is purely additive until a user turns email off for a type.
