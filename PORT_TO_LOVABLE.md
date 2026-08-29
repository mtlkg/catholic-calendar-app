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

Independent of the frontend changes above — this needs to happen regardless
of the live-load decision, and it's not something Lovable's project export
touches. Two things: apply a migration, and deploy an edge function. Both
against your actual Supabase project.

### Migration — adds the native device token table

Run this against your Supabase project (SQL editor, or `supabase db push`
with this file at `supabase/migrations/20260828230000_native_push_tokens.sql`):

```sql
-- Device tokens for the native iOS/Android app (Capacitor push notifications),
-- parallel to public.push_subscriptions which holds web push subscriptions.
CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  token text NOT NULL UNIQUE,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_device_tokens TO service_role;
ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user ON public.push_device_tokens(user_id);

CREATE OR REPLACE FUNCTION public.save_native_push_token(
  _token text, _platform text, _locale text DEFAULT 'en'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _token IS NULL OR _token = '' OR _platform NOT IN ('ios', 'android') THEN
    RAISE EXCEPTION 'invalid device token';
  END IF;
  INSERT INTO public.push_device_tokens (user_id, platform, token, locale)
  VALUES (auth.uid(), _platform, _token, COALESCE(NULLIF(_locale,''),'en'))
  ON CONFLICT (token) DO UPDATE SET
    user_id = COALESCE(auth.uid(), public.push_device_tokens.user_id),
    platform = EXCLUDED.platform,
    locale = EXCLUDED.locale,
    last_seen_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_native_push_token(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_device_tokens WHERE token = _token;
$$;

REVOKE ALL ON FUNCTION public.save_native_push_token(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_native_push_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_native_push_token(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_native_push_token(text) TO anon, authenticated, service_role;
```

### `supabase/functions/send-push/index.ts` — replace with this

```ts
// Shared web push sender. Internal-only: callable by the service role (other
// edge functions / database triggers). Looks up the target subscriptions,
// renders localized copy, encrypts and delivers each message, and prunes
// subscriptions the push service reports as gone.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { normalizeLocale, renderPush, type PushTemplate } from "../_shared/push-templates.ts";
import { sendWebPush } from "../_shared/webpush.ts";
import { loadServiceAccount, sendFcm } from "../_shared/fcm.ts";
import { loadApnsConfig, sendApns } from "../_shared/apns.ts";

function isInternalCaller(req: Request): boolean {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceKey && token === serviceKey) return true;
  try {
    const [, payload] = token.split(".");
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") +
      "==".slice(0, (4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(b64)).role === "service_role";
  } catch {
    return false;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!isInternalCaller(req)) return json({ error: "forbidden" }, 403);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const template = String(payload?.templateName ?? "") as PushTemplate;
  const locale = normalizeLocale(payload?.locale);
  const data = (payload?.templateData ?? {}) as Record<string, string>;
  const url = String(payload?.url ?? "https://thecatholiccalendar.org/catholic-calendar");
  const userId: string | null = payload?.userId ?? null;
  const endpoints: string[] = Array.isArray(payload?.endpoints) ? payload.endpoints : [];

  const deviceTokens: string[] = Array.isArray(payload?.deviceTokens) ? payload.deviceTokens : [];

  if (!template) return json({ error: "templateName required" }, 400);
  if (!userId && endpoints.length === 0 && deviceTokens.length === 0) {
    return json({ ok: true, skipped: "no_target" });
  }

  const privateJwkRaw = Deno.env.get("VAPID_PRIVATE_JWK");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:globalcatholiccalendar@gmail.com";
  const privateJwk = privateJwkRaw ? (JSON.parse(privateJwkRaw) as JsonWebKey) : null;
  const webPushReady = !!(privateJwk && publicKey);

  const fcmServiceAccount = loadServiceAccount();
  const apnsConfig = loadApnsConfig();
  if (!webPushReady && !fcmServiceAccount && !apnsConfig) {
    console.error("send-push: no push provider is configured (web, FCM, or APNs)");
    return json({ error: "push not configured" }, 503);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const subs = new Map<string, { endpoint: string; p256dh: string; auth: string; locale: string }>();
  if (userId) {
    const { data: rows } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, locale")
      .eq("user_id", userId);
    for (const r of rows ?? []) subs.set((r as any).endpoint, r as any);
  }
  if (endpoints.length > 0) {
    const { data: rows } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, locale")
      .in("endpoint", endpoints);
    for (const r of rows ?? []) subs.set((r as any).endpoint, r as any);
  }

  const devices = new Map<string, { token: string; platform: "ios" | "android"; locale: string }>();
  if (userId) {
    const { data: rows } = await supabase
      .from("push_device_tokens")
      .select("token, platform, locale")
      .eq("user_id", userId);
    for (const r of rows ?? []) devices.set((r as any).token, r as any);
  }
  if (deviceTokens.length > 0) {
    const { data: rows } = await supabase
      .from("push_device_tokens")
      .select("token, platform, locale")
      .in("token", deviceTokens);
    for (const r of rows ?? []) devices.set((r as any).token, r as any);
  }

  if (subs.size === 0 && devices.size === 0) return json({ ok: true, skipped: "no_subscriptions" });

  let sent = 0;
  const deadEndpoints: string[] = [];
  const deadTokens: string[] = [];
  const errors: unknown[] = [];
  const tag = `${template}-${data.id ?? ""}`;

  const buildOrNull = (loc: ReturnType<typeof normalizeLocale>) => {
    try {
      return renderPush(template, loc, data);
    } catch (err) {
      errors.push({ error: (err as Error).message });
      return null;
    }
  };

  if (webPushReady) {
    for (const sub of subs.values()) {
      const built = buildOrNull(normalizeLocale(payload?.locale ?? sub.locale) ?? locale);
      if (!built) continue;
      try {
        const res = await sendWebPush(sub, { title: built.title, body: built.body, url, tag }, {
          privateJwk: privateJwk!,
          publicKey: publicKey!,
          subject,
        });
        if (res.ok) sent++;
        else if (res.gone) deadEndpoints.push(sub.endpoint);
        else errors.push({ endpoint: sub.endpoint, status: res.status, body: res.body });
      } catch (err) {
        errors.push({ endpoint: sub.endpoint, error: String(err) });
      }
    }
  } else if (subs.size > 0) {
    console.warn("send-push: web subscriptions present but VAPID keys are not configured");
  }

  for (const device of devices.values()) {
    const built = buildOrNull(normalizeLocale(payload?.locale ?? device.locale) ?? locale);
    if (!built) continue;
    try {
      if (device.platform === "android") {
        if (!fcmServiceAccount) continue;
        const res = await sendFcm(fcmServiceAccount, device.token, { title: built.title, body: built.body, url, tag });
        if (res.ok) sent++;
        else if (res.gone) deadTokens.push(device.token);
        else errors.push({ token: device.token, status: res.status, body: res.body });
      } else {
        if (!apnsConfig) continue;
        const res = await sendApns(apnsConfig, device.token, { title: built.title, body: built.body, url, tag });
        if (res.ok) sent++;
        else if (res.gone) deadTokens.push(device.token);
        else errors.push({ token: device.token, status: res.status, body: res.body });
      }
    } catch (err) {
      errors.push({ token: device.token, error: String(err) });
    }
  }

  if (deadEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }
  if (deadTokens.length > 0) {
    await supabase.from("push_device_tokens").delete().in("token", deadTokens);
  }

  return json({
    ok: true,
    sent,
    pruned: deadEndpoints.length + deadTokens.length,
    errors: errors.slice(0, 5),
  });
});
```

### `supabase/functions/_shared/fcm.ts` — new file

```ts
// Firebase Cloud Messaging (HTTP v1) sender for the Android native app.
// Auth is a service-account JWT exchanged for a short-lived OAuth2 access
// token — no external dependency, just WebCrypto + fetch.

import { bytesToB64url } from "./webpush.ts";

const enc = new TextEncoder();

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${bytesToB64url(enc.encode(JSON.stringify(header)))}.${
    bytesToB64url(enc.encode(JSON.stringify(claims)))
  }`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned)),
  );
  const jwt = `${unsigned}.${bytesToB64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`FCM token exchange failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  cachedToken = { value: body.access_token, expiresAt: now + (body.expires_in ?? 3600) };
  return cachedToken.value;
}

export type FcmResult = { ok: boolean; gone?: boolean; status?: number; body?: string };

/** Sends one FCM notification to an Android device registration token. */
export async function sendFcm(
  sa: ServiceAccount,
  token: string,
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<FcmResult> {
  const accessToken = await getAccessToken(sa);
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data: { url: payload.url, tag: payload.tag ?? "" },
          android: { priority: "high", notification: { tag: payload.tag } },
        },
      }),
    },
  );
  if (res.ok) return { ok: true };
  const text = await res.text();
  const gone = res.status === 404 || res.status === 400 && /UNREGISTERED|INVALID_ARGUMENT/.test(text);
  return { ok: false, gone, status: res.status, body: text };
}

export function loadServiceAccount(): ServiceAccount | null {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}
```

### `supabase/functions/_shared/apns.ts` — new file

```ts
// Apple Push Notification service (HTTP/2 provider API) sender for the iOS
// native app. Auth is a token signed with the account's APNs Auth Key
// (.p8, ES256) — no Firebase involvement needed for iOS.

import { bytesToB64url } from "./webpush.ts";

const enc = new TextEncoder();

type ApnsConfig = {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKeyPem: string;
  production: boolean;
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cachedJwt: { value: string; expiresAt: number; keyId: string } | null = null;

async function getProviderToken(cfg: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.keyId === cfg.keyId && cachedJwt.expiresAt - 300 > now) {
    return cachedJwt.value;
  }

  const header = { alg: "ES256", kid: cfg.keyId };
  const claims = { iss: cfg.teamId, iat: now };
  const unsigned = `${bytesToB64url(enc.encode(JSON.stringify(header)))}.${
    bytesToB64url(enc.encode(JSON.stringify(claims)))
  }`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(cfg.privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // WebCrypto's ECDSA signature is already raw r||s (IEEE P1363), which is
  // exactly what JWS ES256 expects — no DER conversion needed.
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)),
  );
  const jwt = `${unsigned}.${bytesToB64url(sig)}`;
  cachedJwt = { value: jwt, expiresAt: now + 3300, keyId: cfg.keyId };
  return jwt;
}

export type ApnsResult = { ok: boolean; gone?: boolean; status?: number; body?: string };

/** Sends one APNs alert to an iOS device token. */
export async function sendApns(
  cfg: ApnsConfig,
  deviceToken: string,
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<ApnsResult> {
  const host = cfg.production ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const jwt = await getProviderToken(cfg);

  const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": cfg.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: "default",
        "thread-id": payload.tag ?? "",
      },
      url: payload.url,
    }),
  });
  if (res.ok) return { ok: true };
  const text = await res.text();
  const gone = res.status === 410 ||
    (res.status === 400 && /BadDeviceToken/.test(text));
  return { ok: false, gone, status: res.status, body: text };
}

export function loadApnsConfig(): ApnsConfig | null {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  const privateKeyPem = Deno.env.get("APNS_PRIVATE_KEY");
  if (!keyId || !teamId || !bundleId || !privateKeyPem) return null;
  const production = Deno.env.get("APNS_PRODUCTION") !== "false";
  return { keyId, teamId, bundleId, privateKeyPem, production };
}
```

Deploy after adding the files: `supabase functions deploy send-push` (or
however Lovable triggers an edge function redeploy).

### Secrets — I can't paste these, only their names

Everything above is code I can hand you outright. The secrets below are
different: each one is a credential tied to *your* Firebase project and *your*
Apple Developer account, generated on services I have no access to. I can't
fabricate working values for them — pasting anything here would just be
made up and wouldn't deliver a single push notification. What I can give you
is the exact name each secret needs (the code above reads these exact
`Deno.env.get(...)` keys) and precisely where to get the real value. Full
walkthrough is in `APP_STORE_GUIDE.md` Part 2; short version:

| Secret name | Where it comes from |
|---|---|
| `FCM_SERVICE_ACCOUNT_JSON` | Firebase Console → your project → Project Settings → Service Accounts → **Generate new private key**. Paste the entire downloaded JSON file as the value. |
| `APNS_KEY_ID` | Apple Developer → Certificates, Identifiers & Profiles → Keys → the APNs key you create → shown on its detail page. |
| `APNS_TEAM_ID` | Apple Developer portal, top-right, or the Membership page. |
| `APNS_BUNDLE_ID` | `org.thecatholiccalendar.app` — this one I *can* give you, it's fixed by the app's config, not a generated credential. |
| `APNS_PRIVATE_KEY` | The full contents of the `.p8` file Apple lets you download once when creating the APNs key — including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines. |
| `APNS_PRODUCTION` | `false` while testing with a development/Xcode build (uses Apple's sandbox APNs server), `true` once you're shipping TestFlight/App Store builds. |

Set these in Supabase → Edge Functions → Secrets (or ask Lovable to, if it
manages that for you). Android push needs only the Firebase one; iOS push
needs the four `APNS_*` ones — you can do either independently, or both.

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
