# Quiet down conversation emails

Today every direct message and every thread reply can trigger its own email (DMs have only a 10-minute throttle, thread replies have none). During an active back-and-forth that means an inbox full of near-identical notices. The fix: batch and suppress instead of firing per message.

## New behaviour

**1. One email per conversation per cooldown, not per message**
- Direct messages: at most one email per sender→recipient conversation per 60 minutes.
- Thread replies: at most one email per thread per recipient per 60 minutes.
- The email says "You have N new messages in this conversation" / "N new replies on your thread" with the latest excerpt, instead of one email per line of chat.

**2. Skip the email when you've already seen it**
- If the recipient has read the conversation (DM read state / thread visit) after the message arrived, no email goes out at all — this alone removes most of the noise for people actively chatting in the app.

**3. Push stays instant**
- Web push is free and non-intrusive, so it keeps firing per message. Email becomes the "you missed something" channel only.

**4. User control in Notification Settings**
Each of "Direct messages" and "Thread replies" gets a frequency choice instead of a plain on/off:
- Instant (current behaviour, still cooldown-protected)
- Hourly summary (default) — one email per conversation per hour
- Daily summary — one email per day covering all missed conversations
- Off

## Technical notes

- New table `public.notification_digest_state` (`user_id`, `channel` = `dm:<peer_id>` / `thread:<thread_id>`, `last_emailed_at`, `pending_count`, `last_excerpt`, `last_sender_name`, `updated_at`) with RLS limiting rows to the owner plus service-role grants.
- New columns on `notification_prefs`: `email_dm_frequency` and `email_thread_reply_frequency` (text, default `hourly`), keeping the existing booleans as the on/off master switch.
- `notify-conversation` edge function rewritten to:
  1. resolve recipient + read state (`dm_conversation_state.last_read_at` for DMs, a new `thread_reads` row or the recipient's own last reply for threads),
  2. bail out if already read,
  3. increment `pending_count` on the digest row,
  4. send only if `last_emailed_at` is older than the frequency window; otherwise leave it pending,
  5. always attempt push as it does now.
- New scheduled edge function `send-conversation-digests` (pg_cron, hourly) that flushes rows with `pending_count > 0` whose window has elapsed — this is what delivers daily summaries and any hourly batch that had no later message to trigger it.
- `conversation-notification` email template extended to render a count ("3 new messages") and a multi-conversation daily summary variant; strings localized EN/FR/ES.
- `NotificationSettings.tsx` gains the frequency selects with localized labels.

Existing users default to hourly summaries, so nobody has to change settings to stop the flood.
