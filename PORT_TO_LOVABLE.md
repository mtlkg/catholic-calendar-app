# Porting the native bridge back into your Lovable project

The app now points at `https://thecatholiccalendar.org` directly (see
`capacitor.config.ts` → `server.url`), instead of bundling a copy of the site
inside the app. That means: **whatever you publish on Lovable is what the app
shows, immediately, with no rebuild.** That's the whole point.

The trade-off: the app's native shell (push notifications, Android back
button, external links opening in the system browser) only works if the code
that talks to those native plugins is actually running on the live site —
because the live site *is* what the app displays. Right now that code exists
only in this repo, not on thecatholiccalendar.org. This doc is exactly what
to add to your Lovable project to close that gap. You can paste this whole
file to Lovable's AI and ask it to make these changes, or apply them by hand.

Everything referenced below is already written and pushed to this repo
(`mtlkg/catholic-calendar-app`, branch `claude/catholic-calendar-app-store-oclqbl`)
— you can open any path on GitHub to copy the full file.

## 1. Add these npm packages to the Lovable project

```
@capacitor/core
@capacitor/app
@capacitor/browser
@capacitor/preferences
@capacitor/push-notifications
```

(`@capacitor/splash-screen` and `@capacitor/status-bar` are **not** needed
here — those are configured purely on the native side and nothing in the web
code calls them.)

## 2. Add two new files, unchanged

Copy these two files from this repo exactly as-is:

- **`src/lib/nativePush.ts`** — registers the device for push, saves the
  token to Supabase, and routes notification taps to the right page.
- **`src/components/NativeAppBridge.tsx`** — wires notification navigation
  into the router, makes Android's back button behave correctly, and opens
  external links (organizer sites, maps, videos) in the system browser
  instead of the app's WebView.

Both already check `Capacitor.isNativePlatform()` internally, so they're
inert no-ops when someone visits thecatholiccalendar.org in an ordinary
browser — safe to ship to everyone, not just app users.

## 3. Small edits to existing files

**`src/lib/push.ts`** — the existing web-push functions (`pushSupported`,
`enablePush`, `disablePush`, etc.) now delegate to `nativePush.ts` when
running inside the app, so the notification settings UI needs zero changes.
See this repo's version of the file for the exact diff — it's a handful of
`if (nativePushAvailable()) return ...` branches added to each function.

**`src/App.tsx`** — import and render the bridge component once, inside
`<BrowserRouter>`:
```tsx
import NativeAppBridge from "./components/NativeAppBridge";
// ...
<BrowserRouter>
  <ScrollToTop />
  <NativeAppBridge />
  {/* ...existing routes... */}
```

**`src/main.tsx`** — attach the push-notification listeners as early as
possible, before the app renders:
```tsx
import { initNativePushListeners } from "./lib/nativePush";
initNativePushListeners();
```

**`src/index.css`** (optional but recommended) — pad content away from the
notch/home indicator on the native app; a no-op on the web:
```css
body {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
}
```

**`index.html`** (optional but recommended) — add `viewport-fit=cover` to
the existing viewport meta tag so the safe-area CSS above actually has
something to read:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

## 4. Supabase side (independent of Lovable's frontend)

These aren't Lovable frontend code — they're database/edge-function changes
against your Supabase project, needed regardless of the live-load decision:

- Run the migration `supabase/migrations/20260828230000_native_push_tokens.sql`
  (adds the `push_device_tokens` table + save/delete RPCs).
- Deploy the updated `supabase/functions/send-push/index.ts`, plus the two
  new files it imports — `supabase/functions/_shared/fcm.ts` and
  `supabase/functions/_shared/apns.ts` — so push delivery reaches native
  devices, not just web subscribers.
- Add the Firebase/APNs secrets described in `APP_STORE_GUIDE.md` Part 2.

If Lovable manages your Supabase connection, ask it to apply the migration
and redeploy the edge function; otherwise use the Supabase CLI or dashboard
directly.

## 5. One thing to know about App Store review

Apple's Guideline 4.2 (Minimum Functionality) can flag apps that are "just a
website in a wrapper." Loading `thecatholiccalendar.org` directly, rather
than a bundled copy, leans further into that shape. The native push
notifications, home screen icon/splash, and back-button handling above are
what make this a real native app rather than a bare wrapper — worth having
all of them actually live before you submit, not just the parts that are
convenient. If Apple pushes back anyway, the fallback is switching
`capacitor.config.ts` back to bundled mode (drop the `server.url` block,
`npm run build && npx cap sync`) for the iOS build specifically, while
keeping live-load for Android if you want.

## After you've made these changes on Lovable

Nothing to rebuild for content updates going forward — that's the point.
You only need `npm run build && npx cap sync` again in *this* repo when you
change something native-side: icons, splash, permissions, plugins, or this
config file itself.
