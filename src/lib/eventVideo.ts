import { supabase } from "@/integrations/supabase/client";

export const MAX_VIDEO_MB = 200;

export type VideoSource =
  | { kind: "embed"; src: string; provider: "youtube" | "vimeo"; watchUrl: string }
  | { kind: "file"; src: string; provider: "file"; watchUrl: string };

/** Recognises the video links organizers actually paste. */
export function parseVideoLink(raw: string): { provider: "youtube" | "vimeo"; embed: string } | null {
  const url = raw.trim();
  if (!url) return null;
  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  if (yt) return { provider: "youtube", embed: `https://www.youtube.com/embed/${yt[1]}` };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return { provider: "vimeo", embed: `https://player.vimeo.com/video/${vm[1]}` };
  return null;
}

export function isSupportedVideoLink(raw: string): boolean {
  return !!parseVideoLink(raw) || /^https?:\/\/\S+\.(mp4|webm|mov|ogg)(\?\S*)?$/i.test(raw.trim());
}

const signedCache = new Map<string, { url: string; expires: number }>();

/**
 * Turn a stored `video_url` (a pasted link or a storage path) into something playable.
 */
export async function resolveEventVideo(value: string | null | undefined): Promise<VideoSource | null> {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    const parsed = parseVideoLink(raw);
    if (parsed) return { kind: "embed", src: parsed.embed, provider: parsed.provider, watchUrl: raw };
    return { kind: "file", src: raw, provider: "file", watchUrl: raw };
  }
  const now = Date.now();
  const hit = signedCache.get(raw);
  if (hit && hit.expires > now + 60_000) {
    return { kind: "file", src: hit.url, provider: "file", watchUrl: hit.url };
  }
  const { data, error } = await supabase.storage.from("event-videos").createSignedUrl(raw, 60 * 60 * 12);
  if (error || !data?.signedUrl) return null;
  signedCache.set(raw, { url: data.signedUrl, expires: now + 60 * 60 * 12 * 1000 });
  return { kind: "file", src: data.signedUrl, provider: "file", watchUrl: data.signedUrl };
}

export async function uploadEventVideo(file: File, userId: string): Promise<string> {
  if (!/^video\//i.test(file.type)) {
    throw new Error("Please choose a video file (MP4, WebM or MOV).");
  }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`Video must be smaller than ${MAX_VIDEO_MB}MB.`);
  }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await supabase.storage.from("event-videos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return path;
}
