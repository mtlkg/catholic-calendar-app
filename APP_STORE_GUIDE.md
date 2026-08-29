# Shipping Catholic Calendar to the App Store & Google Play

This repo now wraps [thecatholiccalendar.org](https://thecatholiccalendar.org) in a
[Capacitor](https://capacitorjs.com) native shell, so the same React/Supabase app runs
as a real iOS and Android app — home screen icon, splash screen, and native push
notifications included.

What's already done, and what only you can finish (it needs your own Apple/Google/
Firebase accounts, a Mac, and real credentials I don't have access to) — laid out below
in the order you'd actually do it.

## What's already in the repo

- **Capacitor shell** — `capacitor.config.ts`, plus generated `ios/` and `android/`
  projects. App ID: `org.thecatholiccalendar.app`.
- **App icon & splash screen** — generated from `src/assets/logo.png` for every iOS/
  Android size (`assets/`, synced into both native projects).
- **Native push notifications** — full client + server wiring (device registration,
  Supabase table, FCM/APNs delivery in the `send-push` edge function). It just needs
  your Firebase project and Apple push key plugged in (Part 2 below).
- **Privacy Policy & Terms of Use pages** — live at `/catholic-calendar/privacy` and
  `/catholic-calendar/terms`, linked from the site footer. Both stores require the
  privacy URL before they'll accept a submission.
- **Android release signing** — `android/app/build.gradle` reads
  `android/key.properties` and signs `bundleRelease` automatically once you drop
  your upload keystore in (Part 4).
- **Store listing copy** — [`APP_STORE_LISTING.md`](./APP_STORE_LISTING.md) has
  ready-to-paste name/description/keywords and the App Privacy / Data Safety
  questionnaire answers for both consoles.
- **PWA manifest** — the *website* is now separately installable to a home screen
  straight from a browser, no app store needed, as a bonus.
- **CI** (`.github/workflows/mobile-build.yml`) — builds the web bundle, an Android
  debug APK, and an unsigned iOS build on every push, so breakage is caught early.
  It does not sign or publish anything.

## What I could not do here

This session runs in a sandboxed Linux container with no Mac (iOS builds require
Xcode, which only runs on macOS), no Apple/Google developer accounts, and no access to
your Firebase project. Concretely, I could generate and validate the *project files*
and write the listing copy, but not:

- Compile a final signed `.ipa` / `.aab`
- Create the App Store Connect / Google Play Console listings
- Set up your Firebase project or Apple push key
- Take real device/simulator screenshots for the store listings
- Submit anything for review

## Your next steps, in order

1. **Local setup** (Part 1) — clone, install, fill in `.env`, apply the new migration.
2. **Read the compliance note below** about in-app payments before you touch Xcode —
   it affects whether the iOS build is submittable as-is.
3. **Push notifications** (Part 2) — optional; skip and come back to it later if you'd
   rather ship without it first.
4. **iOS build & submit** (Part 3) — needs a Mac + Apple Developer account.
5. **Android build & submit** (Part 4) — needs a Google Play Console account, no Mac
   required.
6. **Future releases** (Part 5) — version bump checklist.

## ⚠️ Compliance note: in-app payments (read before submitting to Apple)

The app has a paid "Verified Organizer" subscription ($10/mo or $100/yr — see
`src/pages/calendar/AccountTypes.tsx`) and a paid event-promotion checkout
(`src/pages/calendar/SubmitEvent.tsx`), both currently built on **Stripe**. Apple's
App Store Review Guideline 3.1.1 requires **Apple's own In-App Purchase (StoreKit)**,
not an external processor like Stripe, for anything that unlocks digital
features/content *within* the app — which the Verified Organizer subscription is.

The good news: the subscription purchase flow (`/catholic-calendar/subscribe`) is
already disabled in the app's routing — `App.tsx` redirects it to the dashboard
("kept as redirect so links don't 404"). **Leave it that way for the iOS build.**
As long as nothing in the iOS app lets someone buy the digital subscription via
Stripe, this shouldn't trigger a 3.1.1 rejection. Paying to promote a real, external
event (the SubmitEvent checkout) is more likely to be treated as a real-world
service and is lower risk, but Apple's reviewers are inconsistent here — if they
flag it, the fix is either to gate that checkout out of the iOS build too, or to
implement it with StoreKit. Google Play has no equivalent restriction — Stripe is
fine there.

If you want the Verified Organizer subscription sellable *inside* the iOS app,
that requires implementing Apple In-App Purchase specifically for iOS (a real
scope of work — new StoreKit product IDs, receipt validation, reconciling it with
the existing Stripe-based entitlement system). Ask if you want that built.

---

## Part 1 — Local setup

```bash
git clone <this repo> && cd catholic-calendar-app
npm install
cp .env.example .env   # fill in real Supabase + Google Maps keys
npm run build
npx cap sync
```

Apply the new database migration (adds `push_device_tokens` for native push,
alongside the existing `push_subscriptions` used for web push):

```bash
supabase db push
# or paste supabase/migrations/20260828230000_native_push_tokens.sql
# into the Supabase SQL editor
```

## Part 2 — Push notifications

Android push runs on Firebase Cloud Messaging; iOS push talks to Apple's APNs
directly (no Firebase needed on the iOS side). Skip this part for now if you'd
rather ship without push first — everything else works without it, and you can
come back once the app is otherwise submitted.

### Android (Firebase)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
   (free).
2. Add an Android app with package name **`org.thecatholiccalendar.app`**.
3. Download `google-services.json` and put it at `android/app/google-services.json`
   (already gitignored — it's project-specific, don't commit it).
4. In Firebase Console → Project Settings → Service Accounts → **Generate new
   private key**. Download the JSON.
5. In your Supabase project → Edge Functions → Secrets, add:
   - `FCM_SERVICE_ACCOUNT_JSON` — paste the entire downloaded JSON file as one value.

### iOS (APNs)

1. In [developer.apple.com](https://developer.apple.com) → Certificates, Identifiers &
   Profiles → Keys, create a new key with **Apple Push Notifications service (APNs)**
   enabled. Download the `.p8` file (Apple only lets you download it once).
2. Note the **Key ID** (shown on the key's page) and your **Team ID** (top-right of the
   developer portal, or Membership page).
3. In Supabase → Edge Functions → Secrets, add:
   - `APNS_KEY_ID` — the Key ID from step 2
   - `APNS_TEAM_ID` — your Apple Team ID
   - `APNS_BUNDLE_ID` — `org.thecatholiccalendar.app`
   - `APNS_PRIVATE_KEY` — the full contents of the `.p8` file, including the
     `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines
   - `APNS_PRODUCTION` — `false` while testing with a development build (Xcode
     debug builds use Apple's sandbox APNs server), `true` once you're shipping
     TestFlight/App Store builds

Redeploy the `send-push` function after adding secrets:

```bash
supabase functions deploy send-push
```

---

## Part 3 — iOS: build & submit

You need a Mac with Xcode, and an [Apple Developer Program](https://developer.apple.com/programs/)
membership ($99/year). If you don't have a Mac, options include borrowing one, a
cloud Mac rental (MacStadium, Scaleway, etc.), or extending the CI workflow in this
repo with signing secrets to build + upload via `fastlane` on GitHub's macOS runners
— ask me to set that up if you want to go that route later.

1. `npx cap open ios` (or open `ios/App/App.xcodeproj` directly).
2. Select the **App** target → **Signing & Capabilities**:
   - Set your Team.
   - Confirm **Push Notifications** and **Background Modes → Remote notifications**
     are listed (they're already configured in the project; Xcode should just pick
     up your team and provisioning profile).
3. Bump the version if needed (`Marketing Version` / `Build`).
4. **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
5. In [App Store Connect](https://appstoreconnect.apple.com), create the app:
   - **My Apps → + → New App**, bundle ID `org.thecatholiccalendar.app`.
   - Name/subtitle/description/keywords — paste from
     [`APP_STORE_LISTING.md`](./APP_STORE_LISTING.md).
   - Screenshots: capture from the Simulator or a real device at the required sizes
     (currently 6.7" iPhone at minimum; add iPad screenshots if you want iPad
     support). The generated app icon/splash aren't a substitute for real
     in-app screenshots here.
   - **App Privacy** section: answers are in `APP_STORE_LISTING.md`.
   - **Privacy Policy URL**: `https://thecatholiccalendar.org/catholic-calendar/privacy`
   - **Age rating questionnaire**: see "Content rating" in `APP_STORE_LISTING.md` —
     unmoderated user content can push this to 17+.
   - Attach the uploaded build, submit for review.

## Part 4 — Android: build & submit

You need a [Google Play Console](https://play.google.com/console) account ($25
one-time). This part can be done from any OS, no Mac required.

1. Generate an upload key (once, keep it safe — losing it is a real problem):
   ```bash
   keytool -genkeypair -v -keystore upload-keystore.jks \
     -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy `android/key.properties.example` to `android/key.properties` (gitignored)
   and fill in the keystore path + passwords from step 1. `build.gradle` already
   reads this file and signs the release build automatically once it's present —
   nothing else to wire up.
3. Build the release bundle:
   ```bash
   cd android && ./gradlew bundleRelease
   # output: android/app/build/outputs/bundle/release/app-release.aab
   ```
4. In Play Console: **Create app**, then paste in the listing copy and Data
   Safety answers from [`APP_STORE_LISTING.md`](./APP_STORE_LISTING.md). Add
   screenshots (phone required, tablet optional), the content rating
   questionnaire, and the privacy policy URL:
   `https://thecatholiccalendar.org/catholic-calendar/privacy`.
5. Upload the `.aab` to an **Internal testing** track first, test it on a real
   device, then promote to **Production** when ready. First-time review can take
   a few days.

## Part 5 — Ongoing releases

Each new submission needs a version bump:

- **iOS**: `Marketing Version` (user-facing, e.g. `1.1`) and `Build` (must always
  increase) in Xcode, or directly in `ios/App/App.xcodeproj/project.pbxproj`
  (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`).
- **Android**: `versionName` / `versionCode` in `android/app/build.gradle`
  (`versionCode` must always increase).

After any change to the web app itself, remember to rebuild and re-sync before
opening Xcode/Android Studio:

```bash
npm run build && npx cap sync
```
