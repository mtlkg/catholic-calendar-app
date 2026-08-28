// Runs before `vite dev` and `vite build` (predev/prebuild hooks).
// Writes public/sitemap.xml with static routes + one entry per approved
// event and organizer profile pulled straight from Lovable Cloud.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://thecatholiccalendar.org";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://iqyufdoumddklhvqcbpu.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_5q4R8BtEPfnzcmKgRgzc2Q_ePv4Lpt0";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/catholic-calendar", changefreq: "daily", priority: "1.0" },
  { path: "/catholic-calendar/highlights", changefreq: "daily", priority: "0.9" },
  { path: "/catholic-calendar/organizers", changefreq: "weekly", priority: "0.8" },
  { path: "/catholic-calendar/submit", changefreq: "monthly", priority: "0.6" },
  { path: "/catholic-calendar/accounts", changefreq: "monthly", priority: "0.5" },
];

async function fetchRows<T = any>(view: string, select: string): Promise<T[]> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${view}?select=${encodeURIComponent(select)}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
    });
    if (!res.ok) {
      console.warn(`sitemap: ${view} fetch failed (${res.status})`);
      return [];
    }
    return (await res.json()) as T[];
  } catch (err) {
    console.warn(`sitemap: ${view} fetch error`, err);
    return [];
  }
}

function toIsoDate(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

function generateSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${xmlEscape(BASE_URL + e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

async function main() {
  const [events, organizers] = await Promise.all([
    fetchRows<{ id: string; updated_at?: string; start_at?: string }>(
      "calendar_events_public",
      "id,updated_at,start_at",
    ),
    fetchRows<{ user_id: string; updated_at?: string }>(
      "organizer_profiles_public",
      "user_id,updated_at",
    ),
  ]);

  const eventEntries: SitemapEntry[] = events.map((e) => ({
    path: `/catholic-calendar/event/${e.id}`,
    lastmod: toIsoDate(e.updated_at) ?? toIsoDate(e.start_at),
    changefreq: "weekly",
    priority: "0.7",
  }));

  const orgEntries: SitemapEntry[] = organizers.map((o) => ({
    path: `/catholic-calendar/organizers/${o.user_id}`,
    lastmod: toIsoDate(o.updated_at),
    changefreq: "monthly",
    priority: "0.6",
  }));

  const all = [...staticEntries, ...eventEntries, ...orgEntries];
  writeFileSync(resolve("public/sitemap.xml"), generateSitemap(all));
  console.log(`sitemap.xml written (${all.length} entries)`);
}

main().catch((err) => {
  console.error("sitemap generation failed", err);
  // Never break the build over a sitemap: fall back to the static routes.
  writeFileSync(resolve("public/sitemap.xml"), generateSitemap(staticEntries));
});
