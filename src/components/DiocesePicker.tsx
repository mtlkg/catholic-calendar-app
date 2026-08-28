import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, X, Check, Star, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DIOCESES, CITY_GROUPS, cityGroupFor, dioceseShortName, isDioceseUnlocked, type Diocese } from "@/data/dioceses";
import { useDiocese, useDioceseName, nearestDioceses } from "@/context/DioceseContext";

const FAV_KEY = "tcc.favoriteDioceses";
const ALL_OPTIONS: Diocese[] = [...CITY_GROUPS, ...DIOCESES];

// Shown as "Popular dioceses" when we have no location signal for the visitor.
const POPULAR_SLUGS = ["montreal", "toronto", "new-york", "los-angeles", "chicago", "vancouver", "boston"];

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function DiocesePicker({
  className = "",
  variant = "compact",
  label,
}: {
  className?: string;
  /** "compact" = small header chip, "hero" = large call-to-action button. */
  variant?: "compact" | "hero";
  label?: string;
}) {
  const { t } = useTranslation();
  const { diocese, setDiocese, detectedCoords } = useDiocese();
  const nameOf = useDioceseName();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQ("");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const point = detectedCoords;

  // Everything within a sensible travel radius of the visitor, nearest first —
  // both the combined city views and the individual jurisdictions around them.
  const recommended = useMemo(() => {
    if (!point) return [] as { diocese: Diocese; km: number }[];
    const cityViews = nearestDioceses(point.lat, point.lng, 3);
    const seen = new Set(cityViews.map((r) => r.diocese.slug));
    // National/personal jurisdictions (eparchies) are never auto-assigned by
    // geography, but they should still be suggested when they sit in the
    // visitor's city and are available.
    const singles = DIOCESES.filter((d) => !d.national || isDioceseUnlocked(d.slug))
      .map((d) => ({
        diocese: d,
        km: Math.hypot(
          (d.lng - point.lng) * Math.cos((point.lat * Math.PI) / 180) * 111.32,
          (d.lat - point.lat) * 110.57,
        ),
      }))
      .filter((r) => r.km <= 150 && !seen.has(r.diocese.slug) && cityGroupFor(r.diocese))
      .sort((a, b) => a.km - b.km)
      .slice(0, 5);
    return [...cityViews, ...singles]
      .filter((r) => r.diocese.slug !== diocese.slug)
      .sort((a, b) => a.km - b.km)
      .slice(0, 5);
  }, [point, diocese.slug]);

  // When we can't tell where the visitor is, offer the busiest Catholic hubs
  // instead of an empty section.
  const popular = useMemo(() => {
    if (point) return [] as Diocese[];
    return POPULAR_SLUGS.map((slug) => ALL_OPTIONS.find((d) => d.slug === slug))
      .filter((d): d is Diocese => Boolean(d) && d!.slug !== diocese.slug && isDioceseUnlocked(d!.slug))
      .slice(0, 5);
  }, [point, diocese.slug]);

  const groups = useMemo(() => {
    const needle = norm(q.trim());
    const match = (d: Diocese) =>
      !needle ||
      norm(d.name).includes(needle) ||
      norm(d.nameFr ?? "").includes(needle) ||
      norm(d.city).includes(needle);
    const list = DIOCESES.filter(match);
    const cities = CITY_GROUPS.filter(match);
    const byCountry: { key: "CA" | "US" | "cities"; items: Diocese[] }[] = [
      { key: "cities", items: cities },
      { key: "CA", items: list.filter((d) => d.country === "CA") },
      { key: "US", items: list.filter((d) => d.country === "US") },
    ];
    return byCountry.filter((g) => g.items.length > 0);
  }, [q]);

  const choose = (slug: string) => {
    setDiocese(slug);
    setOpen(false);
  };

  const toggleFav = (slug: string) => {
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const favoriteDioceses = useMemo(
    () =>
      favorites
        .map((slug) => ALL_OPTIONS.find((d) => d.slug === slug))
        .filter((d): d is Diocese => Boolean(d) && d!.slug !== diocese.slug && isDioceseUnlocked(d!.slug)),
    [favorites, diocese.slug],
  );

  const FavStar = ({ slug, onDark = false }: { slug: string; onDark?: boolean }) => {
    const on = favorites.includes(slug);
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleFav(slug);
        }}
        aria-label={(on ? t("diocese.removeFavorite") : t("diocese.addFavorite")) as string}
        title={(on ? t("diocese.removeFavorite") : t("diocese.addFavorite")) as string}
        className={`shrink-0 rounded-full p-1.5 transition-colors ${
          onDark ? "hover:bg-ivory/15" : "hover:bg-gold/20"
        }`}
      >
        <Star
          className={`w-4 h-4 transition-colors ${
            on ? "text-gold fill-gold" : onDark ? "text-ivory/40" : "text-charcoal/25"
          }`}
        />
      </button>
    );
  };

  const SectionLabel = ({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) => (
    <div className="sticky top-0 z-10 px-5 pt-4 pb-2 flex items-center gap-2 bg-ivory/95 backdrop-blur-sm shadow-[0_1px_0_rgba(212,175,55,0.15)]">
      {icon}
      <span className="text-[10px] uppercase tracking-[0.22em] text-charcoal/50 font-body font-bold">
        {children}
      </span>
      <span className="flex-1 h-px bg-gradient-to-r from-gold/50 to-transparent" />
    </div>
  );

  const Row = ({ d, trailing }: { d: Diocese; trailing?: React.ReactNode }) => (
    <div className="px-3">
      <div className="group w-full rounded-xl border border-transparent hover:border-gold/40 hover:bg-card hover:shadow-[0_1px_10px_-4px_hsl(var(--charcoal)/0.25)] flex items-center gap-1 transition-all">
        <button onClick={() => choose(d.slug)} className="flex-1 min-w-0 text-left px-3 py-2.5 flex items-center gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-gold/15 group-hover:bg-crimson/10 flex items-center justify-center transition-colors">
            <MapPin className="w-3.5 h-3.5 text-crimson" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-body font-semibold text-charcoal truncate">{nameOf(d)}</span>
            <span className="block text-[11px] text-charcoal/50 truncate">{d.city}</span>
          </span>
        </button>
        {trailing}
        <FavStar slug={d.slug} />
      </div>
    </div>
  );


  return (
    <>
      {variant === "hero" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-crimson text-ivory font-body text-base sm:text-lg font-bold shadow-lg hover:bg-crimson-deep transition-colors ${className}`}
        >
          <MapPin className="w-5 h-5 shrink-0" />
          <span>{label ?? t("diocese.selectCta")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-md border border-gold/40 bg-ivory text-[11px] sm:text-[13px] font-body text-charcoal hover:bg-gold/10 transition-colors max-w-[92px] sm:max-w-[220px] ${className}`}
          title={t("diocese.change") as string}
        >
          <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-crimson shrink-0" />
          <span className="truncate">{dioceseShortName(diocese)}</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-charcoal/70 backdrop-blur-md flex items-start justify-center p-4 pt-[7vh] animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-[22px] bg-ivory border border-gold/50 shadow-[0_30px_80px_-20px_hsl(var(--charcoal)/0.7)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — deep crimson with a gold hairline and the active pick */}
            <div className="relative bg-gradient-to-br from-crimson-deep via-crimson to-crimson-deep text-ivory">
              <div className="absolute inset-0 opacity-[0.18] bg-[radial-gradient(circle_at_15%_10%,rgba(255,255,255,0.6),transparent_45%),radial-gradient(circle_at_85%_90%,rgba(212,175,55,0.7),transparent_50%)]" />
              <div className="relative px-5 pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-gold-light font-body">
                      {t("diocese.change")}
                    </p>
                    <h2 className="font-display text-2xl leading-tight mt-0.5">{t("diocese.title")}</h2>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label={t("common.close") as string}
                    className="shrink-0 rounded-full p-2 bg-ivory/10 hover:bg-ivory/25 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Currently selected — always pinned at the very top */}
                <div className="mt-3.5 rounded-xl bg-ivory/12 border border-gold/50 backdrop-blur px-3 py-3 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-gold text-charcoal flex items-center justify-center shadow-sm">
                    <Check className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-gold-light font-body font-bold">
                      {t("diocese.current")}
                    </span>
                    <span className="block font-body font-bold text-[15.5px] leading-snug truncate">{nameOf(diocese)}</span>
                  </span>
                  <FavStar slug={diocese.slug} onDark />
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
            </div>

            {/* Search */}
            <div className="px-4 py-3 bg-card border-b border-gold/25">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/35" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("diocese.searchPlaceholder") as string}
                  className="w-full pl-10 pr-3 py-2.5 rounded-full border border-border bg-background text-[13.5px] font-body placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-crimson/25 focus:border-crimson/40 transition"
                />
              </div>
            </div>

            <div className="px-4 py-2.5 bg-ivory border-b border-gold/20 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-crimson shrink-0 mt-0.5" />
              <p className="text-[11.5px] leading-snug font-body text-charcoal/65">{t("diocese.lockedNotice")}</p>
            </div>

            <div className="max-h-[56vh] overflow-y-auto bg-ivory pb-3">
              {/* Saved favorites */}
              {!q.trim() && favoriteDioceses.length > 0 && (
                <div>
                  <SectionLabel icon={<Star className="w-3.5 h-3.5 fill-gold text-gold" />}>
                    {t("diocese.favorites")}
                  </SectionLabel>
                  <div className="space-y-0.5">
                    {favoriteDioceses.map((d) => (
                      <Row key={`fav-${d.slug}`} d={d} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended near the visitor */}
              {!q.trim() && recommended.length > 0 && (
                <div>
                  <SectionLabel icon={<Sparkles className="w-3.5 h-3.5 text-crimson" />}>
                    {t("diocese.recommended")}
                  </SectionLabel>
                  <div className="space-y-0.5">
                    {recommended.map(({ diocese: d, km }) => (
                      <Row
                        key={`rec-${d.slug}`}
                        d={d}
                        trailing={
                          <span className="shrink-0 text-[10.5px] font-body text-charcoal/45 tabular-nums">
                            {t("diocese.kmAway", { km: Math.round(km) })}
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No location signal — surface the busiest dioceses instead */}
              {!q.trim() && recommended.length === 0 && popular.length > 0 && (
                <div>
                  <SectionLabel icon={<Sparkles className="w-3.5 h-3.5 text-crimson" />}>
                    {t("diocese.popular")}
                  </SectionLabel>
                  <div className="space-y-0.5">
                    {popular.map((d) => (
                      <Row key={`pop-${d.slug}`} d={d} />
                    ))}
                  </div>
                </div>
              )}

              {groups.length === 0 && (
                <p className="px-4 py-10 text-sm text-charcoal/55 text-center font-body">{t("diocese.noResults")}</p>
              )}
              {groups.map((g) => (
                <div key={g.key}>
                  <SectionLabel>
                    {g.key === "cities"
                      ? t("diocese.combinedCities")
                      : g.key === "CA"
                        ? t("diocese.canada")
                        : t("diocese.unitedStates")}
                  </SectionLabel>
                  <div className="space-y-0.5">
                    {g.items.map((d) => (
                      <Row key={d.slug} d={d} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
