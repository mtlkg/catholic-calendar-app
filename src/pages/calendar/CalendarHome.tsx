import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek,
  isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth, startOfWeek,
} from "date-fns";
import { format } from "@/lib/dateLocale";
import { ChevronLeft, ChevronRight, MapPin, Search, List, Grid3x3, Map as MapIcon, Star, Loader2, X, SlidersHorizontal, Globe, Languages } from "lucide-react";
import { eventLanguagesLabel } from "@/data/eventLanguages";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import CalendarLayout, { CATEGORIES, CATEGORY_COLORS, useCategoryLabel } from "./CalendarLayout";
import { geocodeAddress, distanceKm, type GeoPoint } from "@/lib/geocode";
import VerifiedBadge from "@/components/VerifiedBadge";
import EventsMap from "@/components/EventsMap";
import InterestedButton from "@/components/InterestedButton";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import { useDiocese } from "@/context/DioceseContext";
import DiocesePicker from "@/components/DiocesePicker";
import MontrealFreeNote from "@/components/MontrealFreeNote";
import { formatEventTime, zoneForSlug, zonedDayKey, nextDayKey } from "@/lib/timezone";
import { dioceseShortName, getDiocese, dioceseName, dioceseMiniName } from "@/data/dioceses";
import { LocateFixed, RotateCcw, Building2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import LocationMapDialog from "@/components/LocationMapDialog";
import EventVideoButton from "@/components/EventVideoButton";

import {
  broadcastBadgeClasses,
  broadcastBadgeKey,
  broadcastPriority,
  isBroadcastEvent,
  isHostedInScope,
  isInvitedToScope,
  shouldPinOnMap,
} from "@/lib/eventAudience";

type Ev = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_at: string;
  end_at: string | null;
  venue_name: string | null;
  address: string | null;
  parish: string | null;
  guest_name: string | null;
  registration_url: string | null;
  is_featured: boolean;
  latitude: number | null;
  longitude: number | null;
  submitted_by_user_id: string | null;
  diocese_slug: string | null;
  event_language: string | null;
  event_languages: string[] | null;
  audience_scope?: string | null;
  audience_diocese_slugs?: string[] | null;
  audience_countries?: string[] | null;
  video_url?: string | null;
};

type ViewMode = "month" | "list" | "map";

const VerifiedCtx = createContext<Set<string>>(new Set());
const useVerified = () => useContext(VerifiedCtx);

/** user_id -> public organizer/host name, used to label events on the calendar. */
const HostNamesCtx = createContext<Map<string, string>>(new Map());
const useHostNames = () => useContext(HostNamesCtx);

/** Who is hosting an event: their parish/organization name when we know it. */
function useHostLabel(ev: Ev): string | null {
  const names = useHostNames();
  const fromProfile = ev.submitted_by_user_id ? names.get(ev.submitted_by_user_id) : null;
  return ev.parish || fromProfile || ev.guest_name || null;
}

// An event is "past" once its end date (or start, if no end) is before today.
function isPastEvent(e: Ev): boolean {
  const end = e.end_at ? parseISO(e.end_at) : parseISO(e.start_at);
  const today = startOfDay(new Date());
  return startOfDay(end) < today;
}

/**
 * Linear radius slider. Equal movement along the track changes the radius by
 * the same amount everywhere. US dioceses use miles, everywhere else km.
 */
const KM_PER_MI = 1.609344;
const UNITS = {
  km: { min: 0.1, max: 60, def: 5 },
  mi: { min: 0.1, max: 40, def: 3 },
} as const;

type RadiusUnit = keyof typeof UNITS;

function sliderToRadius(pos: number, unit: RadiusUnit): number {
  const { min, max } = UNITS[unit];
  return Math.round((min + (pos / 100) * (max - min)) * 10) / 10;
}

function radiusToSlider(value: number, unit: RadiusUnit): number {
  const { min, max } = UNITS[unit];
  const v = Math.min(Math.max(value, min), max);
  return Math.round((100 * (v - min)) / (max - min));
}

function formatRadius(value: number): string {
  return value < 10 ? String(Math.round(value * 10) / 10) : String(Math.round(value));
}

function twoWeekWindow(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  const end = addDays(start, 13);
  return { start, end };
}


export default function CalendarHome() {

  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { diocese, dioceseName, scopeSlugs, scopeKey, isCityGroup, hasChosen } = useDiocese();
  const categoryLabel = useCategoryLabel();
  const [events, setEvents] = useState<Ev[]>([]);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [hostNames, setHostNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [monthAnchor, setMonthAnchor] = useState(startOfMonth(new Date()));
  const [view, setView] = useState<ViewMode>("month");
  const [gridSpan, setGridSpan] = useState<"month" | "twoWeeks">("month");
  const [activeCats, setActiveCats] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [localOnlyInfo, setLocalOnlyInfo] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);
  // Radius filter
  const [addressInput, setAddressInput] = useState("");
  const radiusUnit: RadiusUnit = diocese.country === "US" ? "mi" : "km";
  const [radius, setRadius] = useState<number>(UNITS[radiusUnit].def);
  const radiusKm = radiusUnit === "mi" ? radius * KM_PER_MI : radius;
  // Reset to the unit default whenever the country (and therefore unit) changes
  useEffect(() => {
    setRadius(UNITS[radiusUnit].def);
  }, [radiusUnit]);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [originLabel, setOriginLabel] = useState<string>("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    const requestedView = new URLSearchParams(location.search).get("view");
    if (requestedView === "month" || requestedView === "list" || requestedView === "map") {
      setView(requestedView);
    }
  }, [location.search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const from = startOfMonth(addMonths(monthAnchor, -1)).toISOString();
      const to = endOfMonth(addMonths(monthAnchor, 2)).toISOString();
      // Events shown here: hosted in this diocese, explicitly broadcast to it,
      // or nationwide events open to this diocese's country.
      const scopeList = scopeSlugs.join(",");
      const audienceFilter = [
        `diocese_slug.in.(${scopeList})`,
        `audience_diocese_slugs.ov.{${scopeList}}`,
        `audience_countries.ov.{${diocese.country}}`,
      ].join(",");
      const { data } = await supabase
        .from("calendar_events_public" as any)
        .select("id,title,description,category,start_at,end_at,venue_name,address,parish,registration_url,is_featured,latitude,longitude,submitted_by_user_id,diocese_slug,event_language,event_languages,audience_scope,audience_diocese_slugs,audience_countries,video_url")
        .eq("status", "approved")
        .or(audienceFilter)
        .lte("start_at", to)
        .or(`end_at.gte.${from},and(end_at.is.null,start_at.gte.${from})`)
        .order("start_at", { ascending: true });
      setEvents((((data ?? []) as unknown) as Ev[]).filter((event) =>
        isInvitedToScope(event, scopeSlugs, diocese.country),
      ));
      const ids = Array.from(new Set((data ?? []).map((e: any) => e.submitted_by_user_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: orgs } = await supabase
          .from("organizer_profiles_public" as any)
          .select("user_id,org_name,parish")
          .in("user_id", ids);
        setVerifiedIds(new Set((orgs ?? []).map((o: any) => o.user_id)));
        setHostNames(
          new Map(
            (orgs ?? [])
              .map((o: any) => [o.user_id, o.org_name || o.parish])
              .filter(([, n]: any) => !!n) as [string, string][],
          ),
        );
      } else {
        setVerifiedIds(new Set());
        setHostNames(new Map());
      }
      setLoading(false);
    })();
  }, [monthAnchor, scopeKey, diocese.country]);

  const eventsWithKnownCoords = useMemo(() => hydrateMatchingCoordinates(events), [events]);

  // Client-side geocoding fallback: for any event with an address/venue but no
  // coordinates, resolve lat/lng on demand so the radius filter never silently
  // drops it. Results are cached per normalized address for the session.
  const [geocodedCoords, setGeocodedCoords] = useState<Map<string, GeoPoint>>(new Map());
  const [geocodeAttempted, setGeocodeAttempted] = useState<Set<string>>(new Set());
  useEffect(() => {
    const missing = eventsWithKnownCoords.filter(
      (e) => (e.latitude == null || e.longitude == null) && (e.address || e.venue_name)
    );
    if (!missing.length) return;
    const targets: { key: string; queries: string[]; eventIds: string[] }[] = [];
    const byKey = new Map<string, { key: string; queries: string[]; eventIds: string[] }>();
    for (const e of missing) {
      const queries = Array.from(new Set([
        [e.venue_name, e.address].filter(Boolean).join(", ").trim(),
        e.address ?? "",
        e.venue_name ?? "",
      ].filter((q) => q.trim().length > 0)));
      if (!queries.length) continue;
      const key = normalizeEventAddress(e.address || e.venue_name || queries[0]);
      if (!key || geocodedCoords.has(key) || geocodeAttempted.has(key)) continue;
      const existing = byKey.get(key);
      if (existing) {
        existing.eventIds.push(e.id);
        queries.forEach((q) => {
          if (!existing.queries.includes(q)) existing.queries.push(q);
        });
        continue;
      }
      const target = { key, queries, eventIds: [e.id] };
      byKey.set(key, target);
      targets.push(target);
    }
    if (!targets.length) return;
    let cancelled = false;
    (async () => {
      for (const t of targets) {
        let pt: GeoPoint | null = null;
        for (const query of t.queries) {
          pt = await geocodeAddressInBrowser(query);
          if (pt) break;
          for (const eventId of t.eventIds) {
            pt = await geocodeAddress(query, eventId);
            if (pt) break;
          }
          if (pt) break;
        }
        if (cancelled) return;
        // Mark as attempted whether or not we found a point, so we don't retry
        // indefinitely on every re-render.
        setGeocodeAttempted((prev) => {
          if (prev.has(t.key)) return prev;
          const next = new Set(prev);
          next.add(t.key);
          return next;
        });
        if (pt) {
          setGeocodedCoords((prev) => {
            if (prev.has(t.key)) return prev;
            const next = new Map(prev);
            next.set(t.key, pt);
            return next;
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventsWithKnownCoords, geocodedCoords, geocodeAttempted]);


  const eventsWithResolvedCoords = useMemo(() => {
    if (!geocodedCoords.size) return eventsWithKnownCoords;
    return eventsWithKnownCoords.map((e) => {
      if (e.latitude != null && e.longitude != null) return e;
      const query = [e.venue_name, e.address].filter(Boolean).join(", ").trim();
      const key = normalizeEventAddress(query);
      const pt = key ? geocodedCoords.get(key) : null;
      return pt ? { ...e, latitude: pt.lat, longitude: pt.lng } : e;
    });
  }, [eventsWithKnownCoords, geocodedCoords]);

  const filtered = useMemo(() => {
    return eventsWithResolvedCoords.filter((e) => {
      if (activeCats.length && !activeCats.includes(e.category)) return false;
      // "Featured" now surfaces big regional events (multi-diocese, province/
      // state-wide, nationwide) rather than paid featured slots.
      if (showFeaturedOnly && !isBroadcastEvent(e)) return false;
      // "Only this diocese" hides broadcast events from elsewhere, but keeps
      // events actually hosted in the diocese you're viewing.
      if (localOnly && isBroadcastEvent(e) && !isHostedInScope(e, scopeSlugs)) return false;
      if (origin) {
        // With an address set, only events we can actually place within the
        // radius are shown — in the calendar grid, the list and the map.
        if (e.latitude == null || e.longitude == null) return false;
        if (distanceKm(origin, { lat: e.latitude, lng: e.longitude }) > radiusKm) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const blob = `${e.title} ${e.description ?? ""} ${e.venue_name ?? ""} ${e.parish ?? ""} ${e.guest_name ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [eventsWithResolvedCoords, activeCats, search, showFeaturedOnly, localOnly, origin, radiusKm, scopeKey]);

  // Upcoming = not past. Used by month + map views (which never show past events).
  const upcoming = useMemo(() => filtered.filter((e) => !isPastEvent(e)), [filtered]);

  // Map view: events with an address/location that overlap the displayed month.
  // Multi-day events stay pinned until their end date passes.
  const mapEvents = useMemo(() => {
    const mStart = startOfMonth(monthAnchor);
    const mEnd = endOfMonth(monthAnchor);
    return upcoming.filter((e) => {
      if (!e.address && !e.venue_name) return false;
      // A nationwide event is pinned only on its host diocese's map; elsewhere
      // it appears in the "your diocese is invited" side panel instead.
      if (!shouldPinOnMap(e, scopeSlugs)) return false;
      const s = parseISO(e.start_at);
      const en = e.end_at ? parseISO(e.end_at) : s;
      return s <= mEnd && en >= mStart;
    });
  }, [upcoming, monthAnchor, scopeKey]);

  // Number of events currently visible with the active filters.
  const displayCount = view === "list" ? filtered.length : view === "map" ? mapEvents.length : upcoming.length;

  const toggleCat = (c: string) =>
    setActiveCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const applyAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeoError(null);
    if (!addressInput.trim()) {
      setOrigin(null);
      setOriginLabel("");
      return;
    }
    setGeoLoading(true);
    const pt = (await geocodeAddressInBrowser(addressInput)) ?? (await geocodeAddress(addressInput));
    setGeoLoading(false);
    if (!pt) {
      setGeoError(t("home.addressNotFound"));
      return;
    }
    setOrigin(pt);
    setOriginLabel(addressInput);
  };

  /** Put every filter — categories, featured, diocese-only, search and the
   *  distance scope — back to the default, out-of-the-box state. */
  const resetFilters = () => {
    setActiveCats([]);
    setShowFeaturedOnly(false);
    setLocalOnly(false);
    setSearch("");
    setOrigin(null);
    setOriginLabel("");
    setAddressInput("");
    setGeoError(null);
    setRadius(UNITS[radiusUnit].def);
  };

  const clearRadius = () => {
    setOrigin(null);
    setOriginLabel("");
    setAddressInput("");
    setGeoError(null);
    setRadius(UNITS[radiusUnit].def);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError(t("home.noBrowserGeo"));
      return;
    }
    setGeoError(null);
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginLabel(t("home.yourLocation"));
        setAddressInput("");
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(err.message || t("home.noLocation"));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  // Before the visitor has picked a diocese we show a single, focused landing
  // screen whose only job is the "select your diocese" choice.
  if (!hasChosen) {
    return (
      <CalendarLayout>
        <Helmet>
          <title>The Catholic Calendar — Catholic Events, Masses & Parish Activities Near You</title>
          <meta
            name="description"
            content="One city, one calendar. Find Catholic events, Masses, Bible studies, retreats, and parish activities in your diocese."
          />
          <link rel="canonical" href="https://thecatholiccalendar.org/catholic-calendar" />
        </Helmet>
        <section className="px-5 py-16 md:py-24 max-w-3xl mx-auto text-center">
          <p className="font-body text-crimson uppercase tracking-[0.3em] text-xs mb-4">{t("home.eyebrow")}</p>
          <h1 className="font-display text-4xl md:text-6xl text-charcoal leading-tight">{t("brand.name")}</h1>
          <p className="mt-5 text-charcoal/70 max-w-2xl mx-auto">{t("home.subtitle")}</p>
          <div className="mt-10">
            <DiocesePicker variant="hero" />
          </div>
        </section>
      </CalendarLayout>
    );
  }

  return (
    <CalendarLayout>
      <Helmet>
        <title>Catholic Calendar — Catholic Events, Feast Days & Parish Activities Near You</title>
        <meta
          name="description"
          content="The Catholic Calendar — find Catholic events, feast days, retreats, Masses, and parish activities near you. Submit and share Catholic events across your community."
        />
        <link rel="canonical" href="https://thecatholiccalendar.org/catholic-calendar" />
        <meta property="og:title" content="Catholic Calendar — Catholic Events, Feast Days & Parish Activities Near You" />
        <meta property="og:description" content="Find Catholic events, feast days, retreats, and parish activities near you." />
        <meta property="og:url" content="https://thecatholiccalendar.org/catholic-calendar" />
      </Helmet>
      <section className="px-2.5 sm:px-5 py-3 md:py-5 w-full max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl text-charcoal leading-tight truncate">
              {dioceseShortName(diocese)}
            </h1>
            <p className="text-[11px] sm:text-xs text-charcoal/55 truncate">{dioceseName}</p>
          </div>
          <DiocesePicker className="shrink-0 max-w-none" />
        </div>

        <MontrealFreeNote className="mb-3" />




        {/* Toolbar — one neat bar */}
        <div className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-gold/40 bg-card px-2.5 py-2 shadow-sm">
            {/* Month / two-week nav */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMonthAnchor((m) => (gridSpan === "twoWeeks" ? addDays(m, -14) : addMonths(m, -1)))}
                className="p-1.5 rounded-full text-charcoal/70 hover:bg-muted"
                aria-label={t("home.prevMonth") as string}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="font-display text-base md:text-lg min-w-[120px] md:min-w-[150px] text-center leading-none">
                {gridSpan === "twoWeeks"
                  ? (() => {
                      const { start, end } = twoWeekWindow(monthAnchor);
                      return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
                    })()
                  : format(monthAnchor, "MMMM yyyy")}
              </h2>
              <button
                onClick={() => setMonthAnchor((m) => (gridSpan === "twoWeeks" ? addDays(m, 14) : addMonths(m, 1)))}
                className="p-1.5 rounded-full text-charcoal/70 hover:bg-muted"
                aria-label={t("home.nextMonth") as string}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  setMonthAnchor(gridSpan === "twoWeeks" ? now : startOfMonth(now));
                  setSelectedDate(now);
                }}
                className="ml-1 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-crimson border border-crimson/30 rounded-full hover:bg-crimson/10"
              >
                {t("home.today")}
              </button>
            </div>

            {/* Diocese-only toggle + week/month span switch */}
            <div className="flex items-center gap-2 order-last w-full md:order-none md:w-auto md:border-x md:border-border md:px-3">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-charcoal/75">
                <input
                  type="checkbox"
                  checked={localOnly}
                  onChange={(e) => {
                    setLocalOnly(e.target.checked);
                    if (e.target.checked) setShowFeaturedOnly(false);
                  }}
                  className="w-3.5 h-3.5 accent-crimson rounded border-border shrink-0"
                />
                <span className="leading-tight">{t("home.localOnly")}</span>
              </label>
              <button
                type="button"
                onClick={() => setLocalOnlyInfo((v) => !v)}
                title={t("home.localOnlyInfo") as string}
                aria-label={t("home.localOnlyInfo") as string}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-charcoal/30 text-[9px] font-bold text-charcoal/60 hover:bg-muted"
              >
                i
              </button>
            </div>


            {/* Search + views + filters */}
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("home.search") as string}
                  className="pl-7.5 pl-8 pr-2 py-1.5 border border-border rounded-full text-xs w-32 sm:w-44 bg-background focus:outline-none focus:ring-2 focus:ring-crimson/25"
                />
                {search.trim().length > 0 && (
                  <div className="absolute z-20 mt-1 left-0 right-0 sm:w-64 max-h-60 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                    {filtered.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-charcoal/60">{t("home.noMatches")}</div>
                    ) : (
                      filtered.slice(0, 12).map((e) => (
                        <Link
                          key={e.id}
                          to={`/catholic-calendar/event/${e.id}`}
                          className="block px-3 py-2 text-sm hover:bg-muted border-b border-border/40 last:border-0"
                        >
                          <div className="font-medium text-charcoal truncate">{e.title}</div>
                          <div className="text-xs text-charcoal/60 truncate">
                            {formatEventTime(e.start_at, "MMM d · h:mm a", e.diocese_slug)}
                            {e.venue_name ? ` · ${e.venue_name}` : ""}
                          </div>
                        </Link>
                      ))
                    )}
                    <button
                      onClick={() => setSearch("")}
                      className="w-full text-left px-3 py-1.5 text-xs text-charcoal/60 hover:bg-muted border-t border-border/60"
                    >
                      {t("home.clearSearch")}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex rounded-full border border-border overflow-hidden">
                {([
                  ["month", Grid3x3],
                  ["list", List],
                  ["map", MapIcon],
                ] as const).map(([v, Icon]) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`p-1.5 ${view === v ? "bg-crimson text-ivory" : "bg-card hover:bg-muted"}`}
                    aria-label={t(`home.views.${v}`) as string}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-border bg-card text-xs text-charcoal/80 hover:bg-muted"
                title={t("home.filters") as string}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("home.filters")}</span>
                {(activeCats.length > 0 || showFeaturedOnly || origin) && (
                  <span className="ml-0.5 px-1.5 py-0 rounded-full bg-crimson text-ivory text-[9px] font-bold">
                    {activeCats.length + (showFeaturedOnly ? 1 : 0) + (origin ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>
          </div>
          {localOnlyInfo && (
            <p className="mt-1.5 text-[11px] text-charcoal/65 bg-muted rounded-lg px-2.5 py-1.5">
              {t("home.localOnlyInfo")}
            </p>
          )}
        </div>

        {/* Filters modal — same look as the diocese picker */}
        {mobileFiltersOpen && (
          <div
            className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-sm flex items-start justify-center p-4 pt-[8vh]"
            onClick={() => setMobileFiltersOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-ivory border border-gold/40 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 bg-crimson text-ivory">
                <div>
                  <h2 className="font-display text-xl leading-tight">{t("home.filters")}</h2>
                  <p className="text-xs opacity-90">{t("home.results", { count: displayCount })}</p>
                </div>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label={t("common.close") as string}
                  className="shrink-0 rounded-full p-1.5 hover:bg-ivory/15 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[68vh] overflow-y-auto p-4 space-y-4 bg-ivory">
                {/* Category chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() =>
                      setShowFeaturedOnly((v) => {
                        if (!v) setLocalOnly(false);
                        return !v;
                      })
                    }
                    title={t("home.featuredHint") as string}
                    className={`px-2.5 py-1 rounded-full text-[11px] border transition-all inline-flex items-center gap-1 ${
                      showFeaturedOnly
                        ? "bg-gold text-charcoal border-gold font-bold"
                        : "bg-card text-charcoal/60 border-border hover:border-charcoal/40"
                    }`}
                  >
                    <Star className={`w-2.5 h-2.5 ${showFeaturedOnly ? "fill-charcoal" : ""}`} /> {t("home.featured")}
                  </button>
                  {CATEGORIES.map((c) => {
                    const active = activeCats.includes(c.value);
                    return (
                      <button
                        key={c.value}
                        onClick={() => toggleCat(c.value)}
                        className={`px-2.5 py-1 rounded-full text-[11px] border transition-all ${
                          active
                            ? CATEGORY_COLORS[c.value] + " font-bold"
                            : "bg-card text-charcoal/60 border-border hover:border-charcoal/40"
                        }`}
                      >
                        {categoryLabel(c.value)}
                      </button>
                    );
                  })}
                  {activeCats.length > 0 && (
                    <button onClick={() => setActiveCats([])} className="text-[11px] text-charcoal/50 underline">
                      {t("home.clear")}
                    </button>
                  )}
                </div>

                {/* Radius (location) filter */}
                <div className="rounded-xl border border-border bg-card p-3">
                  <form onSubmit={applyAddress} className="flex flex-col gap-2">
                    <div className="min-w-[140px]">
                      <label className="block text-[9px] font-bold uppercase tracking-wide text-charcoal/60 mb-0.5">
                        {t("home.findNear")}
                      </label>
                      <PlacesAutocomplete
                        value={addressInput}
                        onChange={(v) => setAddressInput(v)}
                        onSelect={(s) => {
                          setAddressInput(s.fullText || s.primaryText);
                          if (typeof s.lat === "number" && typeof s.lng === "number") {
                            setOrigin({ lat: s.lat, lng: s.lng });
                            setOriginLabel(s.primaryText || s.fullText);
                            setGeoError(null);
                          }
                        }}
                        placeholder={t("home.addressPlaceholder") as string}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wide text-charcoal/60 mb-0.5">
                        {t("home.within", { km: `${formatRadius(radius)} ${radiusUnit}` })}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={radiusToSlider(radius, radiusUnit)}
                        onChange={(e) => setRadius(sliderToRadius(Number(e.target.value), radiusUnit))}
                        className="w-full accent-crimson"
                      />
                      <div className="relative h-2 text-[9px] text-charcoal/40 mt-0.5">
                        <span className="absolute left-0">{UNITS[radiusUnit].min} {radiusUnit}</span>
                        <span className="absolute right-0">{UNITS[radiusUnit].max} {radiusUnit}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="submit"
                        disabled={geoLoading}
                        className="px-3 py-1.5 rounded-full bg-crimson text-ivory text-xs font-bold hover:bg-crimson-deep transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {geoLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                        {t("home.findNearby")}
                      </button>
                      {origin && (
                        <button
                          type="button"
                          onClick={clearRadius}
                          className="px-2 py-1.5 rounded-full border border-border text-charcoal/60 hover:text-charcoal"
                          aria-label={t("home.clearLocation") as string}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={useMyLocation}
                        disabled={geoLoading}
                        className="px-2.5 py-1.5 rounded-full border border-border text-charcoal/70 hover:text-charcoal hover:bg-muted text-xs inline-flex items-center gap-1"
                      >
                        <LocateFixed className="w-3.5 h-3.5" /> {t("home.useMyLocation")}
                      </button>
                    </div>
                  </form>
                  {origin && (
                    <p className="mt-1.5 text-[11px] text-charcoal/60">
                      {t("home.showingWithin")} <span className="font-bold text-crimson">{formatRadius(radius)} {radiusUnit}</span> {t("home.of")}{" "}
                      <span className="italic">{originLabel}</span>.
                    </p>
                  )}
                  {geoError && <p className="mt-1.5 text-[11px] text-destructive">{geoError}</p>}
                </div>
              </div>

              <div className="px-4 py-3 bg-card border-t border-gold/30 flex justify-between items-center gap-2">
                <button
                  onClick={resetFilters}
                  className="px-4 py-1.5 rounded-full border border-crimson/40 text-crimson text-xs font-bold hover:bg-crimson/10 inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> {t("home.resetFilters")}
                </button>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="px-4 py-1.5 rounded-full bg-crimson text-ivory text-xs font-bold hover:bg-crimson-deep"
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
          </div>
        )}



        <VerifiedCtx.Provider value={verifiedIds}>
        <HostNamesCtx.Provider value={hostNames}>
        {loading ? (
          <div className="py-20 text-center text-charcoal/50">{t("home.loadingEvents")}</div>
        ) : view === "month" ? (
          <MonthGrid
            anchor={monthAnchor}
            events={filtered}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            span={gridSpan}
            onChangeMonth={(delta) =>
              setMonthAnchor((m) => (gridSpan === "twoWeeks" ? addDays(m, delta * 14) : addMonths(m, delta)))
            }
          />

        ) : view === "list" ? (
          <EventList events={filtered} showPast={showPast} onToggleShowPast={() => setShowPast((v) => !v)} />
        ) : (
          <div className="lg:flex lg:items-start lg:gap-4">
            <div className="min-w-0 flex-1">
              <EventsMap events={mapEvents} origin={origin} radiusKm={radiusKm} center={{ lat: diocese.lat, lng: diocese.lng }} scopeSlugs={scopeSlugs} hostNames={hostNames} dioceseSlug={diocese.slug} />
            </div>
            <NationalInvites events={filtered} />
          </div>
        )}
        </HostNamesCtx.Provider>
        </VerifiedCtx.Provider>
      </section>
    </CalendarLayout>
  );
}

// Priority order for any list of events on the same day:
// 1) verified organizer + paid featured slot
// 2) verified organizer
// 3) unverified + paid featured slot
// 4) unverified
// Ties broken by start time.
function priorityCompare(verifiedIds: Set<string>) {
  const tier = (e: Ev) => {
    const v = !!e.submitted_by_user_id && verifiedIds.has(e.submitted_by_user_id);
    if (v && e.is_featured) return 0;
    if (v) return 1;
    if (e.is_featured) return 2;
    return 3;
  };
  return (a: Ev, b: Ev) => {
    const broadcast = broadcastPriority(a) - broadcastPriority(b);
    if (broadcast !== 0) return broadcast;
    const t = tier(a) - tier(b);
    if (t !== 0) return t;
    return parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime();
  };
}

const LANE_CAP = 4;


type Bar = { ev: Ev; col: number; span: number; lane: number };

// Lay out a week's events as continuous bars: multi-day events stretch across
// the days they cover, each on its own lane.
function weekLayout(week: Date[], byDay: Map<string, Ev[]>, verifiedIds: Set<string>, laneCap = LANE_CAP) {
  const cols = week.map((d) => byDay.get(format(d, "yyyy-MM-dd")) ?? []);
  const seen = new Map<string, Ev>();
  cols.forEach((list) => list.forEach((e) => { if (!seen.has(e.id)) seen.set(e.id, e); }));

  const raw = Array.from(seen.values())
    .map((ev) => {
      const idxs = cols.map((l, i) => (l.some((e) => e.id === ev.id) ? i : -1)).filter((i) => i >= 0);
      return { ev, col: idxs[0], span: idxs[idxs.length - 1] - idxs[0] + 1 };
    })
    .sort((a, b) => (b.span - a.span) || (a.col - b.col) || priorityCompare(verifiedIds)(a.ev, b.ev));

  const occupied: boolean[][] = [];
  const bars: Bar[] = [];
  for (const r of raw) {
    let lane = 0;
    for (;; lane++) {
      if (!occupied[lane]) occupied[lane] = new Array(7).fill(false);
      const free = occupied[lane].slice(r.col, r.col + r.span).every((v) => !v);
      if (free) {
        for (let i = r.col; i < r.col + r.span; i++) occupied[lane][i] = true;
        break;
      }
    }
    bars.push({ ...r, lane });
  }

  const hiddenByDay = new Map<string, number>();
  bars.forEach((b) => {
    if (b.lane < laneCap) return;
    for (let i = b.col; i < b.col + b.span; i++) {
      const key = format(week[i], "yyyy-MM-dd");
      hiddenByDay.set(key, (hiddenByDay.get(key) ?? 0) + 1);
    }
  });

  return { bars, lanes: occupied.length, hiddenByDay };
}

function MonthGrid({

  anchor, events, selectedDate, onSelectDate, onChangeMonth, span = "month",
}: {
  anchor: Date;
  events: Ev[];
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
  onChangeMonth: (delta: number) => void;
  span?: "month" | "twoWeeks";
}) {
  const { t, i18n } = useTranslation();
  const { isCityGroup } = useDiocese();
  const weekdaysShort = t("home.weekdaysShort", { returnObjects: true }) as string[];
  const weekdaysLong = t("home.weekdaysLong", { returnObjects: true }) as string[];
  const verifiedIds = useVerified();
  const isMobile = useIsMobile();
  const isTwoWeeks = span === "twoWeeks";
  // Two-week view trades density for readability: taller bars, full event names.
  const BAR_H = isTwoWeeks ? (isMobile ? 52 : 64) : isMobile ? 28 : 38;
  const BAR_GAP = isTwoWeeks ? 6 : 3;
  // Leaves room for the full day-number circle (today's crimson badge included).
  const HEADER_OFFSET = isTwoWeeks ? (isMobile ? 26 : 34) : isMobile ? 28 : 36;
  const hostNames = useHostNames();
  const hostLabel = useCallback(
    (ev: Ev) =>
      ev.parish ||
      (ev.submitted_by_user_id ? hostNames.get(ev.submitted_by_user_id) : null) ||
      ev.guest_name ||
      null,
    [hostNames],
  );
  const MIN_ROW_H = isTwoWeeks ? (isMobile ? 160 : 200) : isMobile ? 58 : 74;
  const laneCap = isTwoWeeks ? 4 : LANE_CAP;

  const start = span === "twoWeeks"
    ? startOfWeek(anchor, { weekStartsOn: 0 })
    : startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  const end = span === "twoWeeks"
    ? addDays(start, 13)
    : endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });
  const weeks = useMemo(
    () => Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => days.slice(i * 7, i * 7 + 7)),
    [start.getTime(), end.getTime()],
  );


  const byDay = useMemo(() => {
    const map = new Map<string, Ev[]>();
    for (const e of events) {
      // Group by the event's own local calendar day (its diocese time zone),
      // not the viewer's browser time zone.
      const tz = zoneForSlug(e.diocese_slug);
      const startKey = zonedDayKey(e.start_at, tz);
      let endKey = e.end_at ? zonedDayKey(e.end_at, tz) : startKey;
      if (endKey < startKey) endKey = startKey;
      let key = startKey;
      for (let guard = 0; guard < 400; guard++) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
        if (key >= endKey) break;
        key = nextDayKey(key);
      }
    }
    for (const [, list] of map) {
      list.sort(priorityCompare(verifiedIds));
    }
    return map;
  }, [events, verifiedIds]);

  const dayEvents = selectedDate ? byDay.get(format(selectedDate, "yyyy-MM-dd")) ?? [] : [];

  // Swipe left/right on the calendar to change months.
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; t: number } | null>(null);


  return (
    <div className="min-w-0 max-w-full">
      <div
        className="max-w-full min-w-0 border border-border rounded-lg bg-card overflow-hidden touch-pan-y"
        onTouchStart={(e) => {
          const t = e.touches[0];
          setTouchStart({ x: t.clientX, y: t.clientY, t: Date.now() });
        }}
        onTouchEnd={(e) => {
          if (!touchStart) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - touchStart.x;
          const dy = t.clientY - touchStart.y;
          const dt = Date.now() - touchStart.t;
          setTouchStart(null);
          // Horizontal swipe > 50px, mostly horizontal, under 600ms.
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600) {
            onChangeMonth(dx < 0 ? 1 : -1);
          }
        }}
      >
        {/* Full-width month grid with continuous bars for multi-day events. */}
        <div>
          <div className="grid grid-cols-7 bg-muted text-[10px] md:text-xs font-bold text-charcoal/60 uppercase">
            {weekdaysShort.map((d, i) => (
              <div key={i} className="p-1.5 md:p-2.5 text-center">
                <span className="md:hidden">{d}</span>
                <span className="hidden md:inline">{weekdaysLong[i]}</span>
              </div>
            ))}
          </div>
          {weeks.map((week) => {
            const layout = weekLayout(week, byDay, verifiedIds, laneCap);
            const shownLanes = Math.min(layout.lanes, laneCap);
            // Quiet weeks get taller bars so the full event name can be read
            // on the day itself instead of being truncated.
            const sparse = isTwoWeeks || layout.bars.length <= 3;
            const barH = isTwoWeeks ? BAR_H : sparse ? BAR_H + 16 : BAR_H;
            const barsHeight = Math.max(shownLanes * (barH + BAR_GAP) + 10, MIN_ROW_H);
            const rowHeight = HEADER_OFFSET + barsHeight;

            if (isTwoWeeks) {
              return (
                <div
                  key={format(week[0], "yyyy-MM-dd")}
                  className="grid grid-cols-7"
                  style={{ gridTemplateRows: `${HEADER_OFFSET}px repeat(${shownLanes}, minmax(${barH}px, auto))` }}
                >
                  {/* Each full day cell is one clickable rectangle spanning every lane. */}
                  {week.map((d) => {
                    const key = format(d, "yyyy-MM-dd");
                    const isSelected = selectedDate && isSameDay(d, selectedDate);
                    const isToday = isSameDay(d, new Date());
                    const hidden = layout.hiddenByDay.get(key) ?? 0;
                    return (
                      <button
                        key={key}
                        onClick={() => onSelectDate(isSelected ? null : d)}
                        className={`relative flex flex-col items-start justify-start border-t border-l border-border text-left transition-colors overflow-hidden ${
                          isSelected ? "ring-2 ring-crimson ring-inset" : "hover:bg-muted/60"
                        } bg-card`}
                        style={{ gridRow: `1 / span ${shownLanes + 1}`, gridColumn: `${week.indexOf(d) + 1}` }}
                      >
                        <span
                          className={`m-1 md:m-1.5 inline-flex items-center justify-center rounded-full font-bold leading-none text-[11px] md:text-sm ${
                            isToday ? "bg-crimson text-ivory w-5 h-5 md:w-6 md:h-6" : ""
                          }`}
                          style={isToday ? undefined : { width: "1.25rem", height: "1.25rem" }}
                        >
                          {format(d, "d")}
                        </span>
                        {hidden > 0 && (
                          <span className="mt-auto mb-1 ml-1 text-[9px] md:text-[10px] font-bold text-crimson">
                            +{hidden} {t("home.plusMore")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {/* Event bars are painted on top but cannot intercept pointer events. */}
                  {layout.bars
                    .filter((b) => b.lane < laneCap)
                    .map((b) => {
                      const ev = b.ev;
                      const host = hostLabel(ev);
                      const accent =
                        isBroadcastEvent(ev)
                          ? ev.audience_scope === "national"
                            ? "hsl(var(--crimson))"
                            : ev.audience_scope === "regional"
                              ? "hsl(var(--gold))"
                              : "hsl(var(--charcoal))"
                          : ev.is_featured
                            ? "hsl(var(--gold))"
                            : "hsl(var(--crimson))";
                      return (
                        <div
                          key={`${ev.id}-${b.col}`}
                          aria-hidden
                          title={host ? `${ev.title} — ${host}` : ev.title}
                          className={`pointer-events-none relative z-50 m-[2px] rounded-[3px] px-1 md:px-1.5 py-[2px] leading-tight shadow-sm ${
                            CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS.other
                          }`}
                          style={{
                            gridColumn: `${b.col + 1} / span ${b.span}`,
                            gridRow: `${b.lane + 2}`,
                            borderLeft: `3px solid ${accent}`,
                          }}
                        >
                          <span className="block font-bold text-[10px] md:text-[14px] whitespace-normal break-words leading-tight">
                            {ev.title}
                          </span>
                          <span className="flex items-center gap-1 mt-0.5 text-[8px] md:text-[10px] font-bold uppercase tracking-wide opacity-80">
                            {isBroadcastEvent(ev) && <Globe className="w-2 h-2 md:w-2.5 md:h-2.5 shrink-0" />}
                            {ev.is_featured && <Star className="w-2 h-2 md:w-2.5 md:h-2.5 fill-gold text-gold shrink-0" />}
                            <span className="truncate">{formatEventTime(ev.start_at, "h:mm a", ev.diocese_slug)}</span>
                          </span>
                          {host && (
                            <span className="block truncate text-[8px] md:text-[10px] opacity-75">{host}</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            }

            return (
              <div
                key={format(week[0], "yyyy-MM-dd")}
                className="relative grid grid-cols-7"
                style={{ minHeight: rowHeight }}
              >
                {/* Each full day cell is one clickable rectangle. */}
                {week.map((d) => {
                  const key = format(d, "yyyy-MM-dd");
                  const inMonth = isSameMonth(d, anchor);
                  const isSelected = selectedDate && isSameDay(d, selectedDate);
                  const isToday = isSameDay(d, new Date());
                  const hidden = layout.hiddenByDay.get(key) ?? 0;
                  return (
                    <button
                      key={key}
                      onClick={() => onSelectDate(isSelected ? null : d)}
                      className={`relative h-full min-h-0 flex flex-col items-start justify-start border-t border-l border-border text-left transition-colors overflow-hidden ${
                        inMonth ? "bg-card" : "bg-muted/40 text-charcoal/40"
                      } ${isSelected ? "ring-2 ring-crimson ring-inset" : "hover:bg-muted/60"}`}
                    >
                      <span
                        className={`m-1 md:m-1.5 inline-flex items-center justify-center rounded-full font-bold leading-none text-[11px] md:text-sm ${
                          isToday ? "bg-crimson text-ivory w-5 h-5 md:w-6 md:h-6" : ""
                        }`}
                        style={isToday ? undefined : { width: "1.25rem", height: "1.25rem" }}
                      >
                        {format(d, "d")}
                      </span>
                      {hidden > 0 && (
                        <span className="absolute bottom-0.5 left-1 text-[9px] md:text-[10px] font-bold text-crimson">
                          +{hidden}
                        </span>
                      )}
                    </button>
                  );
                })}
                {/* Event bars are painted on top but cannot intercept pointer events. */}
                <div
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{ top: HEADER_OFFSET, height: barsHeight }}
                >
                  {layout.bars
                    .filter((b) => b.lane < laneCap)
                    .map((b) => {
                      const ev = b.ev;
                      const host = hostLabel(ev);
                      const accent =
                        isBroadcastEvent(ev)
                          ? ev.audience_scope === "national"
                            ? "hsl(var(--crimson))"
                            : ev.audience_scope === "regional"
                              ? "hsl(var(--gold))"
                              : "hsl(var(--charcoal))"
                          : ev.is_featured
                            ? "hsl(var(--gold))"
                            : "hsl(var(--crimson))";
                      return (
                        <div
                          key={`${ev.id}-${b.col}`}
                          aria-hidden
                          title={host ? `${ev.title} — ${host}` : ev.title}
                          className={`absolute overflow-hidden rounded-[3px] pl-1.5 pr-1 py-[2px] leading-tight shadow-sm ${
                            CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS.other
                          }`}
                          style={{
                            left: `calc(${(b.col / 7) * 100}% + 3px)`,
                            width: `calc(${(b.span / 7) * 100}% - 6px)`,
                            top: b.lane * (barH + BAR_GAP),
                            height: barH,
                            borderLeft: `3px solid ${accent}`,
                          }}
                        >
                          <span className="flex items-center gap-1 text-[8px] md:text-[10px] font-bold uppercase tracking-wide opacity-80">
                            {isBroadcastEvent(ev) && <Globe className="w-2 h-2 md:w-2.5 md:h-2.5 shrink-0" />}
                            {ev.is_featured && <Star className="w-2 h-2 md:w-2.5 md:h-2.5 fill-gold text-gold shrink-0" />}
                            <span className="truncate">{formatEventTime(ev.start_at, "h:mm a", ev.diocese_slug)}</span>
                          </span>
                          <span
                            className={`block font-bold ${
                              sparse
                                ? "text-[9px] md:text-[11px] whitespace-normal break-words line-clamp-2"
                                : "text-[9px] md:text-[11px] truncate"
                            }`}
                          >
                            {ev.title}
                          </span>
                          {!isMobile && host && (
                            <span className="block truncate text-[9px] opacity-70">{host}</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}

        </div>


      </div>

      {/* Day events — pops up like the diocese picker */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 bg-charcoal/70 backdrop-blur-md flex items-start justify-center p-4 pt-[7vh] animate-fade-in"
          onClick={() => onSelectDate(null)}
        >
          <div
            className="w-full max-w-lg rounded-[22px] bg-ivory border border-gold/50 shadow-[0_30px_80px_-20px_hsl(var(--charcoal)/0.7)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-crimson-deep via-crimson to-crimson-deep text-ivory">
              <div className="absolute inset-0 opacity-[0.18] bg-[radial-gradient(circle_at_15%_10%,rgba(255,255,255,0.6),transparent_45%),radial-gradient(circle_at_85%_90%,rgba(212,175,55,0.7),transparent_50%)]" />
              <div className="relative flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex items-center gap-3.5">
                  <div className="shrink-0 w-12 rounded-xl bg-ivory text-charcoal text-center overflow-hidden shadow-md">
                    <div className="bg-gold/90 text-[9px] uppercase tracking-[0.18em] font-body py-0.5">
                      {format(selectedDate, "MMM")}
                    </div>
                    <div className="font-display text-xl leading-none py-1.5">{format(selectedDate, "d")}</div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl leading-tight truncate">
                      {format(selectedDate, "EEEE")}
                    </h3>
                    <p className="text-ivory/75 text-[11px] font-body mt-0.5">
                      {dayEvents.length === 1
                        ? t("map.eventFallback")
                        : t("map.eventsHere", { count: dayEvents.length })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onSelectDate(null)}
                  aria-label={t("common.close") as string}
                  className="shrink-0 rounded-full p-2 bg-ivory/10 hover:bg-ivory/25 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
            </div>

            <div className="px-5 py-2 bg-card border-b border-gold/25">
              <p className="text-[11px] font-body text-charcoal/55 inline-flex items-center gap-1.5">
                <VerifiedBadge size={12} />
                <span>{t("home.verifiedLegend")}</span>
              </p>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-3 sm:p-4 space-y-3 bg-ivory">
              {dayEvents.length === 0 ? (
                <p className="text-sm text-charcoal/55 text-center py-8 font-body">{t("home.nothingScheduled")}</p>
              ) : (
                buildDayItems(dayEvents).map((item) => (
                  <DayEventCard key={item.ev.id} item={item} />
                ))
              )}
            </div>

          </div>
        </div>
      )}

    </div>

  );
}

function MobileAgenda({
  anchor,
  byDay,
  onSelectDate,
  selectedDate,
}: {
  anchor: Date;
  byDay: Map<string, Ev[]>;
  onSelectDate: (d: Date | null) => void;
  selectedDate: Date | null;
}) {
  const { t, i18n } = useTranslation();
  const { isCityGroup } = useDiocese();
  const monthDays = eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
  const daysWithEvents = monthDays.filter((d) => (byDay.get(format(d, "yyyy-MM-dd")) ?? []).length > 0);
  const today = startOfDay(new Date());

  if (daysWithEvents.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-charcoal/60">
        {t("home.noMatches")} — {format(anchor, "MMMM yyyy")}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {daysWithEvents.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const evs = byDay.get(key) ?? [];
        const isToday = isSameDay(d, new Date());
        const isPastDay = startOfDay(d) < today;
        return (
          <div key={key} className={`px-3 py-3 ${isPastDay ? "opacity-60" : ""}`}>
            <button
              onClick={() => onSelectDate(selectedDate && isSameDay(selectedDate, d) ? null : d)}
              className="w-full flex items-baseline gap-3 mb-2 text-left"
            >
              <span className={`font-display text-2xl leading-none ${isToday ? "text-crimson" : "text-charcoal"}`}>
                {format(d, "d")}
              </span>
              <span className="font-body uppercase tracking-widest text-[10px] text-charcoal/60">
                {format(d, "EEE")}
              </span>
              {isToday && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-crimson">{t("home.today")}</span>
              )}
            </button>
            <div className="space-y-1.5">
              {evs.map((ev) => {
                const eventDiocese = isCityGroup && ev.diocese_slug ? getDiocese(ev.diocese_slug) : null;
                const eventDioceseName = eventDiocese ? dioceseName(eventDiocese, i18n.language) : null;
                return (
                  <Link
                    key={ev.id}
                    to={`/catholic-calendar/event/${ev.id}`}
                    className={`block rounded-md border px-2.5 py-1.5 text-xs leading-snug ${
                      CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS.other
                    } ${ev.is_featured ? "ring-1 ring-gold" : ""} ${
                      isBroadcastEvent(ev) ? `ring-2 ${ev.audience_scope === "national" ? "ring-crimson bg-crimson/5" : ev.audience_scope === "regional" ? "ring-gold bg-gold/10" : "ring-charcoal bg-charcoal/5"}` : ""
                    }`}
                  >
                    {isBroadcastEvent(ev) && (
                      <div className={`mb-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${broadcastBadgeClasses(ev)}`}>
                        <Globe className="w-2.5 h-2.5" />
                        {t(broadcastBadgeKey(ev))}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      {ev.is_featured && <Star className="w-3 h-3 fill-gold text-gold shrink-0" />}
                      <span className="font-bold truncate">{ev.title}</span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      {formatEventTime(ev.start_at, "h:mm a", ev.diocese_slug)}
                      {ev.venue_name ? ` · ${ev.venue_name}` : ""}
                    </div>
                    {eventDioceseName && (
                      <div className="text-[10px] text-crimson/80 font-medium mt-0.5 truncate" title={eventDioceseName}>
                        {eventDioceseName}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventList({
  events,
  showPast,
  onToggleShowPast,
}: {
  events: Ev[];
  showPast: boolean;
  onToggleShowPast: () => void;
}) {
  const { t } = useTranslation();
  const verifiedIds = useVerified();
  const today = startOfDay(new Date());

  // Expand multi-day events into one occurrence per day.
  type Occ = { ev: Ev; day: Date; totalDays: number; dayIndex: number };
  const occurrences: Occ[] = [];
  for (const e of events) {
    const startD = parseISO(e.start_at);
    const endD = e.end_at ? parseISO(e.end_at) : startD;
    const from = startOfDay(startD);
    const to = startOfDay(endD < startD ? startD : endD);
    const days = eachDayOfInterval({ start: from, end: to });
    days.forEach((day, i) => {
      occurrences.push({ ev: e, day, totalDays: days.length, dayIndex: i });
    });
  }

  const upcoming = occurrences.filter((o) => o.day >= today);
  const past = occurrences.filter((o) => o.day < today);

  const visible = showPast ? past.sort((a, b) => b.day.getTime() - a.day.getTime()) : upcoming.sort((a, b) => a.day.getTime() - b.day.getTime());

  const groups = visible.reduce<Record<string, Occ[]>>((acc, o) => {
    const key = format(o.day, "EEEE, MMMM d, yyyy");
    (acc[key] ||= []).push(o);
    return acc;
  }, {});
  // Sort each day's events: verified+featured → verified → unverified+featured → unverified.
  const cmp = priorityCompare(verifiedIds);
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => cmp(a.ev, b.ev));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5">
        <p className="text-xs text-charcoal/60">
          {showPast ? t("home.showingPast") : t("home.showingUpcoming")}
        </p>
        <button
          onClick={onToggleShowPast}
          className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted text-charcoal/80"
        >
          {showPast ? t("home.backToUpcoming") : t("home.showPast")}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="py-20 text-center text-charcoal/50">
          {showPast ? t("home.noPast") : t("home.noUpcomingMatch")}
        </div>
      ) : (
        <div className="divide-y divide-gold/25 border-y border-gold/25">
          {Object.entries(groups).map(([day, occs]) => {
            const d = occs[0].day;
            return (
              <div key={day} className="flex gap-3 md:gap-5 py-4">
                <div className="shrink-0 w-20 md:w-24 rounded-xl bg-charcoal text-ivory px-2 py-3 text-center h-fit">
                  <div className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.08em] text-gold truncate">
                    {format(d, "EEEE")}
                  </div>
                  <div className="text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-ivory/70">
                    {format(d, "MMMM")}
                  </div>
                  <div className="font-display text-3xl md:text-4xl leading-none mt-1">{format(d, "d")}</div>
                </div>
                <div className="min-w-0 flex-1 divide-y divide-gold/20">
                  {occs.map((o) => (
                    <AgendaItem
                      key={`${o.ev.id}-${o.day.toISOString()}`}
                      ev={o.ev}
                      dayBadge={o.totalDays > 1 ? t("home.dayOf", { day: o.dayIndex + 1, total: o.totalDays }) : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

function MapPlaceholder({ events }: { events: Ev[] }) {
  const { t } = useTranslation();
  const byVenue = events.reduce<Record<string, Ev[]>>((acc, e) => {
    const key = e.venue_name || e.address || t("home.locationTbd");
    (acc[key] ||= []).push(e);
    return acc;
  }, {});
  return (
    <div>
      <div className="rounded-lg border border-dashed border-gold/50 bg-gold/5 p-6 text-sm text-charcoal/70 mb-6">
        {t("home.mapNotice")}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {Object.entries(byVenue).map(([venue, evs]) => (
          <div key={venue} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h4 className="font-display text-lg">{venue}</h4>
                {evs[0].address && <p className="text-xs text-charcoal/60">{evs[0].address}</p>}
              </div>
              {(evs[0].address || evs[0].venue_name) && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${evs[0].venue_name ?? ""} ${evs[0].address ?? ""}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-xs text-crimson hover:underline"
                >
                  <MapPin className="w-3 h-3" /> {t("home.maps")}
                </a>
              )}
            </div>
            <div className="space-y-1.5 max-h-[22rem] overflow-y-auto pr-1">
              {evs.map((e) => <EventRow key={e.id} ev={e} compact />)}
            </div>
            {evs.length > 4 && (
              <p className="mt-1 text-[11px] text-charcoal/50">
                {t("home.eventsCountScroll", { count: evs.length })}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Clickable organizer chip that opens the organizer's public profile. */
function OrganizerLink({ ev, verified }: { ev: Ev; verified: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const hostNames = useHostNames();
  const name =
    (ev.submitted_by_user_id ? hostNames.get(ev.submitted_by_user_id) : null) ||
    ev.parish ||
    ev.guest_name;
  if (!ev.submitted_by_user_id || !verified) {
    return name ? (
      <span className="text-xs md:text-sm text-charcoal/70">{t("home.by")} {name}</span>
    ) : null;
  }
  if (!name) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/catholic-calendar/organizers/${ev.submitted_by_user_id}`, {
          state: { backTo: `${location.pathname}${location.search}`, backLabel: "back" },
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-crimson/30 bg-crimson/5 px-2.5 py-1 text-xs font-semibold text-crimson hover:bg-crimson/10 hover:border-crimson/60 transition-colors"
    >
      <Building2 className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate max-w-[220px]">{name}</span>
    </button>
  );
}

/** Agenda-style list entry: entire card is clickable; nested buttons stop propagation. */
function AgendaItem({ ev, dayBadge }: { ev: Ev; dayBadge?: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const categoryLabel = useCategoryLabel();
  const verifiedIds = useVerified();
  const verified = !!ev.submitted_by_user_id && verifiedIds.has(ev.submitted_by_user_id);
  const { isCityGroup } = useDiocese();
  const eventDiocese = isCityGroup && ev.diocese_slug ? getDiocese(ev.diocese_slug) : null;
  const eventDioceseName = eventDiocese ? dioceseName(eventDiocese, i18n.language) : null;
  const [mapOpen, setMapOpen] = useState(false);
  const locationLabel = [ev.venue_name, ev.address].filter(Boolean).join(" · ");
  const details = [
    formatEventTime(ev.start_at, "h:mm a", ev.diocese_slug) +
      (ev.venue_name ? ` — ${ev.venue_name}` : ""),
  ].filter(Boolean) as string[];

  const accentClass = isBroadcastEvent(ev)
    ? ev.audience_scope === "national"
      ? "border-l-crimson"
      : ev.audience_scope === "regional"
        ? "border-l-gold"
        : "border-l-charcoal"
    : ev.is_featured
      ? "border-l-gold"
      : "border-l-crimson";

  const goToEvent = () => navigate(`/catholic-calendar/event/${ev.id}`);

  return (
    <div className={`py-4 first:pt-0 last:pb-0 pl-3 md:pl-4 -ml-3 md:-ml-4 border-l-4 ${accentClass}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={goToEvent}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goToEvent();
          }
        }}
        className="group block rounded-xl border border-border bg-card p-3 md:p-4 shadow-sm hover:shadow transition-shadow cursor-pointer"
      >
        <h4 className="font-display text-lg md:text-2xl uppercase tracking-tight text-charcoal leading-tight group-hover:text-crimson transition-colors inline">
          {ev.title}
        </h4>{" "}
        <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
          <span className={`rounded-md px-2 py-0.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wide border ${CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS.other}`}>
            {categoryLabel(ev.category)}
          </span>
          {isBroadcastEvent(ev) && (
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wide ${broadcastBadgeClasses(ev)}`}>
              <Globe className="w-2.5 h-2.5" />
              {t(broadcastBadgeKey(ev))}
            </span>
          )}
          {ev.is_featured && <Star className="w-3.5 h-3.5 fill-gold text-gold" />}
          {verified && <VerifiedBadge size={15} />}
          <EventVideoButton title={ev.title} video={ev.video_url} variant="chip" />
          {dayBadge && (
            <span className="rounded-md bg-gold/20 border border-gold/50 px-2 py-0.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wide text-charcoal">
              {dayBadge}
            </span>
          )}
        </span>
        <ul className="mt-2 space-y-1">
          {details.map((line, i) => (
            <li key={i} className="flex gap-2 text-xs md:text-sm text-charcoal/75">
              <span className="text-gold">•</span>
              <span className="min-w-0">{line}</span>
            </li>
          ))}
          {eventDioceseName && (
            <li className="flex gap-2 text-xs md:text-sm text-crimson/80">
              <span className="text-gold">•</span>
              <span className="min-w-0 truncate">{eventDioceseName}</span>
            </li>
          )}
        </ul>
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <OrganizerLink ev={ev} verified={verified} />
        </div>
        {locationLabel && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMapOpen(true);
            }}
            className="relative z-10 group mt-3 w-full flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left hover:border-crimson/40 hover:bg-crimson/[0.03] transition-colors"
            aria-label={t("home.viewMap")}
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-crimson/10 flex items-center justify-center group-hover:bg-crimson/20 transition-colors">
              <MapPin className="w-4 h-4 text-crimson" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-crimson group-hover:underline">
                {t("home.viewMap")}
              </p>
              <p className="text-sm text-charcoal/80 break-words leading-snug">
                {locationLabel}
              </p>
            </div>
          </button>
        )}
        {verified && (
          <div className="relative z-10 mt-3 pt-3 border-t border-gold/20" onClick={(e) => e.stopPropagation()}>
            <InterestedButton eventId={ev.id} eventTitle={ev.title} />
          </div>
        )}
        {mapOpen && (
          <LocationMapDialog
            title={ev.title}
            label={locationLabel}
            lat={ev.latitude}
            lng={ev.longitude}
            onClose={() => setMapOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ---- Day pop-up list ------------------------------------------------------

type DayItem = { ev: Ev; multiDay: boolean; overlaps: boolean };

/** Sort a day's events chronologically and flag multi-day / overlapping ones. */
function buildDayItems(evs: Ev[]): DayItem[] {
  const range = (e: Ev) => {
    const s = parseISO(e.start_at).getTime();
    const raw = e.end_at ? parseISO(e.end_at).getTime() : s + 60 * 60 * 1000;
    return [s, Math.max(raw, s + 15 * 60 * 1000)] as const;
  };
  const sorted = [...evs].sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime());
  return sorted.map((ev) => {
    const [s, e] = range(ev);
    const tz = zoneForSlug(ev.diocese_slug);
    const multiDay = !!ev.end_at && zonedDayKey(ev.end_at, tz) !== zonedDayKey(ev.start_at, tz);
    const overlaps = sorted.some((o) => {
      if (o.id === ev.id) return false;
      const [os, oe] = range(o);
      return os < e && oe > s;
    });
    return { ev, multiDay, overlaps };
  });
}

function DayEventCard({ item }: { item: DayItem }) {
  const { ev, multiDay, overlaps } = item;
  const { t, i18n } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const verifiedIds = useVerified();
  const verified = !!ev.submitted_by_user_id && verifiedIds.has(ev.submitted_by_user_id);
  const { isCityGroup } = useDiocese();
  const eventDiocese = isCityGroup && ev.diocese_slug ? getDiocese(ev.diocese_slug) : null;
  const [mapOpen, setMapOpen] = useState(false);
  const locationLabel = [ev.venue_name, ev.address].filter(Boolean).join(" · ");

  const accent = isBroadcastEvent(ev)
    ? ev.audience_scope === "national"
      ? "border-l-crimson"
      : ev.audience_scope === "regional"
        ? "border-l-gold"
        : "border-l-charcoal"
    : ev.is_featured
      ? "border-l-gold"
      : "border-l-crimson";

  return (
    <div
      className={`rounded-2xl border bg-card border-l-[5px] ${accent} shadow-sm transition-shadow hover:shadow-md ${
        overlaps || multiDay ? "border-gold/70 ring-1 ring-gold/40" : "border-border"
      }`}
    >
      <Link to={`/catholic-calendar/event/${ev.id}`} className="flex gap-3 p-3 sm:p-4 min-h-[56px]">
        <div className="shrink-0 text-center">
          <div className="rounded-lg bg-crimson/10 border border-crimson/25 px-2 py-1.5 min-w-[68px]">
            <div className="font-body text-sm font-bold text-crimson leading-none">
              {formatEventTime(ev.start_at, "h:mm", ev.diocese_slug)}
            </div>
            <div className="font-body text-[10px] uppercase tracking-widest text-crimson/70 mt-0.5">
              {formatEventTime(ev.start_at, "a", ev.diocese_slug)}
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-body text-[15px] sm:text-base font-bold text-charcoal leading-snug break-words">
            {ev.title}
            {verified && <VerifiedBadge size={15} className="inline-block ml-1.5 align-[-2px]" />}
          </h4>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS.other
              }`}
            >
              {categoryLabel(ev.category)}
            </span>
            {multiDay && (
              <span className="rounded-md bg-gold/20 border border-gold/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal">
                {t("home.multiDay")}
              </span>
            )}
            {overlaps && (
              <span className="rounded-md bg-crimson/10 border border-crimson/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-crimson">
                {t("home.overlapping")}
              </span>
            )}
            {isBroadcastEvent(ev) && (
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${broadcastBadgeClasses(ev)}`}
              >
                <Globe className="w-2.5 h-2.5" />
                {t(broadcastBadgeKey(ev))}
              </span>
            )}
            <EventVideoButton title={ev.title} video={ev.video_url} variant="chip" />
            {ev.event_languages && ev.event_languages.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-gold/15 border border-gold/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-charcoal">
                <Languages className="w-2.5 h-2.5" />
                {eventLanguagesLabel(ev.event_languages)}
              </span>
            )}
            {eventDiocese && (
              <span className="text-[11px] font-body text-crimson/80">
                {dioceseMiniName(eventDiocese, i18n.language)}
              </span>
            )}
          </div>
        </div>
      </Link>
      <div className="px-3 sm:px-4 pb-3 -mt-1">
        <OrganizerLink ev={ev} verified={verified} />
      </div>
      {locationLabel && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMapOpen(true);
          }}
          className="group w-full flex items-center gap-3 px-3 sm:px-4 py-3 min-h-[52px] border-t border-border/70 text-left rounded-b-2xl hover:bg-muted transition-colors"
          aria-label={t("home.viewMap")}
        >
          <div className="shrink-0 w-8 h-8 rounded-full bg-crimson/10 flex items-center justify-center group-hover:bg-crimson/20 transition-colors">
            <MapPin className="w-4 h-4 text-crimson" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-crimson group-hover:underline">
              {t("home.viewMap")}
            </p>
            <p className="text-[13px] text-charcoal/80 break-words leading-snug">
              {locationLabel}
            </p>
          </div>
        </button>
      )}
      {mapOpen && (
        <LocationMapDialog
          title={ev.title}
          label={locationLabel}
          lat={ev.latitude}
          lng={ev.longitude}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}

function EventRow({ ev, compact, dayBadge }: { ev: Ev; compact?: boolean; dayBadge?: string }) {

  const { t, i18n } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const verifiedIds = useVerified();
  const verified = !!ev.submitted_by_user_id && verifiedIds.has(ev.submitted_by_user_id);
  const { isCityGroup } = useDiocese();
  const eventDiocese = isCityGroup && ev.diocese_slug ? getDiocese(ev.diocese_slug) : null;
  const eventDioceseName = eventDiocese ? dioceseName(eventDiocese, i18n.language) : null;
  return (
    <Link
      to={`/catholic-calendar/event/${ev.id}`}
      className={`relative block p-3 rounded-md border bg-background hover:bg-card transition-colors ${
        isBroadcastEvent(ev)
          ? ev.audience_scope === "national"
            ? "border-crimson ring-2 ring-crimson/50 bg-crimson/[0.04] hover:border-crimson-deep"
            : ev.audience_scope === "regional"
              ? "border-gold ring-2 ring-gold/60 bg-gold/[0.06] hover:border-gold"
              : "border-charcoal/50 ring-2 ring-charcoal/30 bg-charcoal/[0.03] hover:border-charcoal"
          : ev.is_featured
            ? "border-gold/60 ring-1 ring-gold/40 bg-gold/[0.03] hover:border-gold"
            : "border-border hover:border-crimson/40"
      }`}
    >
      {verified && (
        <VerifiedBadge
          size={16}
          className="absolute top-2 right-2"
        />
      )}
      {isBroadcastEvent(ev) && (
        <div className={`mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${broadcastBadgeClasses(ev)}`}>
          <Globe className="w-3 h-3" />
          {t(broadcastBadgeKey(ev))}
        </div>
      )}
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 mt-0.5 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border ${
            CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS.other
          }`}
        >
          {categoryLabel(ev.category)}
        </span>
        <div className={`min-w-0 flex-1 ${verified ? "pr-5" : ""}`}>
          <h4 className={`font-display ${compact ? "text-sm" : "text-base"} text-charcoal truncate flex items-center gap-1.5`}>
            {ev.is_featured && <Star className="w-3.5 h-3.5 fill-gold text-gold shrink-0" />}
            <span className="truncate">{ev.title}</span>
          </h4>
          <p className="text-xs text-charcoal/60 mt-0.5">
            {formatEventTime(ev.start_at, "MMM d · h:mm a", ev.diocese_slug)}
            {ev.venue_name && <> · {ev.venue_name}</>}
          </p>
          {eventDioceseName && (
            <p className="text-[11px] text-crimson/80 font-medium mt-0.5 truncate" title={eventDioceseName}>
              {eventDioceseName}
            </p>
          )}
          {dayBadge && (
            <p className="text-[10px] uppercase tracking-wide text-gold font-bold mt-1">{dayBadge}</p>
          )}
          {ev.event_languages && ev.event_languages.length > 0 && (
            <p className="text-[11px] text-charcoal/60 mt-0.5 inline-flex items-center gap-1">
              <Languages className="w-3 h-3" />
              {eventLanguagesLabel(ev.event_languages)}
            </p>
          )}
          {(ev.parish || ev.guest_name) && (
            <p className="text-[11px] text-charcoal/50 italic mt-0.5">
              {t("home.by")} {ev.parish ?? ev.guest_name}
            </p>
          )}
          {verified && (
            <div className="mt-2">
              <InterestedButton eventId={ev.id} eventTitle={ev.title} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}


function hydrateMatchingCoordinates(events: Ev[]) {
  const coordsByAddress = new Map<string, { latitude: number; longitude: number }>();

  for (const event of events) {
    if (event.latitude == null || event.longitude == null) continue;
    const key = normalizeEventAddress(event.address);
    if (key) coordsByAddress.set(key, { latitude: event.latitude, longitude: event.longitude });
  }

  return events.map((event) => {
    if (event.latitude != null && event.longitude != null) return event;
    const key = normalizeEventAddress(event.address);
    const known = key ? coordsByAddress.get(key) : null;
    return known ? { ...event, latitude: known.latitude, longitude: known.longitude } : event;
  });
}

let calendarMapsPromise: Promise<typeof google> | null = null;
function loadCalendarMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (calendarMapsPromise) return calendarMapsPromise;
  const key =
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY_1 ||
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel =
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID_1 ||
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Missing Google Maps browser key"));
  calendarMapsPromise = new Promise((resolve, reject) => {
    (window as any).__calendarInitMaps = () => resolve((window as any).google);
    const existing = document.querySelector<HTMLScriptElement>('script[data-shs-maps]');
    if (existing) {
      const wait = () => {
        if ((window as any).google?.maps) resolve((window as any).google);
        else window.setTimeout(wait, 50);
      };
      wait();
      return;
    }
    const script = document.createElement("script");
    script.dataset.shsMaps = "1";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__calendarInitMaps${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return calendarMapsPromise;
}

async function geocodeAddressInBrowser(address: string): Promise<GeoPoint | null> {
  const query = address.trim();
  if (!query) return null;
  try {
    const g = await loadCalendarMaps();
    const geocoder = new g.maps.Geocoder();
    return await new Promise<GeoPoint | null>((resolve) => {
      geocoder.geocode({ address: query, region: "CA" }, (results, status) => {
        const location = status === "OK" ? results?.[0]?.geometry?.location : null;
        resolve(location ? { lat: location.lat(), lng: location.lng() } : null);
      });
    });
  } catch {
    return null;
  }
}

function normalizeEventAddress(address: string | null) {
  return (address ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bquebec\b/g, "qc")
    .replace(/\bmontreal\b/g, "montreal")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
/**
 * Side panel on the map view: nationwide events hosted in another diocese that
 * this diocese is being invited to. Their pin only exists on the host's map.
 */
function NationalInvites({ events }: { events: Ev[] }) {
  const { t, i18n } = useTranslation();
  const { scopeSlugs } = useDiocese();
  const invites = events
    .filter((e) => isBroadcastEvent(e) && !shouldPinOnMap(e, scopeSlugs))
    .sort((a, b) => broadcastPriority(a) - broadcastPriority(b) || a.start_at.localeCompare(b.start_at));
  if (invites.length === 0) return null;
  return (
    <aside className="mt-4 lg:mt-0 lg:w-72 shrink-0 rounded-lg border-2 border-crimson/50 bg-crimson/[0.04] p-3">
      <h3 className="flex items-center gap-1.5 font-display text-sm text-crimson mb-2">
        <Globe className="w-4 h-4" />
        {t("home.national.panelTitle")}
      </h3>
      <ul className="space-y-2">
        {invites.map((ev) => {
          const d = ev.diocese_slug ? getDiocese(ev.diocese_slug) : null;
          return (
            <li key={ev.id}>
              <Link
                to={`/catholic-calendar/event/${ev.id}`}
                className="block rounded-md border border-crimson/30 bg-background px-2.5 py-2 hover:border-crimson"
              >
                <span className={`mb-1 inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${broadcastBadgeClasses(ev)}`}>
                  {t(broadcastBadgeKey(ev))}
                </span>
                <span className="block text-sm font-bold text-charcoal truncate">{ev.title}</span>
                <span className="block text-[11px] text-charcoal/65">
                  {formatEventTime(ev.start_at, "MMM d · h:mm a", ev.diocese_slug)}
                </span>
                {d && (
                  <span className="block text-[11px] text-crimson/80 truncate">
                    {dioceseName(d, i18n.language)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
