# Everything to paste into Lovable

The app now live-loads `https://thecatholiccalendar.org` (see `capacitor.config.ts`)
instead of bundling a copy of the code — publish on Lovable, the app updates
instantly, no rebuild. But the native features (push notifications, back
button, external links) and the Privacy/Terms pages the app stores require
only work once this code is actually live on that domain. This document is
everything needed to get there — paste the whole thing into a Lovable chat
and ask it to make these changes, or apply them by hand.

## 1. Install these npm packages

Tell Lovable: *"add these dependencies"* —

```
@capacitor/core
@capacitor/app
@capacitor/browser
@capacitor/preferences
@capacitor/push-notifications
```

## 2. New files — create exactly as-is

### `src/lib/nativePush.ts`

```ts
// Native push notifications for the Capacitor iOS/Android app. Mirrors
// src/lib/push.ts (web push): request permission, register a device token,
// hand it to Supabase, and route notification taps to the right page.
// Delivery on the server side is FCM for Android and direct APNs for iOS
// (see supabase/functions/send-push).

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { Preferences } from "@capacitor/preferences";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TOKEN_KEY = "native_push_token";

export function nativePushAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function currentNativeToken(): Promise<string | null> {
  if (!nativePushAvailable()) return null;
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value ?? null;
}

/** Requests permission (if needed), registers this device, and saves the token. */
export async function enableNativePush(locale = "en"): Promise<string | null> {
  if (!nativePushAvailable()) return null;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive !== "granted") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return null;

  const token = await new Promise<string | null>((resolve) => {
    const cleanup = async () => {
      (await regHandle).remove();
      (await errHandle).remove();
    };
    const regHandle = PushNotifications.addListener("registration", (t) => {
      cleanup();
      resolve(t.value);
    });
    const errHandle = PushNotifications.addListener("registrationError", (e) => {
      cleanup();
      console.error("native push registration error", e);
      resolve(null);
    });
    PushNotifications.register();
  });
  if (!token) return null;

  const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
  const { error } = await (supabase as any).rpc("save_native_push_token", {
    _token: token,
    _platform: platform,
    _locale: locale.slice(0, 2),
  });
  if (error) throw new Error(error.message);

  await Preferences.set({ key: TOKEN_KEY, value: token });
  return token;
}

/** Unregisters this device and removes the stored token. */
export async function disableNativePush(): Promise<void> {
  if (!nativePushAvailable()) return;
  const token = await currentNativeToken();
  if (token) {
    await (supabase as any).rpc("delete_native_push_token", { _token: token });
  }
  await Preferences.remove({ key: TOKEN_KEY });
}

// --- Notification-tap navigation -------------------------------------------
//
// Listeners are attached once at module load (see main.tsx) so a tap that
// launches the app from cold isn't missed. The router isn't mounted yet at
// that point, so the target URL is buffered until a navigator is attached.

let navigate: ((path: string) => void) | null = null;
let pendingPath: string | null = null;

function toRelativePath(url: string): string {
  try {
    return new URL(url, "https://thecatholiccalendar.org").pathname;
  } catch {
    return url.startsWith("/") ? url : `/${url}`;
  }
}

function openPath(path: string) {
  if (navigate) navigate(path);
  else pendingPath = path;
}

/** Called once by the router-aware part of the app once it can navigate. */
export function setNativePushNavigator(fn: (path: string) => void) {
  navigate = fn;
  if (pendingPath) {
    const path = pendingPath;
    pendingPath = null;
    fn(path);
  }
}

/** Call once, as early as possible (module scope in main.tsx). */
export function initNativePushListeners() {
  if (!nativePushAvailable()) return;

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const url = action.notification?.data?.url;
    if (typeof url === "string" && url) openPath(toRelativePath(url));
  });

  // The OS doesn't show a banner for a push that arrives while the app is
  // already open in the foreground — surface it as a toast instead.
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const url = notification.data?.url;
    toast(notification.title ?? "The Catholic Calendar", {
      description: notification.body,
      action: typeof url === "string" && url
        ? { label: "Open", onClick: () => openPath(toRelativePath(url)) }
        : undefined,
    });
  });
}
```

### `src/components/NativeAppBridge.tsx`

```tsx
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { setNativePushNavigator } from "@/lib/nativePush";

/** Links to other sites (organizer websites, maps, videos…) should open in
 *  the system browser inside the native app, not navigate the app's WebView. */
function installExternalLinkHandler() {
  document.addEventListener("click", (e) => {
    const anchor = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    const url = anchor.href;
    if (!url.startsWith("http")) return;
    if (url.startsWith(window.location.origin)) return;
    e.preventDefault();
    Browser.open({ url });
  });
}

/**
 * Wires the native shell into the router: routes notification taps to the
 * right page, and makes Android's hardware back button behave like a
 * browser back button instead of the OS default (which would just close
 * the whole app from any screen).
 */
export default function NativeAppBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setNativePushNavigator((path) => navigate(path));
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    installExternalLinkHandler();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapacitorApp.addListener("backButton", () => {
      if (window.history.length > 1 && location.pathname !== "/catholic-calendar") {
        window.history.back();
      } else {
        CapacitorApp.exitApp();
      }
    });
    return () => {
      sub.then((s) => s.remove());
    };
  }, [location.pathname]);

  return null;
}
```

### `src/pages/calendar/Privacy.tsx`

Both app stores require a public privacy policy URL before they'll accept a
submission. This needs to be live at
`https://thecatholiccalendar.org/catholic-calendar/privacy` — adjust the
wording if your data practices differ from what's described (email/location/
messages/Stripe payments/push tokens/optional SMS).

```tsx
import { Helmet } from "react-helmet-async";
import CalendarLayout from "./CalendarLayout";

const UPDATED = "August 29, 2026";
const CONTACT_EMAIL = "globalcatholiccalendar@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl text-charcoal mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-charcoal/80">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <CalendarLayout>
      <Helmet>
        <title>Privacy Policy | The Catholic Calendar</title>
        <meta
          name="description"
          content="How The Catholic Calendar collects, uses, and protects your information."
        />
      </Helmet>

      <div className="max-w-3xl mx-auto px-5 py-14 sm:py-20">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-charcoal/60 mb-10">Last updated: {UPDATED}</p>

        <Section title="Overview">
          <p>
            The Catholic Calendar ("we", "us") operates thecatholiccalendar.org and its
            companion iOS and Android apps (together, the "Service"). This policy explains
            what information we collect, why, and the choices you have. We built the
            Service to help people find and share Catholic events, and we try to collect
            no more than that requires.
          </p>
        </Section>

        <Section title="Information we collect">
          <p><strong className="text-charcoal">Account information.</strong> If you create
            an account, we collect your email address (via Supabase Authentication) and any
            profile details you choose to add, such as an organizer name, bio, or profile
            photo.</p>
          <p><strong className="text-charcoal">Location.</strong> If you allow it, we use
            your device's approximate location — or a diocese/city you select manually — to
            show events near you. You can decline this and browse by diocese instead.</p>
          <p><strong className="text-charcoal">Content you submit.</strong> Events you post,
            RSVPs and "interested" marks, follows, and messages you send through the
            calendar's discussion threads or direct messages are stored so we can display
            them to the people they're intended for.</p>
          <p><strong className="text-charcoal">Payment information.</strong> If you purchase
            tickets, merchandise, or a subscription, payment is processed by Stripe. We
            receive and store order/ticket records (what was purchased, amount, status) but
            never your full card number — Stripe handles that directly.</p>
          <p><strong className="text-charcoal">Push notifications.</strong> If you enable
            notifications, we store a device token or web push subscription (an opaque
            identifier, not readable by us) so we can deliver the notifications you've opted
            into — new events from organizers you follow, event reminders, and messages.</p>
          <p><strong className="text-charcoal">Phone number.</strong> Only if you opt into
            SMS notifications, we store your phone number to send and verify that
            subscription. This is optional and separate from push notifications.</p>
          <p><strong className="text-charcoal">Usage data.</strong> Like most web services,
            our infrastructure providers log basic technical data (IP address, device/browser
            type, pages visited) for security and reliability. We don't use third-party
            advertising trackers.</p>
        </Section>

        <Section title="How we use this information">
          <ul className="list-disc pl-5 space-y-1">
            <li>To show you relevant events, near you or from organizers you follow</li>
            <li>To let you post events, message other users, and manage your organizer profile</li>
            <li>To send the notifications and emails you've opted into, and process transactions</li>
            <li>To keep the Service secure and prevent abuse</li>
          </ul>
          <p>We do not sell your personal information.</p>
        </Section>

        <Section title="Who we share it with">
          <p>We share information only with the service providers that run the Service on
            our behalf, and only what each needs to do its job:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-charcoal">Supabase</strong> — database, authentication, and file storage</li>
            <li><strong className="text-charcoal">Stripe</strong> — payment processing for tickets, merchandise, and subscriptions</li>
            <li><strong className="text-charcoal">Google Maps</strong> — location search and address autocomplete</li>
            <li><strong className="text-charcoal">Firebase Cloud Messaging</strong> — delivering push notifications on Android</li>
            <li><strong className="text-charcoal">Apple Push Notification service</strong> — delivering push notifications on iOS</li>
            <li>Our email delivery provider — sending account and notification emails</li>
          </ul>
          <p>Other organizers can see your organizer profile, the events you post, and messages
            you send them directly — that's the point of the feature. We don't share your
            information with unrelated third parties or advertisers.</p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc pl-5 space-y-1">
            <li>Edit or delete your profile, and delete events you've posted, from your dashboard</li>
            <li>Turn off push, email, or SMS notifications at any time in Notification Settings</li>
            <li>Deny or revoke location permission in your browser or device settings — the calendar still works, browsed by diocese</li>
            <li>Request deletion of your account and associated data by emailing us (below)</li>
          </ul>
        </Section>

        <Section title="Data retention">
          <p>We keep your information for as long as your account is active, or as needed to
            provide the Service (for example, order records are kept as required for
            accounting and dispute handling). If you delete your account, we delete or
            anonymize personal data within a reasonable time, except where we're required to
            keep records for legal or tax purposes.</p>
        </Section>

        <Section title="Children">
          <p>The Service is not directed at children under 13, and we do not knowingly
            collect personal information from them.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>If we make material changes to this policy, we'll update the date above and,
            where appropriate, let you know in the app.</p>
        </Section>

        <Section title="Contact us">
          <p>
            Questions, or want your data deleted? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-crimson underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </Section>
      </div>
    </CalendarLayout>
  );
}
```

### `src/pages/calendar/Terms.tsx`

```tsx
import { Helmet } from "react-helmet-async";
import CalendarLayout from "./CalendarLayout";

const UPDATED = "August 29, 2026";
const CONTACT_EMAIL = "globalcatholiccalendar@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl text-charcoal mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-charcoal/80">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <CalendarLayout>
      <Helmet>
        <title>Terms of Use | The Catholic Calendar</title>
        <meta name="description" content="The terms that govern your use of The Catholic Calendar." />
      </Helmet>

      <div className="max-w-3xl mx-auto px-5 py-14 sm:py-20">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal mb-2">
          Terms of Use
        </h1>
        <p className="text-sm text-charcoal/60 mb-10">Last updated: {UPDATED}</p>

        <Section title="Using the Service">
          <p>The Catholic Calendar helps you discover and share Catholic events, feast
            days, and parish activities. By using our website or apps, you agree to these
            terms. If you don't agree, please don't use the Service.</p>
        </Section>

        <Section title="Accounts">
          <p>You're responsible for the accuracy of the information you provide and for
            keeping your account secure. You must be at least 13 years old to create an
            account.</p>
        </Section>

        <Section title="Content you submit">
          <p>You're responsible for the events, messages, and other content you post. Don't
            post anything false, unlawful, or infringing on someone else's rights. We may
            remove content or suspend accounts that violate these terms or that we
            reasonably believe are harmful to the community.</p>
          <p>By posting content, you grant us a license to display it as part of the
            Service — for example, showing your event to people searching the calendar.
            You keep ownership of what you post.</p>
        </Section>

        <Section title="Purchases">
          <p>Some features — event promotion, tickets, merchandise, or an organizer
            subscription — involve payment, processed by Stripe. Prices and what's included
            are shown before you pay. Purchases are generally non-refundable except where
            required by law or stated otherwise at checkout.</p>
        </Section>

        <Section title="Disclaimer">
          <p>The Catholic Calendar is an independent, community-driven listing. We don't
            control or vouch for the accuracy of events submitted by organizers, and we
            aren't affiliated with any diocese, parish, or the Catholic Church's official
            structures unless explicitly stated. The Service is provided "as is," without
            warranties of any kind.</p>
        </Section>

        <Section title="Changes">
          <p>We may update these terms from time to time; we'll update the date above when
            we do. Continuing to use the Service after a change means you accept the
            updated terms.</p>
        </Section>

        <Section title="Contact us">
          <p>
            Questions about these terms? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-crimson underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </Section>
      </div>
    </CalendarLayout>
  );
}
```

## 3. Replace this file's contents

### `src/lib/push.ts`

This is the existing web-push module — replacing it makes the same
enable/disable/status functions transparently use native push when running
in the app, with zero changes needed to the notification settings UI. If
you've customized this file since your export, merge these changes in rather
than blindly overwriting.

```ts
import { supabase } from "@/integrations/supabase/client";
import {
  currentNativeToken,
  disableNativePush,
  enableNativePush,
  nativePushAvailable,
} from "@/lib/nativePush";

/** Public VAPID key (safe to ship in the browser). */
const VAPID_PUBLIC_KEY =
  "BKcsmNLXdSaOGKIGBZ9R7sPfXrJQKdN8fYBLGIVXgc42iz5nnvyH2urS92weJG1aQCgJY9VO_iFYeUKLneoz59o";

const SW_URL = "/push-sw.js";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** True when this browser can receive web push notifications. */
function webPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** True when this device can receive push notifications — native app or web push. */
export function pushSupported(): boolean {
  return nativePushAvailable() || webPushSupported();
}

/** True on iOS Safari when the site has not been added to the home screen. */
export function needsHomeScreenInstall(): boolean {
  if (typeof window === "undefined" || nativePushAvailable()) return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as any).standalone === true;
  return isIOS && !standalone && !webPushSupported();
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (nativePushAvailable()) return "default";
  return webPushSupported() ? Notification.permission : "unsupported";
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

/** Returns the endpoint/token of the existing subscription on this device, if any. */
export async function currentPushEndpoint(): Promise<string | null> {
  if (nativePushAvailable()) return currentNativeToken();
  if (!webPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const sub = await reg?.pushManager.getSubscription();
    return sub?.endpoint ?? null;
  } catch {
    return null;
  }
}

/**
 * Asks for permission (if needed), subscribes this device and stores the
 * subscription server-side. Returns the endpoint/token, or null when declined.
 */
export async function enablePush(locale = "en"): Promise<string | null> {
  if (nativePushAvailable()) return enableNativePush(locale);
  if (!webPushSupported()) return null;

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") return null;

  const reg = await getRegistration();
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));

  const { error } = await (supabase as any).rpc("save_push_subscription", {
    _endpoint: sub.endpoint,
    _p256dh: bufToB64url(sub.getKey("p256dh")),
    _auth: bufToB64url(sub.getKey("auth")),
    _locale: locale.slice(0, 2),
  });
  if (error) throw new Error(error.message);

  return sub.endpoint;
}

/** Unsubscribes this device and removes the stored subscription. */
export async function disablePush(): Promise<void> {
  if (nativePushAvailable()) return disableNativePush();
  if (!webPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await (supabase as any).rpc("delete_push_subscription", { _endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}
```

## 4. Small edits to existing files

These add a couple of lines each — safer as targeted edits than full-file
replacement, since your live version may have diverged from this repo's copy
in ways unrelated to this change.

**`src/main.tsx`** — add the import and the one call, near the top:
```tsx
import { initNativePushListeners } from "./lib/nativePush";

// Attach as early as possible so a notification tap that cold-launches the
// app isn't missed while the router is still mounting.
initNativePushListeners();
```

**`src/App.tsx`** — add the import:
```tsx
import NativeAppBridge from "./components/NativeAppBridge";
```
and render it once, inside `<BrowserRouter>`, alongside `<ScrollToTop />`:
```tsx
<BrowserRouter>
  <ScrollToTop />
  <NativeAppBridge />
  {/* ...existing routes... */}
```
Also add routes for the two new pages, wherever the other `/catholic-calendar/...`
routes are:
```tsx
<Route path="/catholic-calendar/privacy" element={<Privacy />} />
<Route path="/catholic-calendar/terms" element={<Terms />} />
```
with the matching imports at the top:
```tsx
import Privacy from "./pages/calendar/Privacy.tsx";
import Terms from "./pages/calendar/Terms.tsx";
```

**Footer** (wherever your site's footer/nav links live — in this repo that's
`src/pages/calendar/CalendarLayout.tsx`) — add links to the new pages so
they're actually reachable, not just live at their URL:
```tsx
<Link
  to="/catholic-calendar/privacy"
  className="text-ivory/80 hover:text-gold transition-colors"
>
  Privacy
</Link>
<Link
  to="/catholic-calendar/terms"
  className="text-ivory/80 hover:text-gold transition-colors"
>
  Terms
</Link>
```
(Adjust the className to match your own footer's link styling if it differs.)

**`src/index.css`** (optional but recommended) — inside the `body` rule, pad
content away from the notch/home indicator on the native app; a no-op on the
web:
```css
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);
padding-bottom: env(safe-area-inset-bottom);
```

**`index.html`** (optional but recommended) — add `viewport-fit=cover` to
the existing viewport meta tag:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

## 5. Supabase side (not Lovable frontend code)

Independent of the above — needed regardless of the live-load decision:

- Run the migration `supabase/migrations/20260828230000_native_push_tokens.sql`
  (adds the `push_device_tokens` table + save/delete RPCs).
- Deploy the updated `supabase/functions/send-push/index.ts`, plus the two
  files it imports — `supabase/functions/_shared/fcm.ts` and
  `supabase/functions/_shared/apns.ts` — so push delivery reaches native
  devices, not just web subscribers.
- Add the Firebase/APNs secrets described in `APP_STORE_GUIDE.md` Part 2.

If Lovable manages your Supabase connection, ask it to apply the migration
and redeploy the edge function; otherwise use the Supabase CLI or dashboard
directly. Ask if you'd like the contents of those three function files
pasted here too, the same way as above.

## 6. One thing to know about App Store review

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
