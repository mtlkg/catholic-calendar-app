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
