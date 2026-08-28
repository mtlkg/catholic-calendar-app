import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { addDays, addMonths, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { format } from "@/lib/dateLocale";
import { formatEventTime } from "@/lib/timezone";
import { ChevronLeft, ChevronRight, Sparkles, Pause, Play, Calendar as CalendarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useDiocese } from "@/context/DioceseContext";
import CalendarLayout, { useCategoryLabel } from "./CalendarLayout";
import { getPosterUrl } from "@/lib/posterUrl";
import VerifiedBadge from "@/components/VerifiedBadge";
import { currentTranslationTarget, translationCacheKey } from "@/lib/translation";
import { getDiocese, dioceseName } from "@/data/dioceses";

type HighlightEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  venue_name: string | null;
  parish: string | null;
  category: string;
  is_featured: boolean;
  poster_url: string | null;
  submitted_by_user_id: string | null;
  diocese_slug: string | null;
};

export default function Highlights() {
  const { t, i18n } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const { diocese, scopeSlugs, scopeKey, isCityGroup } = useDiocese();
  const [events, setEvents] = useState<HighlightEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [translatedDescriptions, setTranslatedDescriptions] = useState<Record<string, string>>({});
  const [active, setActive] = useState(0);
  const [range, setRange] = useState<"2w" | "month">("2w");
  const [rangeMonth, setRangeMonth] = useState<Date | null>(null);
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const now = new Date();
      const from = (range === "2w" ? now : startOfMonth(rangeMonth!) < now ? now : startOfMonth(rangeMonth!)).toISOString();
      const to = (range === "2w" ? addDays(now, 14) : endOfMonth(rangeMonth!)).toISOString();

      const { data: raw } = await (supabase as any)
        .from("calendar_events_public")
        .select("id,title,description,start_at,end_at,venue_name,parish,category,is_featured,poster_url,submitted_by_user_id,diocese_slug")
        .in("diocese_slug", scopeSlugs)
        .gte("start_at", from)
        .lte("start_at", to)
        .order("is_featured", { ascending: false })
        .order("start_at", { ascending: true });


      const list = (raw ?? []) as HighlightEvent[];
      const organizerIds = Array.from(new Set(list.map((e) => e.submitted_by_user_id).filter(Boolean) as string[]));
      let verified = new Set<string>();
      if (organizerIds.length) {
        const { data: orgs } = await (supabase as any)
          .from("organizer_profiles_public")
          .select("user_id,status")
          .in("user_id", organizerIds);
        verified = new Set((orgs ?? []).filter((o: any) => o.status === "approved").map((o: any) => o.user_id));
      }
      const filtered = list.filter((e) => e.submitted_by_user_id && verified.has(e.submitted_by_user_id));
      if (cancelled) return;
      setEvents(filtered);
      setActive(0);

      const entries = await Promise.all(
        filtered.map(async (e) => [e.id, await getPosterUrl(e.poster_url)] as const),
      );
      if (cancelled) return;
      const map: Record<string, string> = {};
      entries.forEach(([id, url]) => { if (url) map[id] = url; });
      setPosters(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [scopeKey, range, rangeMonth]);

  useEffect(() => {
    const lang = currentTranslationTarget(i18n.language);
    let cancelled = false;
    setTranslatedDescriptions({});

    events.forEach((event) => {
      const text = event.description?.trim();
      if (!text) return;

      const cacheKey = translationCacheKey("highlight-desc-tr", lang, event.id, text);
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setTranslatedDescriptions((prev) => ({ ...prev, [event.id]: cached }));
        return;
      }

      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("translate-text", {
            body: { text, target: lang },
          });
          if (cancelled || error || !data?.translated) return;
          setTranslatedDescriptions((prev) => ({ ...prev, [event.id]: data.translated }));
          try { sessionStorage.setItem(cacheKey, data.translated); } catch {}
        } catch {}
      })();
    });

    return () => { cancelled = true; };
  }, [events, i18n.language]);

  useEffect(() => {
    if (paused || events.length <= 1) return;
    timer.current = window.setInterval(() => {
      setActive((i) => (i + 1) % events.length);
    }, 4000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [paused, events.length]);

  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(addMonths(new Date(), i)));

  return (
    <CalendarLayout>
      <Helmet>
        <title>Catholic Event Highlights — Featured Catholic Events — Catholic Calendar</title>
        <meta
          name="description"
          content="Featured Catholic events, retreats, and parish highlights from across the community — updated monthly on The Catholic Calendar."
        />
        <link rel="canonical" href="https://thecatholiccalendar.org/catholic-calendar/highlights" />
        <meta property="og:title" content="Catholic Event Highlights — The Catholic Calendar" />
        <meta property="og:description" content="Featured Catholic events, retreats, and parish highlights from across the community." />
        <meta property="og:url" content="https://thecatholiccalendar.org/catholic-calendar/highlights" />
      </Helmet>
      <section className="relative overflow-hidden bg-gradient-to-br from-crimson via-crimson-deep to-charcoal text-ivory">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.4),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(255,215,128,0.5),transparent_45%)]" />
        <div className="relative max-w-6xl mx-auto px-5 py-12 md:py-16 text-center">
          <p className="inline-flex items-center gap-2 font-body uppercase tracking-[0.3em] text-xs text-gold-light mb-3">
            <Sparkles className="w-3.5 h-3.5" /> {t("highlights.eyebrow")}
          </p>
          <h1 className="font-display text-4xl md:text-6xl leading-tight">
            {t("highlights.titleA")}{" "}
            <span className="italic text-gold">
              {diocese ? dioceseName(diocese, i18n.language) : t("highlights.titleB")}
            </span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-ivory/75">{t("highlights.subtitle")}</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5 mt-8">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <CalendarIcon className="w-4 h-4 text-crimson shrink-0" />
          <button
            type="button"
            onClick={() => { setRange("2w"); setRangeMonth(null); }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-body uppercase tracking-[0.16em] border transition-colors ${
              range === "2w"
                ? "bg-crimson text-ivory border-crimson shadow-sm"
                : "bg-card text-charcoal/70 border-gold/40 hover:border-crimson/50"
            }`}
          >
            {t("highlights.nextTwoWeeks")}
          </button>
          {months.map((m) => {
            const on = range === "month" && rangeMonth && isSameMonth(m, rangeMonth);
            return (
              <button
                key={m.toISOString()}
                type="button"
                onClick={() => { setRange("month"); setRangeMonth(m); }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-body uppercase tracking-[0.16em] border transition-colors ${
                  on
                    ? "bg-crimson text-ivory border-crimson shadow-sm"
                    : "bg-card text-charcoal/70 border-gold/40 hover:border-crimson/50"
                }`}
              >
                {format(m, "MMMM")}
              </button>
            );
          })}
        </div>
      </div>

      <section className="max-w-6xl mx-auto px-5 py-10">
        {loading ? (
          <div className="py-24 text-center text-charcoal/50">{t("highlights.loading")}</div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-charcoal/60 mb-4">
              {range === "month" && rangeMonth
                ? t("highlights.noneMonth", { month: format(rangeMonth, "MMMM") })
                : t("highlights.noneUpcoming")}
            </p>
            <Link to="/catholic-calendar" className="text-crimson underline">
              {t("highlights.seeFull")}
            </Link>
          </div>
        ) : (
          <>
            <div className="relative">
              <Stage
                event={events[active]}
                poster={posters[events[active].id]}
                categoryLabel={categoryLabel}
                translatedDescription={translatedDescriptions[events[active].id]}
              />
              <div className="absolute inset-y-0 left-0 flex items-center">
                <button
                  onClick={() => setActive((i) => (i - 1 + events.length) % events.length)}
                  className="ml-2 p-2 rounded-full bg-ivory/90 border border-gold/40 text-charcoal hover:bg-ivory shadow-md"
                  aria-label={t("highlights.previous") as string}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  onClick={() => setActive((i) => (i + 1) % events.length)}
                  className="mr-2 p-2 rounded-full bg-ivory/90 border border-gold/40 text-charcoal hover:bg-ivory shadow-md"
                  aria-label={t("highlights.next") as string}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => setPaused((p) => !p)}
                className="absolute bottom-3 right-3 p-2 rounded-full bg-charcoal/70 text-ivory hover:bg-charcoal"
                aria-label={paused ? (t("highlights.resume") as string) : (t("highlights.pause") as string)}
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-6 overflow-hidden border-y border-gold/30 bg-ivory/60 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
              <div
                className={`flex gap-4 py-4 ${events.length > 2 && !paused ? "animate-marquee" : ""}`}
                style={{
                  width: events.length > 2 ? `${events.length * 220}px` : undefined,
                }}
              >
                {events.map((e, idx) => {
                  const thumbDiocese = isCityGroup && e.diocese_slug ? getDiocese(e.diocese_slug) : null;
                  const thumbDioceseName = thumbDiocese ? dioceseName(thumbDiocese, i18n.language) : null;
                  return (
                    <Link
                      key={e.id}
                      to={`/catholic-calendar/event/${e.id}`}
                      state={{ from: "highlights" }}
                      onMouseEnter={() => setActive(idx)}
                      className={`shrink-0 w-48 group ${idx === active ? "ring-2 ring-crimson rounded-lg" : ""}`}
                    >
                      <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border bg-charcoal/90 relative">
                        {posters[e.id] ? (
                          <img
                            src={posters[e.id]}
                            alt={e.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <PosterFallback title={e.title} category={categoryLabel(e.category)} />
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-charcoal/95 to-transparent p-2.5">
                          <p className="text-ivory text-xs font-bold truncate">{e.title}</p>
                          <p className="text-gold-light text-[10px]">{formatEventTime(e.start_at, "MMM d · h:mm a", e.diocese_slug)}</p>
                          {thumbDioceseName && (
                            <p className="text-ivory/80 text-[9px] truncate mt-0.5" title={thumbDioceseName}>{thumbDioceseName}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center gap-2 mt-4">
              {events.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === active ? "w-8 bg-crimson" : "w-1.5 bg-charcoal/20 hover:bg-charcoal/40"
                  }`}
                  aria-label={t("highlights.goToSlide", { n: i + 1 }) as string}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </CalendarLayout>
  );
}

function Stage({
  event,
  poster,
  categoryLabel,
  translatedDescription,
}: {
  event: HighlightEvent;
  poster?: string;
  categoryLabel: (v: string) => string;
  translatedDescription?: string;
}) {
  const { t, i18n } = useTranslation();
  const { isCityGroup } = useDiocese();
  const eventDiocese = isCityGroup && event.diocese_slug ? getDiocese(event.diocese_slug) : null;
  const eventDioceseName = eventDiocese ? dioceseName(eventDiocese, i18n.language) : null;
  return (
    <Link
      to={`/catholic-calendar/event/${event.id}`}
      state={{ from: "highlights" }}
      className="block relative rounded-3xl overflow-hidden border border-gold/40 bg-charcoal shadow-2xl"
      style={{ minHeight: "min(70vh, 560px)" }}
    >
      <div className="absolute inset-0">
        {poster ? (
          <img src={poster} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <PosterFallback title={event.title} category={categoryLabel(event.category)} large />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/60 to-transparent" />
      </div>
      <div className="relative h-full flex flex-col justify-end p-6 md:p-10 text-ivory" style={{ minHeight: "min(70vh, 560px)" }}>
        <div className="inline-flex items-center gap-2 mb-3 self-start flex-wrap">
          <span className="px-3 py-1 rounded-full bg-gold text-charcoal text-[10px] uppercase tracking-widest font-bold">
            {formatEventTime(event.start_at, "EEE, MMM d · h:mm a", event.diocese_slug)}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-ivory/15 backdrop-blur text-ivory text-[10px] uppercase tracking-widest">
            {categoryLabel(event.category)}
          </span>
          {eventDioceseName && (
            <span className="px-2.5 py-1 rounded-full bg-crimson/80 backdrop-blur text-ivory text-[10px] uppercase tracking-widest truncate max-w-[200px]">
              {eventDioceseName}
            </span>
          )}
          <VerifiedBadge size={16} />
        </div>
        <h2 className="font-display text-3xl md:text-5xl leading-tight max-w-3xl">{event.title}</h2>
        {(event.venue_name || event.parish) && (
          <p className="mt-2 text-ivory/80 text-sm md:text-base">
            {[event.venue_name, event.parish].filter(Boolean).join(" · ")}
          </p>
        )}
        {event.description && (
          <p className="mt-3 text-ivory/70 text-sm md:text-base max-w-2xl line-clamp-2">
            {translatedDescription ?? event.description}
          </p>
        )}
        <span className="mt-5 inline-flex items-center self-start gap-2 px-5 py-2.5 rounded-md bg-crimson hover:bg-crimson-deep text-ivory font-bold text-sm">
          {t("highlights.seeEvent")}
        </span>
      </div>
    </Link>
  );
}

function PosterFallback({ title, category, large }: { title: string; category: string; large?: boolean }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-crimson via-crimson-deep to-charcoal">
      <div className="text-center px-4">
        <Sparkles className={`mx-auto text-gold mb-3 ${large ? "w-14 h-14" : "w-8 h-8"}`} />
        <p className={`font-display text-ivory ${large ? "text-3xl" : "text-base"} leading-tight`}>{title}</p>
        <p className="text-gold-light text-[10px] uppercase tracking-[0.3em] mt-2">{category}</p>
      </div>
    </div>
  );
}
