# Store listing copy

Ready-to-paste text for App Store Connect and Google Play Console, written to fit
each field's character limit (counts noted so you can swap in your own wording
without guessing). Screenshots still need to come from a real build — see
`APP_STORE_GUIDE.md`.

## Name & short copy

| Field | Text | Limit |
|---|---|---|
| App name (both stores) | The Catholic Calendar | 30 |
| Subtitle (App Store) | Catholic Events Near You | 30 |
| Short description (Play) | Find Catholic Masses, feast days & parish events near you. | 80 |
| Promotional text (App Store, editable anytime) | Discover Catholic events near you — Masses, feast days, retreats, and parish activities — and connect with organizers in your diocese. | 170 |

## Full description (App Store & Play — both allow 4000 characters)

```
The Catholic Calendar is a unified platform that brings Catholic organizers
together across dioceses — parishes, ministries, movements, and local leaders —
to share events and grow the Church's presence in your community.

FIND WHAT'S HAPPENING NEAR YOU
Browse Masses, feast days, retreats, conferences, and parish activities by
diocese or city, or search near your current location.

FOLLOW YOUR PARISH AND FAVORITE ORGANIZERS
Follow organizers you care about and get notified the moment they post a new
event — no more missing announcements buried in a bulletin or Facebook group.

SUBMIT AND PROMOTE YOUR OWN EVENTS
Organizers can submit events in minutes, reach people actively looking for
things to do, and message attendees directly.

STAY IN THE LOOP
Turn on notifications for event reminders, replies to your messages, and new
posts from organizers you follow — or turn any of it off, any time.

MULTILINGUAL
Available in English, French, and Spanish.

The Catholic Calendar is an independent, community-run project — not an
official publication of any diocese or parish, but built to serve them.

Questions or feedback? Email globalcatholiccalendar@gmail.com.
```

(≈1,170 characters — well under the 4,000 limit, so there's room to add
diocese-specific or seasonal copy later without a rewrite.)

## Keywords (App Store, 100 characters, comma-separated)

```
catholic,mass,church,parish,feast day,retreat,rosary,diocese,liturgical calendar,events,faith
```

## Categories

- **App Store**: Primary — *Lifestyle*. Secondary — *Reference* or *Social Networking*
  (the messaging/follow features fit Social Networking; pick whichever you'd rather
  be discovered under).
- **Google Play**: *Lifestyle* (Play doesn't have a dedicated "Events" category;
  some events apps also list under *Events*, which may be available depending on
  your console — check what's offered when you fill out the form).

## URLs

- **Support URL**: `https://thecatholiccalendar.org/catholic-calendar/about` (or a
  dedicated support/contact page if you'd rather not point to About)
- **Marketing URL** (optional, App Store): `https://thecatholiccalendar.org`
- **Privacy Policy URL** (required, both stores): `https://thecatholiccalendar.org/catholic-calendar/privacy`

## App Store Connect — App Privacy questionnaire

Apple asks you to declare data types and whether each is linked to identity /
used for tracking. Based on what the app actually collects (see the shipped
privacy policy for full detail):

| Data type | Collected? | Linked to user? | Used for tracking? |
|---|---|---|---|
| Email address | Yes | Yes | No |
| Name | Yes (optional profile field) | Yes | No |
| Phone number | Yes, only if SMS notifications are enabled | Yes | No |
| Precise location | Yes, only if the user grants it | Yes | No |
| Coarse location | Yes (diocese/city selection) | Yes | No |
| User content (messages, event posts) | Yes | Yes | No |
| Purchase history | Yes (tickets/merchandise/subscription orders via Stripe) | Yes | No |
| Device ID / push token | Yes (to deliver notifications) | Yes | No |
| Identifiers used for advertising | No | — | — |

Answer "No" to tracking for all rows — this app doesn't use third-party
advertising or analytics SDKs that track users across other apps/websites.

## Google Play Console — Data safety form

Same underlying answers, in Play's categories:

- **Location** — collected (approximate & precise), user-initiated, not shared
  with third parties for advertising. Optional, used to show nearby events.
- **Personal info** (email, name, phone) — collected, required for email/name
  (account creation), optional for phone (SMS opt-in).
- **Messages** (in-app messages) — collected, required for the messaging feature.
- **Financial info** (purchase history) — collected via Stripe for
  tickets/merchandise/subscriptions.
- **App activity** — not collected beyond what's listed above.
- **Device or other IDs** — collected (push notification token).
- Data is encrypted in transit (Supabase/Stripe both use TLS).
- Users can request deletion — point Play's "data deletion" field at the same
  privacy policy URL, or provide a dedicated in-app deletion request flow if
  you build one later.

## Content rating

Both stores ask a content questionnaire. The one answer worth flagging before
you fill it out: this app has **unmoderated user-to-user messaging and posts**
(direct messages, discussion threads, event submissions). Answer that honestly
— Apple in particular can require a 17+ rating for apps with unrestricted
user-generated content unless you have moderation/reporting/blocking in place.
If you'd rather target a lower age rating, consider adding a report/block
feature before submission; happy to help build that if you want to go that
route.
