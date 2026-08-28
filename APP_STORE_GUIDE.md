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
- **PWA manifest** — the *website* is now separately installable to a home screen
  straight from a browser, no app store needed, as a bonus.
- **CI** (`.github/workflows/mobile-build.yml`) — builds the web bundle, an Android
  debug APK, and an unsigned iOS build on every push, so breakage is caught early.
  It does not sign or publish anything.

## What I could not do here

This session runs in a sandboxed Linux container with no Mac (iOS builds require
Xcode, which only runs on macOS), no Apple/Google developer accounts, and no access to
your Firebase project. Concretely, I could generate and validate the *project files*,
but not:

- Compile a final signed `.ipa` / `.aab`
- Create the App Store Connect / Google Play Console listings
- Set up your Firebase project or Apple push key
- Submit anything for review

Everything below is what's left, in order.

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
   - Fill in name, description, category, keywords.
   - Screenshots: capture from the Simulator or a real device at the required sizes
     (currently 6.7" iPhone at minimum; add iPad screenshots if you want iPad
     support). The generated app icon/splash aren't a substitute for real
     in-app screenshots here.
   - **App Privacy** section: declare what's collected — this app collects
     location (event search), email (accounts), and user content (messages,
     event submissions), so answer accordingly.
   - **Privacy Policy URL** — required. See Part 5 below; you don't have one yet.
   - Attach the uploaded build, submit for review.

## Part 4 — Android: build & submit

You need a [Google Play Console](https://play.google.com/console) account ($25
one-time). This part can be done from any OS, no Mac required.

1. Generate an upload key (once, keep it safe — losing it is a real problem):
   ```bash
   keytool -genkeypair -v -keystore upload-keystore.jks \
     -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Reference it from `android/key.properties` (gitignored — don't commit it):
   ```properties
   storeFile=/absolute/path/to/upload-keystore.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```
   and wire that into `android/app/build.gradle`'s `signingConfigs` /
   `buildTypes.release` — the standard Capacitor/Android release-signing snippet,
   documented at [developer.android.com/studio/publish/app-signing](https://developer.android.com/studio/publish/app-signing).
3. Build the release bundle:
   ```bash
   cd android && ./gradlew bundleRelease
   # output: android/app/build/outputs/bundle/release/app-release.aab
   ```
4. In Play Console: **Create app**, fill in the store listing, screenshots (phone
   screenshots required, tablet optional), content rating questionnaire, **Data
   safety** form (same data categories as the iOS privacy section above), and a
   **Privacy Policy URL**.
5. Upload the `.aab` to an **Internal testing** track first, test it on a real
   device, then promote to **Production** when ready. First-time review can take
   a few days.

## Part 5 — Privacy policy (needed for both stores)

I didn't find an existing privacy policy page on thecatholiccalendar.org — both
app stores require a **public URL** to one before they'll accept the app,
since it handles accounts, location, and user-submitted content. You'll need to
either add a `/privacy` page to the site or host one elsewhere (e.g. a simple
page describing what data is collected — email, location, event/message
content — and how it's used/stored via Supabase). Happy to draft one if you tell
me what to say about data retention and any third parties (Stripe, Google Maps,
etc.) it should disclose.

## Part 6 — Ongoing releases

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
