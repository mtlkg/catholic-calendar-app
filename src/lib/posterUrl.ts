import { supabase } from "@/integrations/supabase/client";

// In-memory cache so we don't request a new signed URL for the same poster repeatedly.
const cache = new Map<string, { url: string; expires: number }>();

/**
 * Convert a stored event-poster path into a temporary signed URL.
 * Returns null if the path is empty or signing fails.
 */
export async function getPosterUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // Already an absolute URL (legacy data or external link).
  if (/^https?:\/\//i.test(path)) return path;
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expires > now + 60_000) return hit.url;
  const { data, error } = await supabase.storage
    .from("event-posters")
    .createSignedUrl(path, 60 * 60 * 24);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, expires: now + 60 * 60 * 24 * 1000 });
  return data.signedUrl;
}

export async function uploadEventPoster(file: File, userId: string | null): Promise<string | null> {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Poster must be smaller than 8MB.");
  }
  if (!/^image\//i.test(file.type)) {
    throw new Error("Poster must be an image (JPG, PNG, or WebP).");
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const submissionId = createGuestSubmissionId();
  const path = userId
    ? `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
    : `guest/${submissionId}/${safe}`;
  const { error } = await supabase.storage.from("event-posters").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return path;
}

function createGuestSubmissionId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
