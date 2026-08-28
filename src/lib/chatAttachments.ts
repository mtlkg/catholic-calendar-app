import { supabase } from "@/integrations/supabase/client";

export type Attachment = {
  path: string;
  name: string;
  type: string;
  size: number;
};

const IMAGE_TYPES = /^image\//;

export const isImage = (a: Attachment) => IMAGE_TYPES.test(a.type || "");

export async function uploadChatFiles(userId: string, files: File[]): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const f of files) {
    if (f.size > 10 * 1024 * 1024) {
      alert(`"${f.name}" is larger than 10MB and was skipped.`);
      continue;
    }
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { error } = await supabase.storage.from("chat-uploads").upload(path, f, {
      cacheControl: "3600",
      upsert: false,
      contentType: f.type || undefined,
    });
    if (error) {
      alert(`Upload failed for ${f.name}: ${error.message}`);
      continue;
    }
    out.push({ path, name: f.name, type: f.type || "application/octet-stream", size: f.size });
  }
  return out;
}

export async function signAttachmentUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return {};
  const { data, error } = await supabase.storage.from("chat-uploads").createSignedUrls(unique, 60 * 60 * 24);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((d: any) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl; });
  return map;
}

// Renders plain text with auto-linked URLs.
const URL_RE = /(https?:\/\/[^\s<>"')]+)/gi;
export function linkifyParts(text: string): Array<{ type: "text" | "link"; value: string }> {
  if (!text) return [];
  const parts: Array<{ type: "text" | "link"; value: string }> = [];
  let last = 0;
  text.replace(URL_RE, (m, _u, i: number) => {
    if (i > last) parts.push({ type: "text", value: text.slice(last, i) });
    parts.push({ type: "link", value: m });
    last = i + m.length;
    return m;
  });
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}