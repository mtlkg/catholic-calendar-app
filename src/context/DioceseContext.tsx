import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DIOCESES,
  CITY_GROUPS,
  cityGroupFor,
  primarySlugFor,
  scopeSlugsFor,
  isDioceseUnlocked,
  UNLOCKED_DEFAULT_SLUG,
  type Diocese,
} from "@/data/dioceses";

const STORAGE_KEY = "cc.diocese";
const CHOSEN_KEY = "cc.diocese.chosen";
const COORDS_KEY = "cc.diocese.coords";
const DEFAULT_SLUG = UNLOCKED_DEFAULT_SLUG;

// Real jurisdictions plus the synthetic "all dioceses of <city>" entries.
const BY_SLUG = new Map<string, Diocese>(
  [...DIOCESES, ...CITY_GROUPS].map((d) => [d.slug, d]),
);

export function dioceseBySlug(slug: string | null | undefined): Diocese | null {
  if (!slug) return null;
  return BY_SLUG.get(slug) ?? null;
}

/** Rough great-circle distance in km. */
function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dx = (b.lng - a.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180)) * 111.32;
  const dy = (b.lat - a.lat) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Closest non-national dioceses to a point, nearest first, with distance in km. */
export function nearestDioceses(lat: number, lng: number, limit = 3): { diocese: Diocese; km: number }[] {
  const seen = new Set<string>();
  const out: { diocese: Diocese; km: number }[] = [];
  const ranked = DIOCESES.filter((d) => !d.national && isDioceseUnlocked(d.slug))
    .map((d) => ({ d, km: kmBetween({ lat, lng }, { lat: d.lat, lng: d.lng }) }))
    .sort((a, b) => a.km - b.km);
  for (const { d, km } of ranked) {
    // Prefer the combined "all dioceses in this city" view when one exists.
    const target = cityGroupFor(d) ?? d;
    if (seen.has(target.slug)) continue;
    seen.add(target.slug);
    out.push({ diocese: target, km });
    if (out.length >= limit) break;
  }
  return out;
}

/** Nearest non-national diocese to a point (equirectangular approximation). */
export function nearestDiocese(lat: number, lng: number): Diocese {
  let best = BY_SLUG.get(DEFAULT_SLUG)!;
  let bestD = Infinity;
  for (const d of DIOCESES) {
    if (d.national || !isDioceseUnlocked(d.slug)) continue;
    const dx = (d.lng - lng) * Math.cos((lat * Math.PI) / 180);
    const dy = d.lat - lat;
    const dist = dx * dx + dy * dy;
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

type Ctx = {
  diocese: Diocese;
  setDiocese: (slug: string) => void;
  /** Localized display name of the active diocese. */
  dioceseName: string;
  /** Real diocese slugs the current selection covers (1, or all city members). */
  scopeSlugs: string[];
  /** Stable dependency key for the scope. */
  scopeKey: string;
  /** Real diocese slug to attribute newly created content to. */
  primarySlug: string;
  /** True when a combined "all dioceses in this city" view is active. */
  isCityGroup: boolean;
  /** True once the visitor has explicitly picked a diocese (remembered). */
  hasChosen: boolean;
  /** Detected visitor coordinates, when location lookup succeeded. */
  detectedCoords: { lat: number; lng: number } | null;
};

const DioceseCtx = createContext<Ctx | null>(null);

export function useDiocese(): Ctx {
  const ctx = useContext(DioceseCtx);
  if (!ctx) throw new Error("useDiocese must be used inside DioceseProvider");
  return ctx;
}

/** Localized name for any diocese. */
export function useDioceseName() {
  const { i18n } = useTranslation();
  const fr = i18n.language?.startsWith("fr");
  return useCallback((d: Diocese) => (fr && d.nameFr ? d.nameFr : d.name), [fr]);
}

export function DioceseProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const nameOf = useDioceseName();

  // The provider sits above the route tree, so read the city slug off the
  // pathname (/catholic-calendar/d/:slug) or the ?diocese= query param.
  const urlSlug =
    /^\/catholic-calendar\/d\/([^/?#]+)/.exec(location.pathname)?.[1] ??
    new URLSearchParams(location.search).get("diocese") ??
    null;

  const [slug, setSlug] = useState<string>(() => {
    if (urlSlug && BY_SLUG.has(urlSlug) && isDioceseUnlocked(urlSlug)) return urlSlug;
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && BY_SLUG.has(stored) && isDioceseUnlocked(stored)) return stored;
    }
    return DEFAULT_SLUG;
  });

  // A slug in the URL always wins (shareable per-city links).
  useEffect(() => {
    if (urlSlug && BY_SLUG.has(urlSlug) && isDioceseUnlocked(urlSlug) && urlSlug !== slug) setSlug(urlSlug);
  }, [urlSlug, slug]);

  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [hasChosen, setHasChosen] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(CHOSEN_KEY) === "1";
  });

  // Location detection. Before the visitor has picked a diocese we simply open
  // the nearest one. After they have picked one we keep their choice and only
  // switch automatically if they have clearly relocated (moved far away from
  // where they were when they chose).
  useEffect(() => {
    if (urlSlug) return;
    if (typeof localStorage === "undefined") return;

    let cancelled = false;

    const apply = (lat: number, lng: number) => {
      if (cancelled) return;
      setDetectedCoords({ lat, lng });
      const chosen = localStorage.getItem(CHOSEN_KEY) === "1";
      if (chosen) {
        // The visitor picked a diocese explicitly — never override it.
        // Keep their last known position for reference only.
        try {
          localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng }));
        } catch {
          /* storage unavailable */
        }
        return;
      }
      const nearest = nearestDiocese(lat, lng);
      // Prefer the combined "all dioceses in this city" view when one exists.
      const target = cityGroupFor(nearest) ?? nearest;
      try {
        localStorage.setItem(STORAGE_KEY, target.slug);
        localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng }));
      } catch {
        /* storage unavailable */
      }
      setSlug(target.slug);
    };


    const ipLookup = async () => {
      const endpoints = ["https://ipapi.co/json/", "https://ipwho.is/"];
      for (const url of endpoints) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const j = await res.json();
          const lat = Number(j.latitude);
          const lng = Number(j.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            apply(lat, lng);
            return;
          }
        } catch {
          /* try next provider */
        }
      }
    };

    void ipLookup();

    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const precise = () =>
      navigator.geolocation.getCurrentPosition(
        (pos) => apply(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
      );

    // Only ask silently: if the permission was already granted, refine.
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((p) => {
          if (p.state === "granted") precise();
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [urlSlug]);


  const setDiocese = useCallback(
    (next: string) => {
      if (!BY_SLUG.has(next) || !isDioceseUnlocked(next)) return;
      setSlug(next);
      setHasChosen(true);
      try {
        localStorage.setItem(STORAGE_KEY, next);
        localStorage.setItem(CHOSEN_KEY, "1");
      } catch {
        /* storage unavailable */
      }
      // Their choice is sticky from now on; we no longer auto-switch.

      // Keep dedicated city URLs in sync so the address bar is shareable.
      if (location.pathname.startsWith("/catholic-calendar/d/")) {
        navigate(`/catholic-calendar/d/${next}`, { replace: true });
      }
    },
    [location.pathname, navigate],
  );

  const diocese =
    (isDioceseUnlocked(slug) ? BY_SLUG.get(slug) : undefined) ?? BY_SLUG.get(DEFAULT_SLUG)!;

  const scopeSlugs = useMemo(() => scopeSlugsFor(diocese), [diocese]);

  const value = useMemo<Ctx>(
    () => ({
      diocese,
      setDiocese,
      dioceseName: nameOf(diocese),
      scopeSlugs,
      scopeKey: scopeSlugs.join(","),
      primarySlug: primarySlugFor(diocese),
      isCityGroup: !!diocese.members,
      hasChosen: hasChosen || !!urlSlug,
      detectedCoords,
    }),
    [diocese, setDiocese, nameOf, scopeSlugs, hasChosen, urlSlug, detectedCoords],
  );

  return <DioceseCtx.Provider value={value}>{children}</DioceseCtx.Provider>;
}
