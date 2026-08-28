import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";

/**
 * Lightweight Places (New) autocomplete input. Uses the shared loader hook from
 * EventsMap by re-requesting the maps script — Google's loader dedupes by URL,
 * and once `google.maps` is on window we just call `importLibrary('places')`.
 */
let mapsLoadPromise: Promise<typeof google> | null = null;
function ensureMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsLoadPromise) return mapsLoadPromise;
  const key =
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY_1 ||
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel =
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID_1 ||
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Missing Google Maps browser key"));
  mapsLoadPromise = new Promise((resolve, reject) => {
    (window as any).__shsInitMaps = () => resolve((window as any).google);
    // If EventsMap already added the script, just wait for it.
    const existing = document.querySelector<HTMLScriptElement>('script[data-shs-maps]');
    if (existing) {
      const wait = () => {
        if ((window as any).google?.maps) resolve((window as any).google);
        else setTimeout(wait, 50);
      };
      wait();
      return;
    }
    const s = document.createElement("script");
    s.dataset.shsMaps = "1";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=places&callback=__shsInitMaps${channel ? `&channel=${channel}` : ""}`;
    s.async = true; s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoadPromise;
}

export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
}

export default function PlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (s: PlaceSuggestion & { lat?: number; lng?: number }) => void;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fetchSuggestions = useMemo(
    () => async (input: string) => {
      if (!input || input.trim().length < 3) { setSuggestions([]); return; }
      try {
        setLoading(true);
        const g = await ensureMaps();
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          (await (g.maps as any).importLibrary("places")) as any;
        if (!sessionTokenRef.current) sessionTokenRef.current = new AutocompleteSessionToken();
        const { suggestions: raw } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionTokenRef.current,
        });
        const mapped: PlaceSuggestion[] = (raw ?? [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .map((p: any) => ({
            placeId: p.placeId,
            primaryText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
            secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
            fullText: p.text?.text ?? "",
          }));
        setSuggestions(mapped);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleChange = (v: string) => {
    onChange(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(v), 220);
  };

  const handlePick = async (s: PlaceSuggestion) => {
    onChange(s.fullText || `${s.primaryText} ${s.secondaryText}`.trim());
    setOpen(false);
    setSuggestions([]);
    // Reset session token after a selection per Places billing rules.
    sessionTokenRef.current = null;
    // Try to resolve coordinates via Place Details (importLibrary).
    try {
      const g = await ensureMaps();
      const { Place } = (await (g.maps as any).importLibrary("places")) as any;
      const place = new Place({ id: s.placeId });
      await place.fetchFields({ fields: ["location", "formattedAddress"] });
      const loc = place.location;
      onSelect({
        ...s,
        lat: typeof loc?.lat === "function" ? loc.lat() : loc?.lat,
        lng: typeof loc?.lng === "function" ? loc.lng() : loc?.lng,
      });
    } catch {
      onSelect(s);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <MapPin className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal/40 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="pl-8 pr-3 py-2 border border-border rounded-md text-sm w-full bg-background"
      />
      {open && (suggestions.length > 0 || loading) && (
        <ul className="absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-auto rounded-md border border-border bg-card shadow-lg">
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-xs text-charcoal/50">Searching…</li>
          )}
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => handlePick(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b border-border last:border-0"
              >
                <div className="font-medium text-charcoal">{s.primaryText}</div>
                {s.secondaryText && <div className="text-xs text-charcoal/55">{s.secondaryText}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
