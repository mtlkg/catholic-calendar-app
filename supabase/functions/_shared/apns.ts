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
