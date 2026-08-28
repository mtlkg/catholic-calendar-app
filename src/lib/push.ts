import { supabase } from "@/integrations/supabase/client";

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
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** True on iOS Safari when the site has not been added to the home screen. */
export function needsHomeScreenInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as any).standalone === true;
  return isIOS && !standalone && !pushSupported();
}

export function pushPermission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
}

/** Returns the endpoint of the existing subscription on this device, if any. */
export async function currentPushEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
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
 * subscription server-side. Returns the endpoint, or null when declined.
 */
export async function enablePush(locale = "en"): Promise<string | null> {
  if (!pushSupported()) return null;

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
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await (supabase as any).rpc("delete_push_subscription", { _endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}
