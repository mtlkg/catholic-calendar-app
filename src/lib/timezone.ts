// Diocese-aware time zones.
//
// Every event belongs to a diocese, and an event's wall-clock time only makes
// sense in that diocese's local time zone: 7pm Mass in Nashville is 7pm Central,
// not 7pm in the viewer's browser zone. These helpers derive an IANA zone for a
// diocese, convert entered local times to UTC, and format stored UTC timestamps
// back into the event's local zone.

import { format as dfFormat } from "date-fns";
import { DIOCESES, type Diocese } from "@/data/dioceses";
import { getDateLocale } from "@/lib/dateLocale";

const EASTERN = "America/Toronto";
const CENTRAL = "America/Chicago";
const MOUNTAIN = "America/Denver";
const PACIFIC = "America/Los_Angeles";

const US_ZONES: Record<string, string> = {
  ME: "America/New_York", NH: "America/New_York", VT: "America/New_York",
  MA: "America/New_York", RI: "America/New_York", CT: "America/New_York",
  NY: "America/New_York", NJ: "America/New_York", PA: "America/New_York",
  DE: "America/New_York", MD: "America/New_York", DC: "America/New_York",
  VA: "America/New_York", WV: "America/New_York", NC: "America/New_York",
  SC: "America/New_York", GA: "America/New_York", OH: "America/New_York",
  AL: CENTRAL, AR: CENTRAL, IL: CENTRAL, IA: CENTRAL, LA: CENTRAL,
  MN: CENTRAL, MS: CENTRAL, MO: CENTRAL, OK: CENTRAL, WI: CENTRAL,
  CO: MOUNTAIN, MT: MOUNTAIN, NM: MOUNTAIN, UT: MOUNTAIN, WY: MOUNTAIN,
  AZ: "America/Phoenix",
  CA: PACIFIC, WA: PACIFIC, NV: PACIFIC,
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
  PR: "America/Puerto_Rico", VI: "America/Puerto_Rico",
  GU: "Pacific/Guam", MP: "Pacific/Guam", AS: "Pacific/Pago_Pago",
};

const CA_ZONES: Record<string, string> = {
  BC: "America/Vancouver",
  YT: "America/Whitehorse",
  AB: "America/Edmonton",
  NT: "America/Edmonton",
  NU: "America/Iqaluit",
  SK: "America/Regina",
  MB: "America/Winnipeg",
  ON: EASTERN,
  QC: EASTERN,
  NB: "America/Halifax",
  NS: "America/Halifax",
  PE: "America/Halifax",
  NL: "America/St_Johns",
};

function regionCode(city: string): string {
  const m = city.match(/,\s*([A-Z]{2})\s*$/);
  return m ? m[1] : "";
}

/** IANA time zone for a diocese, resolving split states by longitude. */
export function zoneForDiocese(d: Diocese | null | undefined): string {
  if (!d) return browserZone();
  const code = regionCode(d.city);
  const { lat, lng } = d;
  if (d.country === "CA") {
    if (code === "ON" && lng < -90) return "America/Winnipeg";
    return CA_ZONES[code] ?? EASTERN;
  }
  switch (code) {
    case "FL": return lng < -85 ? CENTRAL : "America/New_York";
    case "MI": return lng < -87.5 ? CENTRAL : "America/Detroit";
    case "IN": return lng < -86.9 ? CENTRAL : "America/Indiana/Indianapolis";
    case "KY": return lng < -85 ? CENTRAL : "America/New_York";
    case "TN": return lng < -85.5 ? CENTRAL : "America/New_York";
    case "TX": return lng < -104.5 ? MOUNTAIN : CENTRAL;
    case "ND": case "SD": case "NE": case "KS":
      return lng < -100.5 ? MOUNTAIN : CENTRAL;
    case "OR": return lng > -117.2 ? "America/Boise" : PACIFIC;
    case "ID": return lat > 45.8 ? PACIFIC : "America/Boise";
    default: return US_ZONES[code] ?? "America/New_York";
  }
}

const BY_SLUG = new Map(DIOCESES.map((d) => [d.slug, d]));

export function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || EASTERN;
  } catch {
    return EASTERN;
  }
}

/** IANA time zone for a diocese slug (falls back to the browser zone). */
export function zoneForSlug(slug: string | null | undefined): string {
  const d = slug ? BY_SLUG.get(slug) : null;
  if (!d || d.national) return browserZone();
  return zoneForDiocese(d);
}

/** Offset in minutes between a UTC instant and the given zone's wall clock. */
function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  return (asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

/** date-fns `format`, rendered in the given zone with the active i18n locale. */
export function formatInZone(date: Date | string, fmt: string, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const off = zoneOffsetMinutes(d, timeZone);
  const shifted = new Date(d.getTime() + (off + d.getTimezoneOffset()) * 60000);
  return dfFormat(shifted, fmt, { locale: getDateLocale() });
}

/** Convenience: format an event timestamp in its own diocese's zone. */
export function formatEventTime(
  value: Date | string,
  fmt: string,
  dioceseSlug?: string | null,
): string {
  return formatInZone(value, fmt, zoneForSlug(dioceseSlug));
}

/** Short zone label for the given instant, e.g. "EDT" / "CST". */
export function zoneAbbrev(date: Date | string, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(d);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** "yyyy-MM-dd" day key for an instant, as seen in the given zone. */
export function zonedDayKey(value: Date | string, timeZone: string): string {
  return formatInZone(value, "yyyy-MM-dd", timeZone);
}

/**
 * Convert a `datetime-local` string ("2026-08-20T19:00") that the user meant as
 * wall-clock time in `timeZone` into a UTC ISO string.
 */
export function localInputToUtcISO(input: string, timeZone: string): string {
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return new Date(input).toISOString();
  const [, y, mo, da, h, mi] = m.map(Number) as unknown as number[];
  const naiveUTC = Date.UTC(y, mo - 1, da, h, mi);
  // Two passes handle DST boundaries.
  let guess = new Date(naiveUTC - zoneOffsetMinutes(new Date(naiveUTC), timeZone) * 60000);
  guess = new Date(naiveUTC - zoneOffsetMinutes(guess, timeZone) * 60000);
  return guess.toISOString();
}

/** "yyyy-MM-dd" + 1 day, purely on the calendar-date string. */
export function nextDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}
