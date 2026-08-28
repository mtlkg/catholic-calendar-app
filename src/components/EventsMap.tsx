/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { parseISO } from "date-fns";
import { format } from "@/lib/dateLocale";
import { formatEventTime } from "@/lib/timezone";
import { Loader2 } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useCategoryLabel } from "@/pages/calendar/CalendarLayout";
import { useDiocese } from "@/context/DioceseContext";
import { getDiocese, dioceseName } from "@/data/dioceses";
import { isBroadcastEvent, isHostedInScope } from "@/lib/eventAudience";
import EventVideoDialog from "./EventVideoDialog";

type MapEv = {
  id: string;
  title: string;
  category: string;
  start_at: string;
  end_at?: string | null;
  venue_name: string | null;
  address: string | null;
  is_featured: boolean;
  latitude: number | null;
  longitude: number | null;
  diocese_slug?: string | null;
  audience_scope?: string | null;
  audience_diocese_slugs?: string[] | null;
  audience_countries?: string[] | null;
  video_url?: string | null;
  submitted_by_user_id?: string | null;
  parish?: string | null;
  guest_name?: string | null;
};

type Origin = { lat: number; lng: number } | null;

// Montréal center
const MTL = { lat: 45.5019, lng: -73.5674 };

// Singleton loader for the Maps JS API
let mapsPromise: Promise<typeof google> | null = null;
export function loadMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const key =
      import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY_1 ||
      import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel =
      import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID_1 ||
      import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) {
      reject(new Error("Missing Google Maps browser key"));
      return;
    }
    (window as any).__shsInitMaps = () => resolve((window as any).google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__shsInitMaps${
      channel ? `&channel=${channel}` : ""
    }`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

const CAT_COLOR: Record<string, string> = {
  mass: "#b91c1c",
  adoration: "#7c3aed",
  bible_study: "#1d4ed8",
  retreat: "#15803d",
  social: "#d97706",
  fundraiser: "#db2777",
  young_adults: "#0891b2",
  youth_group: "#0d9488",
  conference: "#4338ca",
  other: "#475569",
};

export default function EventsMap({
  events,
  origin,
  radiusKm,
  center,
  scopeSlugs = [],
  hostNames = new Map<string, string>(),
  dioceseSlug,
}: {
  events: MapEv[];
  origin: Origin;
  radiusKm: number;
  /** Fallback center — the see city of the active diocese. */
  center?: { lat: number; lng: number };
  /** Dioceses currently in view. Used to style the host pin for broadcast events. */
  scopeSlugs?: string[];
  /** user_id -> public organizer name, used to label events on the map. */
  hostNames?: Map<string, string>;
  /** Active diocese slug so event detail can return to the map view. */
  dioceseSlug?: string;
}) {
  const fallbackCenter = center ?? MTL;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [videoDialog, setVideoDialog] = useState<{ title: string; video: string } | null>(null);
  const { t, i18n } = useTranslation();
  const { isCityGroup } = useDiocese();
  const categoryLabel = useCategoryLabel();
  const navigate = useNavigate();

  const located = useMemo(
    () => events.filter((e) => e.latitude != null && e.longitude != null),
    [events],
  );
  const knownCoordsByAddress = useMemo(() => {
    const coords = new Map<string, { lat: number; lng: number }>();
    for (const e of located) {
      const key = locationKey(e);
      if (key && e.latitude != null && e.longitude != null) {
        coords.set(key, { lat: e.latitude, lng: e.longitude });
      }
    }
    return coords;
  }, [located]);
  const needsGeocode = useMemo(
    () =>
      events.filter(
        (e) => {
          if (e.latitude != null && e.longitude != null) return false;
          if (!e.address && !e.venue_name) return false;
          const key = locationKey(e);
          return !key || !knownCoordsByAddress.has(key);
        },
      ),
    [events, knownCoordsByAddress],
  );
  const [geocoded, setGeocoded] = useState<Record<string, { lat: number; lng: number }>>({});
  // Best-effort client-side geocoding for events that have an address but no coords.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const g = (window as any).google as typeof google | undefined;
    const geocoder = g?.maps ? new g.maps.Geocoder() : null;
    const todo = needsGeocode.filter((e) => !geocoded[e.id]);
    const geocodeInBrowser = (address: string) =>
      new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!geocoder) {
          resolve(null);
          return;
        }
        geocoder.geocode({ address, region: "CA" }, (results, status) => {
          if (status !== "OK" || !results?.[0]?.geometry?.location) {
            resolve(null);
            return;
          }
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        });
      });
    (async () => {
      for (const ev of todo) {
        const queries = Array.from(new Set([
          [ev.venue_name, ev.address].filter(Boolean).join(", "),
          ev.address || "",
          ev.venue_name || "",
        ].filter((q) => q.trim().length > 0)));
        try {
          let point: { lat: number; lng: number } | null = null;
          for (const q of queries) {
            point = await geocodeInBrowser(q);
            if (point) break;
          }
          if (!point) {
            for (const q of queries) {
              const { data, error } = await supabase.functions.invoke(
                "geocode-address",
                { body: { address: q, eventId: ev.id } },
              );
              if (!error && data?.point) {
                point = data.point;
                break;
              }
            }
          }
          if (cancelled) return;
          if (point) {
            setGeocoded((prev) => ({ ...prev, [ev.id]: point }));
          }
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 80));
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, needsGeocode, geocoded]);

  const allPoints = useMemo(() => {
    const pts: (MapEv & { lat: number; lng: number })[] = [];
    for (const e of events) {
      if (e.latitude != null && e.longitude != null) {
        pts.push({ ...e, lat: e.latitude, lng: e.longitude });
      } else if (geocoded[e.id]) {
        pts.push({ ...e, lat: geocoded[e.id].lat, lng: geocoded[e.id].lng });
      } else {
        const key = locationKey(e);
        const known = key ? knownCoordsByAddress.get(key) : null;
        if (known) pts.push({ ...e, lat: known.lat, lng: known.lng });
      }
    }
    return pts;
  }, [events, geocoded, knownCoordsByAddress]);

  const visiblePointCount = allPoints.length;
  const missing = events.length - visiblePointCount;

  // Init map once
  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then((g) => {
        if (cancelled || !mapEl.current) return;
        mapRef.current = new g.maps.Map(mapEl.current, {
          center: fallbackCenter,
          zoom: 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        infoRef.current = new g.maps.InfoWindow();
        setReady(true);
      })
      .catch((e) => setError(e.message || "Map failed to load"));
    return () => {
      cancelled = true;
    };
  }, []);

  // Render markers when events / map change
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = (window as any).google as typeof google;
    // clear
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new g.maps.LatLngBounds();
    let hasPoint = false;

    // Group events by rounded location so coincident pins merge into one marker
    const groups = new Map<string, (typeof allPoints)[number][]>();
    for (const ev of allPoints) {
      const key = `${ev.lat.toFixed(5)},${ev.lng.toFixed(5)}`;
      const arr = groups.get(key) ?? [];
      arr.push(ev);
      groups.set(key, arr);
    }

    for (const [, evs] of groups) {
      const first = evs[0];
      const pos = { lat: first.lat, lng: first.lng };
      const featured = evs.some((e) => e.is_featured);
      const count = evs.length;
      // A broadcast event hosted in the current scope gets a special host pin.
      const hostBroadcast = evs.some(
        (e) => isBroadcastEvent(e) && isHostedInScope(e, scopeSlugs),
      );
      // Use one color when all events share a category; otherwise neutral slate
      const sameCat = evs.every((e) => e.category === first.category);
      const color = sameCat ? CAT_COLOR[first.category] ?? CAT_COLOR.other : "#0f172a";

      // Build a clear pin-style SVG with optional count badge
      const label = count > 1 ? String(count) : "";
      const svg = hostBroadcast
        ? hostBroadcastPinSvg(color, label)
        : pinSvg(color, featured, label);
      const size = hostBroadcast ? new g.maps.Size(44, 58) : new g.maps.Size(36, 48);
      const anchor = hostBroadcast ? new g.maps.Point(22, 55) : new g.maps.Point(18, 46);
      const marker = new g.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: count > 1 ? t("map.eventsHere", { count }) : first.title,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: size,
          anchor,
        },
        zIndex: hostBroadcast ? 300 : featured ? 200 : 100,
      });

      marker.addListener("click", () => {
        const sorted = evs.slice().sort((a, b) => {
          // Host broadcast events bubble to the very top, then featured, then start time
          const aHost = isBroadcastEvent(a) && isHostedInScope(a, scopeSlugs);
          const bHost = isBroadcastEvent(b) && isHostedInScope(b, scopeSlugs);
          if (aHost !== bHost) return aHost ? -1 : 1;
          if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
          return a.start_at.localeCompare(b.start_at);
        });
        const headerLabel = count > 1
          ? t("map.eventsHere", { count })
          : (first.venue_name || first.address || t("map.eventFallback"));
        const list = sorted
          .map((ev) => {
            const slug = (ev as any).diocese_slug ?? null;
            const d = isCityGroup && slug ? getDiocese(slug) : null;
            const dName = d ? escapeHtml(dioceseName(d, i18n.language)) : "";
            const endRaw = (ev as any).end_at as string | null | undefined;
            const fmtS = (f: string) => formatEventTime(ev.start_at, f, slug);
            const fmtE = (f: string) => (endRaw ? formatEventTime(endRaw, f, slug) : "");
            const sameDay = !endRaw || fmtS("yyyy-MM-dd") === fmtE("yyyy-MM-dd");
            const when = sameDay
              ? fmtS("EEE, MMM d · h:mm a")
              : `${fmtS("MMM d")} – ${fmtE("MMM d, yyyy")}`;
            const hostBroadcast = isBroadcastEvent(ev) && isHostedInScope(ev, scopeSlugs);
            const icon = hostBroadcast
              ? `<span title="${escapeHtml(t("map.hostBroadcast"))}" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#7a1020,#b91c1c);color:#fdf6e3;border:2px solid #d4af37;font-size:10px;flex:0 0 20px;margin-top:1px;">🌐</span>`
              : ev.is_featured
                ? `<span title="${escapeHtml(t("map.featured"))}" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#fdf6e3;color:#b8860b;font-size:10px;flex:0 0 18px;margin-top:1px;">★</span>`
                : `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#b91c1c;flex:0 0 6px;margin:7px 6px 0 6px;"></span>`;
            const rowBorder = hostBroadcast
              ? "border:1px solid #e3c766;background:linear-gradient(90deg,#fffdf7,#fbf3df);"
              : "border:1px solid rgba(122,106,85,0.14);background:#ffffff;";
            const hasVideo = !!(ev as any).video_url;
            const videoBtn = hasVideo
              ? `<button type="button" class="shs-info-video" data-event-id="${ev.id}" data-title="${escapeHtml(ev.title)}" data-video="${escapeHtml((ev as any).video_url)}" title="${escapeHtml(t("video.watch"))}" style="align-self:center;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#b91c1c;color:#fdf6e3;flex:0 0 24px;margin-right:2px;border:none;cursor:pointer;"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg></button>`
              : "";
            const organizerName =
              (ev.submitted_by_user_id ? hostNames.get(ev.submitted_by_user_id) : null) ||
              ev.parish ||
              ev.guest_name ||
              "";
            const organizerBtn = organizerName
              ? `<button type="button" class="shs-info-organizer" data-user-id="${escapeHtml(ev.submitted_by_user_id || "")}" data-name="${escapeHtml(organizerName)}" style="display:inline-flex;align-items:center;gap:4px;margin-top:5px;padding:0;background:none;border:none;cursor:pointer;font-size:10.5px;color:#b91c1c;font-weight:600;letter-spacing:0.02em;text-decoration:none;"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(organizerName)}</span></button>`
              : "";
            return `
              <div style="display:flex;align-items:flex-start;gap:9px;padding:9px 10px;margin:0 0 6px 0;border-radius:10px;text-decoration:none;color:inherit;transition:box-shadow .15s,transform .15s,border-color .15s;min-width:0;box-shadow:0 1px 3px rgba(26,26,26,0.06);${rowBorder}" onmouseover="this.style.boxShadow='0 6px 16px -6px rgba(26,26,26,0.35)';this.style.borderColor='#b91c1c';this.style.transform='translateY(-1px)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(26,26,26,0.06)';this.style.borderColor='${hostBroadcast ? "#e3c766" : "rgba(122,106,85,0.14)"}';this.style.transform='none'">
                <a href="/catholic-calendar/event/${ev.id}" class="shs-info-event-link" data-event-id="${ev.id}" style="display:flex;align-items:flex-start;gap:9px;text-decoration:none;color:inherit;min-width:0;flex:1;">
                  ${icon}
                  <span style="display:block;min-width:0;flex:1;overflow:hidden;">
                    <span style="display:block;font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:clamp(12.5px,3.5vw,14px);color:#1a1a1a;line-height:1.3;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(ev.title)}</span>
                    <span style="display:block;font-size:11px;color:#7a6a55;margin-top:3px;letter-spacing:0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${when}</span>
                    ${organizerBtn}
                    ${dName ? `<span style="display:inline-block;font-size:9.5px;color:#b91c1c;margin-top:5px;padding:2px 7px;border-radius:999px;background:rgba(185,28,28,0.08);letter-spacing:0.06em;text-transform:uppercase;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${dName}</span>` : ""}
                  </span>
                  <span style="align-self:center;color:#b91c1c;font-size:14px;line-height:1;flex:0 0 auto;">›</span>
                </a>
                ${videoBtn}
              </div>`;
          })
          .join("");
        const html = `
        <div id="shs-info-${first.id}" style="font-family:'Lato',system-ui,sans-serif;width:min(300px,calc(100vw - 48px));max-width:100%;box-sizing:border-box;position:relative;background:#fffdf7;border-radius:16px;overflow:hidden;border:1px solid rgba(212,175,55,0.55);box-shadow:0 24px 60px -22px rgba(26,26,26,0.75);">
          <div style="background:linear-gradient(135deg,#5c0c18 0%,#b91c1c 55%,#7a1020 100%);padding:12px 44px 12px 14px;color:#fdf6e3;position:relative;">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.26em;color:#f0d68c;margin-bottom:3px;">${escapeHtml(count > 1 ? t("map.eventsHere", { count }) : t("map.eventFallback"))}</div>
            <div style="font-family:'Playfair Display',Georgia,serif;font-size:15px;font-weight:600;line-height:1.25;letter-spacing:0.01em;word-break:break-word;">${escapeHtml(headerLabel)}</div>
            <div style="position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,#d4af37,transparent);"></div>
          </div>
          <button class="shs-info-close" aria-label="${escapeHtml(t("map.close"))}" style="
            position:absolute;top:9px;right:9px;width:26px;height:26px;border:none;border-radius:50%;
            background:rgba(253,246,227,0.18);color:#fdf6e3;font-size:16px;line-height:1;cursor:pointer;
            display:flex;align-items:center;justify-content:center;z-index:10;padding:0;backdrop-filter:blur(4px);
          ">×</button>
          <div style="max-height:240px;overflow-y:auto;overflow-x:hidden;padding:10px 10px 4px;">${list}</div>
        </div>`;

        infoRef.current?.setContent(html);
        infoRef.current?.open({ map: mapRef.current!, anchor: marker });
        g.maps.event.addListenerOnce(infoRef.current!, "domready", () => {
          const closeBtn = document.querySelector(
            `#shs-info-${first.id} .shs-info-close`,
          ) as HTMLButtonElement | null;
          closeBtn?.addEventListener("click", () => infoRef.current?.close());

          document
            .querySelectorAll(`#shs-info-${first.id} .shs-info-video`)
            .forEach((btn) => {
              btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const title = (btn as HTMLElement).dataset.title || "";
                const video = (btn as HTMLElement).dataset.video || "";
                if (video) setVideoDialog({ title, video });
              });
            });

          document
            .querySelectorAll(`#shs-info-${first.id} .shs-info-organizer`)
            .forEach((btn) => {
              btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const userId = (btn as HTMLElement).dataset.userId || "";
                if (userId) navigate(`/catholic-calendar/organizers/${userId}`);
              });
            });

          document
            .querySelectorAll(`#shs-info-${first.id} .shs-info-event-link`)
            .forEach((link) => {
              link.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const eventId = (link as HTMLElement).dataset.eventId || "";
                if (!eventId) return;
                navigate(`/catholic-calendar/event/${eventId}`, {
                  state: { from: "map", dioceseSlug },
                });
              });
            });
        });
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
      hasPoint = true;
    }

    // origin marker + radius circle
    originMarkerRef.current?.setMap(null);
    circleRef.current?.setMap(null);
    originMarkerRef.current = null;
    circleRef.current = null;

    if (origin) {
      originMarkerRef.current = new g.maps.Marker({
        position: origin,
        map: mapRef.current,
        title: t("map.yourLocation"),
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#0f172a",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        zIndex: 999,
      });
      circleRef.current = new g.maps.Circle({
        map: mapRef.current,
        center: origin,
        radius: radiusKm * 1000,
        strokeColor: "#b91c1c",
        strokeOpacity: 0.6,
        strokeWeight: 1,
        fillColor: "#b91c1c",
        fillOpacity: 0.06,
      });
      bounds.union(circleRef.current.getBounds()!);
      hasPoint = true;
    }

    if (hasPoint) {
      mapRef.current.fitBounds(bounds, 48);
      // don't over-zoom for a single point
      const listener = g.maps.event.addListenerOnce(mapRef.current, "idle", () => {
        if ((mapRef.current?.getZoom() ?? 0) > 14) mapRef.current?.setZoom(14);
      });
      void listener;
    } else {
      mapRef.current.setCenter(fallbackCenter);
      mapRef.current.setZoom(11);
    }
  }, [ready, allPoints, origin, radiusKm, fallbackCenter, t, i18n.language]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {t("map.failed", { error })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div
          ref={mapEl}
          className="w-full h-[560px] rounded-lg border border-border bg-muted"
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-charcoal/60 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> {t("map.loading")}
          </div>
        )}
      </div>
      {ready && events.length === 0 && (
        <div className="rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-charcoal/70">
          {t("map.noEventsMonth")}
        </div>
      )}
      {ready && events.length > 0 && visiblePointCount === 0 && (
        <div className="rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-charcoal/70">
          {t("map.noLocations")}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-charcoal/60">
        <div>
          <Trans
            i18nKey="map.showing"
            count={visiblePointCount}
            values={{ count: visiblePointCount }}
            components={[<strong className="text-charcoal" />]}
          />
          {missing > 0 && <> · {t("map.hidden", { count: missing })}</>}.
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CAT_COLOR).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              {categoryLabel(k)}
            </span>
          ))}
        </div>
      </div>
      {videoDialog &&
        createPortal(
          <EventVideoDialog
            title={videoDialog.title}
            video={videoDialog.video}
            onClose={() => setVideoDialog(null)}
          />,
          document.body,
        )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function locationKey(e: Pick<MapEv, "address" | "venue_name">) {
  const raw = e.address || e.venue_name || "";
  return normalizeLocation(raw);
}

function normalizeLocation(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bquebec\b/g, "qc")
    .replace(/\bmontreal\b/g, "montreal")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pinSvg(color: string, featured: boolean, label: string) {
  const ring = featured ? "#d4af37" : "#ffffff";
  const ringW = featured ? 3 : 2;
  const badge =
    label.length > 0
      ? `<g>
           <circle cx="27" cy="9" r="8" fill="#0f172a" stroke="#ffffff" stroke-width="2"/>
           <text x="27" y="12.5" text-anchor="middle" font-family="system-ui,Arial,sans-serif" font-size="10" font-weight="700" fill="#ffffff">${label}</text>
         </g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-opacity="0.35"/></filter></defs>
    <path filter="url(#s)" d="M18 46 C 18 46 4 28 4 18 a14 14 0 1 1 28 0 c0 10 -14 28 -14 28 z"
      fill="${color}" stroke="${ring}" stroke-width="${ringW}"/>
    <circle cx="18" cy="18" r="5" fill="#ffffff"/>
    ${badge}
  </svg>`;
}

function hostBroadcastPinSvg(color: string, label: string) {
  // Larger, crowned pin for broadcast events hosted in the current diocese.
  const badge =
    label.length > 0
      ? `<g>
           <circle cx="33" cy="11" r="9" fill="#0f172a" stroke="#ffffff" stroke-width="2"/>
           <text x="33" y="14.5" text-anchor="middle" font-family="system-ui,Arial,sans-serif" font-size="11" font-weight="700" fill="#ffffff">${label}</text>
         </g>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="58" viewBox="0 0 44 58">
    <defs><filter id="hb" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-opacity="0.4"/></filter></defs>
    <!-- outer gold halo -->
    <path filter="url(#hb)" d="M22 54 C 22 54 5 33 5 21 a17 17 0 1 1 34 0 c0 12 -17 33 -17 33 z"
      fill="${color}" stroke="#d4af37" stroke-width="4"/>
    <!-- inner ivory band -->
    <path d="M22 49 C 22 49 9 32 9 22 a13 13 0 1 1 26 0 c0 10 -13 27 -13 27 z"
      fill="none" stroke="#fffdf7" stroke-width="2"/>
    <!-- globe/star icon -->
    <g transform="translate(22,21)">
      <circle r="7" fill="#fffdf7"/>
      <path d="M-6 0 Q0 -7 6 0 Q0 7 -6 0 M0 -7 Q3 0 0 7 Q-3 0 0 -7" stroke="#b91c1c" stroke-width="1.4" fill="none"/>
    </g>
    ${badge}
  </svg>`;
}