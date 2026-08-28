import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, Link, useLocation } from "react-router-dom";
import { parseISO } from "date-fns";
import { format } from "@/lib/dateLocale";
import { formatEventTime, zoneForSlug, zoneAbbrev } from "@/lib/timezone";
import { ArrowLeft, MapPin, Calendar, ExternalLink, Mail, Ticket, Heart, X, Check, Globe, Languages, Video } from "lucide-react";
import { eventLanguagesLabel } from "@/data/eventLanguages";
import { DIOCESE_BY_SLUG, dioceseName, dioceseRegionCode } from "@/data/dioceses";
import { AudienceEvent, isBroadcastEvent, broadcastBadgeKey, broadcastBadgeClasses } from "@/lib/eventAudience";
import { useTranslation, Trans } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import CalendarLayout, { CATEGORY_COLORS, useCategoryLabel } from "./CalendarLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import FollowButton from "@/components/FollowButton";
import { getPosterUrl } from "@/lib/posterUrl";
import { resolveEventVideo, type VideoSource } from "@/lib/eventVideo";
import { currentTranslationTarget, translationCacheKey } from "@/lib/translation";

function formatPrice(note: string | null): string {
  if (!note) return "";
  const trimmed = note.trim();
  if (/^\d+(\.\d{1,2})?$/.test(trimmed)) return `$${trimmed}`;
  return trimmed;
}

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  venue_name: string | null;
  address: string | null;
  parish: string | null;
  registration_url: string | null;
  is_free: boolean;
  price_note: string | null;
  guest_name: string | null;
  submitted_by_user_id: string | null;
  poster_url: string | null;
  video_url: string | null;
  event_language: string | null;
  event_languages: string[] | null;
};

export default function EventDetail() {
  const { t, i18n } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const fromHighlights = (location.state as any)?.from === "highlights";
  const fromMap = (location.state as any)?.from === "map";
  const mapDioceseSlug = (location.state as any)?.dioceseSlug as string | undefined;
  const [ev, setEv] = useState<EventRow | null>(null);
  const [organizer, setOrganizer] = useState<{ org_name: string | null; contact_email: string | null; website_url: string | null; status: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [posterSrc, setPosterSrc] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<VideoSource | null>(null);
  const [interestedOpen, setInterestedOpen] = useState(false);
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("calendar_events_public")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const row = data as any;
      setEv(row as EventRow);
      if (row?.poster_url) getPosterUrl(row.poster_url).then(setPosterSrc);
      if (row?.video_url) resolveEventVideo(row.video_url).then(setVideoSrc);
      if (row?.submitted_by_user_id) {
        const { data: org } = await (supabase as any)
          .from("organizer_profiles_public")
          .select("org_name,website_url,status")
          .eq("user_id", row.submitted_by_user_id)
          .maybeSingle();
        setOrganizer(org as any);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    const desc = ev?.description?.trim();
    setTranslatedDescription(null);
    if (!desc || !ev?.id) return;
    const lang = currentTranslationTarget(i18n.language);
    const cacheKey = translationCacheKey("event-desc-tr", lang, ev.id, desc);
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      setTranslatedDescription(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("translate-text", {
          body: { text: desc, target: lang },
        });
        if (cancelled) return;
        if (!error && data?.translated) {
          setTranslatedDescription(data.translated);
          try { sessionStorage.setItem(cacheKey, data.translated); } catch {}
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [ev?.description, ev?.id, i18n.language]);

  if (loading) return <CalendarLayout><div className="py-20 text-center text-charcoal/50">{t("event.loading")}</div></CalendarLayout>;
  if (!ev) return (
    <CalendarLayout>
      <div className="py-20 text-center">
        <p className="text-charcoal/60 mb-4">{t("event.notFound")}</p>
        <Link to="/catholic-calendar" className="text-crimson underline">{t("event.backCalendar")}</Link>
      </div>
    </CalendarLayout>
  );

  const start = parseISO(ev.start_at);
  const end = ev.end_at ? parseISO(ev.end_at) : null;
  // Event times are always shown in the event's own diocese time zone.
  const evZone = zoneForSlug((ev as any).diocese_slug);
  const fmtStart = (f: string) => formatEventTime(ev.start_at, f, (ev as any).diocese_slug);
  const fmtEnd = (f: string) => (ev.end_at ? formatEventTime(ev.end_at, f, (ev as any).diocese_slug) : "");
  const zoneLabel = zoneAbbrev(ev.start_at, evZone);

  const canonicalUrl = `https://thecatholiccalendar.org/catholic-calendar/event/${ev.id}`;
  const seoTitle = `${ev.title} — ${fmtStart("MMM d, yyyy")} — Catholic Calendar`;
  const rawDesc = (ev.description ?? "").replace(/\s+/g, " ").trim();
  const seoDescription = rawDesc
    ? rawDesc.slice(0, 155) + (rawDesc.length > 155 ? "…" : "")
    : `${ev.title} — Catholic event on ${fmtStart("MMMM d, yyyy")}${ev.venue_name ? ` at ${ev.venue_name}` : ""}. Discover more Catholic events on The Catholic Calendar.`;
  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    startDate: ev.start_at,
    ...(ev.end_at ? { endDate: ev.end_at } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(ev.venue_name || ev.address
      ? {
          location: {
            "@type": "Place",
            name: ev.venue_name ?? ev.address ?? "",
            ...(ev.address ? { address: ev.address } : {}),
          },
        }
      : {}),
    ...(rawDesc ? { description: rawDesc.slice(0, 500) } : {}),
    url: canonicalUrl,
    ...(posterSrc ? { image: posterSrc } : {}),
  };

  return (
    <CalendarLayout>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="event" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={canonicalUrl} />
        {posterSrc && <meta property="og:image" content={posterSrc} />}
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <script type="application/ld+json">{JSON.stringify(eventJsonLd)}</script>
      </Helmet>
      <article className="max-w-3xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link
            to={
              fromMap && mapDioceseSlug
                ? `/catholic-calendar/d/${mapDioceseSlug}?view=map`
                : fromHighlights
                  ? "/catholic-calendar/highlights"
                  : "/catholic-calendar"
            }
            state={fromHighlights ? { from: "event" } : undefined}
            className="inline-flex items-center gap-2 text-sm text-charcoal/60 hover:text-charcoal"
          >
            <ArrowLeft className="w-4 h-4" />{" "}
            {fromMap ? t("event.backMap") : fromHighlights ? t("event.backHighlights") : t("event.backCalendar")}
          </Link>
          <span className={`inline-block px-2.5 py-1 rounded text-xs uppercase tracking-wide border ${CATEGORY_COLORS[ev.category] ?? CATEGORY_COLORS.other}`}>
            {categoryLabel(ev.category)}
          </span>
        </div>

        {posterSrc && (
          <div className="mb-6 rounded-lg overflow-hidden border border-gold/30 bg-charcoal/5 shadow-md">
            <img
              src={posterSrc}
              alt={`${ev.title} poster`}
              className="w-full max-h-[560px] object-contain bg-charcoal/95"
            />
          </div>
        )}

        {videoSrc && (
          <section id="video" className="mb-6 scroll-mt-24 rounded-xl overflow-hidden border border-gold/40 shadow-md bg-charcoal">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-crimson-deep via-crimson to-crimson-deep text-ivory">
              <Video className="w-4 h-4 text-gold-light" />
              <span className="text-[10px] uppercase tracking-[0.22em] font-body">{t("video.promo")}</span>
            </div>
            <div className="aspect-video bg-charcoal">
              {videoSrc.kind === "embed" ? (
                <iframe
                  src={videoSrc.src}
                  title={`${ev.title} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              ) : (
                <video src={videoSrc.src} controls playsInline className="w-full h-full" />
              )}
            </div>
          </section>
        )}

        <h1 className="font-display text-3xl md:text-5xl text-charcoal leading-tight mb-4">{ev.title}</h1>

        <div className="space-y-2 mb-6 text-charcoal/80">
          <p className="flex items-start gap-2">
            <Calendar className="w-4 h-4 mt-1 shrink-0 text-crimson" />
            <span>
              {(() => {
                const sameDay = end ? fmtStart("yyyy-MM-dd") === fmtEnd("yyyy-MM-dd") : true;
                if (ev.all_day) {
                  return (
                    <>
                      <span className="font-bold">{t("event.starts")}</span> {fmtStart("EEEE, MMMM d, yyyy")} · {t("event.allDay")}
                      {end && (
                        <>
                          <br />
                          <span className="font-bold">{t("event.ends")}</span> {fmtEnd("EEEE, MMMM d, yyyy")} · {t("event.allDay")}
                        </>
                      )}
                    </>
                  );
                }
                if (!end) {
                  return (
                    <>
                      <span className="font-bold">{t("event.starts")}</span> {fmtStart("EEEE, MMMM d, yyyy")} · {fmtStart("h:mm a")} {zoneLabel}
                    </>
                  );
                }
                if (sameDay) {
                  return (
                    <>
                      {fmtStart("EEEE, MMMM d, yyyy")}
                      <br />
                      {fmtStart("h:mm a")} – {fmtEnd("h:mm a")} {zoneLabel}
                    </>
                  );
                }
                return (
                  <>
                    <span className="font-bold">{t("event.starts")}</span> {fmtStart("EEEE, MMMM d, yyyy")} · {fmtStart("h:mm a")} {zoneLabel}
                    <br />
                    <span className="font-bold">{t("event.ends")}</span> {fmtEnd("EEEE, MMMM d, yyyy")} · {fmtEnd("h:mm a")} {zoneLabel}
                  </>
                );
              })()}
            </span>
          </p>
          {(ev.venue_name || ev.address) && (
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-1 shrink-0 text-crimson" />
              <span>
                {ev.venue_name && <span className="font-bold">{ev.venue_name}</span>}
                {ev.venue_name && ev.address && <br />}
                {ev.address}
                {(ev.venue_name || ev.address) && (
                  <>
                    {" · "}
                    <a
                      className="text-crimson hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ev.venue_name ?? ""} ${ev.address ?? ""}`)}`}
                    >
                      {t("event.openMaps")}
                    </a>
                  </>
                )}
              </span>
            </p>
          )}
          <p className="flex items-start gap-2">
            <Ticket className="w-4 h-4 mt-1 shrink-0 text-crimson" />
            <span>
              <span className="font-bold">{t("event.cost")}</span>{" "}
              {ev.is_free ? t("event.free") : (formatPrice(ev.price_note) || t("event.paid"))}
            </span>
          </p>
          {ev.event_languages && ev.event_languages.length > 0 && (
            <p className="flex items-start gap-2">
              <Languages className="w-4 h-4 mt-1 shrink-0 text-crimson" />
              <span>
                <span className="font-bold">{t("event.language")}</span>{" "}
                {eventLanguagesLabel(ev.event_languages)}
              </span>
            </p>
          )}
        </div>

        {ev.description && (
          <div className="prose prose-stone max-w-none whitespace-pre-wrap text-charcoal/80 mb-8 font-body leading-relaxed">
            {translatedDescription ?? ev.description}
          </div>
        )}

        <AudiencePanel event={ev as any} />


        <div className="flex flex-wrap gap-3 mb-10">
          {ev.registration_url && (
            <a
              href={ev.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-crimson text-ivory font-bold hover:bg-crimson-deep"
            >
              {t("event.register")} <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {organizer?.status === "approved" && (
            <button
              onClick={() => setInterestedOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border-2 border-crimson text-crimson font-bold hover:bg-crimson hover:text-ivory transition-colors"
            >
              <Heart className="w-4 h-4" /> {t("event.interested")}
            </button>
          )}
        </div>

        {(organizer || ev.parish || ev.guest_name) && (
          <aside className="border-t border-gold/30 pt-6">
            <h3 className="font-display text-lg mb-2">{t("event.hostedBy")}</h3>
            <p className="text-charcoal/80 inline-flex items-center gap-1.5">
              {organizer?.status === "approved" && ev.submitted_by_user_id ? (
                <Link
                  to={`/catholic-calendar/organizers/${ev.submitted_by_user_id}`}
                  className="text-crimson hover:underline font-bold"
                >
                  {organizer.org_name || ev.parish || ev.guest_name}
                </Link>
              ) : (
                <span>{organizer?.org_name || ev.parish || ev.guest_name}</span>
              )}
              {organizer?.status === "approved" && <VerifiedBadge size={16} />}
            </p>
            <div className="flex flex-wrap gap-4 text-sm mt-2 items-center">
              {organizer?.status === "approved" && ev.submitted_by_user_id && (
                <FollowButton
                  organizerUserId={ev.submitted_by_user_id}
                  organizerName={organizer.org_name || ev.parish || t("event.organizerFallback")}
                  variant="compact"
                />
              )}
              {organizer?.website_url && (
                <a href={organizer.website_url} target="_blank" rel="noopener noreferrer" className="text-crimson hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" /> {t("common.website")}
                </a>
              )}
              {organizer?.contact_email && (
                <a href={`mailto:${organizer.contact_email}`} className="text-crimson hover:underline inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {t("common.contact")}
                </a>
              )}
            </div>

          </aside>
        )}
      </article>

      {interestedOpen && (
        <InterestedModal
          eventId={ev.id}
          eventTitle={ev.title}
          onClose={() => setInterestedOpen(false)}
        />
      )}
    </CalendarLayout>
  );
}

/** Shows who is invited for multi-diocese, regional and nationwide events. */
function AudiencePanel({ event }: { event: AudienceEvent }) {
  const { t, i18n } = useTranslation();
  if (!isBroadcastEvent(event)) return null;

  const lang = i18n.language;
  const host = event.diocese_slug ? DIOCESE_BY_SLUG[event.diocese_slug] : null;
  // Regional and national scopes already describe their audience succinctly.
  // Individual dioceses are only meaningful when the organizer selected them manually.
  const invitedSlugs = event.audience_scope === "multi"
    ? (event.audience_diocese_slugs ?? []).filter((s) => s !== event.diocese_slug)
    : [];
  const invited = invitedSlugs.map((s) => DIOCESE_BY_SLUG[s]).filter(Boolean);
  const countryName = (c: string) =>
    c === "CA"
      ? (lang.startsWith("fr") ? "Canada" : lang.startsWith("es") ? "Canadá" : "Canada")
      : (lang.startsWith("fr") ? "États-Unis" : lang.startsWith("es") ? "Estados Unidos" : "United States");

  let summary: string | null = null;
  if (event.audience_scope === "national") {
    summary = t("event.audienceNational", {
      countries: (event.audience_countries ?? []).map(countryName).join(" · "),
    });
  } else if (event.audience_scope === "regional") {
    summary = t("event.audienceRegional", { region: dioceseRegionCode(host) ?? "" });
  }

  return (
    <section className="mb-10 rounded-lg border border-gold/40 bg-gold/5 p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide border ${broadcastBadgeClasses(event)}`}>
          <Globe className="w-3.5 h-3.5" /> {t(broadcastBadgeKey(event))}
        </span>
        <h3 className="font-display text-lg text-charcoal">{t("event.audienceTitle")}</h3>
      </div>
      {host && (
        <p className="text-sm text-charcoal/80 mb-2">
          {t("event.audienceHost", { name: dioceseName(host, lang) })}
        </p>
      )}
      {summary && <p className="text-sm text-charcoal/80">{summary}</p>}
      {invited.length > 0 && (
        <>
          <p className="text-sm text-charcoal/80 mt-2 mb-2">
            {t("event.audienceMulti")}{" "}
            <span className="text-charcoal/60">({t("event.audienceCount", { count: invited.length })})</span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {invited.map((d) => (
              <li key={d.slug} className="px-2.5 py-1 rounded-full border border-gold/50 bg-ivory text-xs text-charcoal/80">
                {dioceseName(d, lang)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}


function InterestedModal({ eventId, eventTitle, onClose }: { eventId: string; eventTitle: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) setEmail(data.session.user.email);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("event.invalidEmail"));
      return;
    }
    setSubmitting(true);
    const { data: session } = await supabase.auth.getSession();
    const { error: err } = await (supabase as any)
      .from("event_interests")
      .insert({ event_id: eventId, email: trimmed, user_id: session.session?.user?.id ?? null });
    setSubmitting(false);
    if (err && !/duplicate|unique/i.test(err.message)) {
      setError(err.message);
      return;
    }
    (async () => {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "organizer-new-interest",
            idempotencyKey: `interest-${eventId}-${trimmed}`,
            templateData: {
              eventId,
              interestedEmail: trimmed,
            },
          },
        });
      } catch {
        /* swallow */
      }
    })();

    setDone(true);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-ivory border border-gold/40 shadow-2xl p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-charcoal/60 hover:bg-charcoal/10"
          aria-label={t("common.close") as string}
        >
          <X className="w-4 h-4" />
        </button>
        {done ? (
          <div className="text-center py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-crimson/10 flex items-center justify-center mb-3">
              <Check className="w-6 h-6 text-crimson" />
            </div>
            <h3 className="font-display text-2xl text-charcoal mb-2">{t("event.onTheList")}</h3>
            <p className="text-sm text-charcoal/70">
              <Trans
                i18nKey="event.reminderSuccess"
                values={{ email, title: eventTitle }}
                components={{ strong: <strong />, em: <em /> }}
              />
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-5 py-2 rounded-md bg-crimson text-ivory font-bold hover:bg-crimson-deep text-sm"
            >
              {t("common.gotIt")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-crimson fill-crimson/20" />
              <h3 className="font-display text-2xl text-charcoal">{t("event.reminderTitle")}</h3>
            </div>
            <p className="text-sm text-charcoal/70 mb-4">
              <Trans
                i18nKey="event.reminderBody"
                values={{ title: eventTitle }}
                components={{ strong: <strong /> }}
              />
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-crimson/40 mb-3"
            />
            {error && <p className="text-xs text-destructive mb-3">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-5 py-2.5 rounded-md bg-crimson text-ivory font-bold hover:bg-crimson-deep disabled:opacity-50 text-sm"
            >
              {submitting ? t("common.submitting") : t("event.remindMe")}
            </button>
            <p className="text-[11px] text-charcoal/50 mt-2 text-center">{t("event.emailPrivacy")}</p>
          </form>
        )}
      </div>
    </div>
  );
}
