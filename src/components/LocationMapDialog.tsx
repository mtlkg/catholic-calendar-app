/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { loadMaps } from "@/components/EventsMap";

type Props = {
  title: string;
  label: string;
  /** Optional exact coordinates; when absent the label is geocoded. */
  lat?: number | null;
  lng?: number | null;
  onClose: () => void;
};

export default function LocationMapDialog({ title, label, lat, lng, onClose }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(async (g) => {
        if (cancelled || !elRef.current) return;
        let point: google.maps.LatLngLiteral | null =
          lat != null && lng != null ? { lat, lng } : null;
        if (!point && label) {
          point = await new Promise<google.maps.LatLngLiteral | null>((resolve) => {
            new g.maps.Geocoder().geocode({ address: label }, (results, status) => {
              const loc = results?.[0]?.geometry?.location;
              resolve(status === "OK" && loc ? { lat: loc.lat(), lng: loc.lng() } : null);
            });
          });
        }
        if (cancelled || !elRef.current) return;
        if (!point) {
          setError(label);
          return;
        }
        const map = new g.maps.Map(elRef.current, {
          center: point,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
        });
        new g.maps.Marker({ position: point, map, title });
      })
      .catch((e) => setError(e?.message ?? "Map failed to load"));
    return () => {
      cancelled = true;
    };
  }, [label, lat, lng, title]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-card shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-3 border-b border-border">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{title}</p>
            <p className="text-xs text-charcoal/60 truncate">{label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 hover:bg-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {error ? (
          <div className="p-6 text-sm text-charcoal/70">{error}</div>
        ) : (
          <div ref={elRef} className="w-full h-72" />
        )}
        <div className="p-3 text-right">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              lat != null && lng != null ? `${lat},${lng}` : label,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-crimson hover:underline"
          >
            Google Maps ↗
          </a>
        </div>
      </div>
    </div>
  );
}
