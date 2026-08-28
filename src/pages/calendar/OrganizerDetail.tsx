import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams, useLocation } from "react-router-dom";
import { parseISO } from "date-fns";
import { format } from "@/lib/dateLocale";
import { formatEventTime } from "@/lib/timezone";
import { ArrowLeft, ExternalLink, Mail, Phone, MapPin, CalendarDays, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import CalendarLayout, { useCategoryLabel } from "./CalendarLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import FollowButton from "@/components/FollowButton";
import { currentTranslationTarget, translationCacheKey } from "@/lib/translation";

export default function OrganizerDetail() {
  const { t, i18n } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const { userId = "" } = useParams();
  const location = useLocation();
  const fromMessages = (location.state as any)?.fromMessages === true;
  const backTo = (location.state as any)?.backTo as string | undefined;
  const backLabel = (location.state as any)?.backLabel as string | undefined;
  const [org, setOrg] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApprovedOrganizer, setIsApprovedOrganizer] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);


  const displayName = (name?: string | null): string => {
    if (!name) return t("organizer.fallbackName");
    const s = name.trim();
    if (!s || s.includes("@")) return t("organizer.fallbackName");
    return s;
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: o } = await (supabase as any)
        .from("organizer_profiles_public")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setOrg(o);
      const { data: e } = await (supabase as any)
        .from("calendar_events_public")
        .select("id,title,start_at,venue_name,category,status,diocese_slug")
        .eq("submitted_by_user_id", userId)
        .order("start_at", { ascending: false });
      setEvents(e ?? []);
      const { data: sess } = await supabase.auth.getSession();
      const viewer = sess.session?.user;
      if (viewer) {
        setViewerId(viewer.id);
        const { data: myProf } = await supabase
          .from("organizer_profiles").select("status").eq("user_id", viewer.id).maybeSingle();
        setIsApprovedOrganizer(myProf?.status === "approved");
      } else {
        setViewerId(null);
        setIsApprovedOrganizer(false);
      }
      setLoading(false);
    })();
  }, [userId]);

  useEffect(() => {
    const desc = org?.description?.trim();
    setTranslatedDescription(null);
    if (!desc) return;
    const lang = currentTranslationTarget(i18n.language);
    const cacheKey = translationCacheKey("org-desc-tr", lang, userId, desc);
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
  }, [org?.description, i18n.language, userId]);

  if (loading) return <CalendarLayout><div className="py-20 text-center text-charcoal/50">{t("organizer.loading")}</div></CalendarLayout>;
  if (!org) return (
    <CalendarLayout>
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <p className="text-charcoal/60">{t("organizer.notFound")}</p>
        <Link to="/catholic-calendar/organizers" className="text-crimson hover:underline text-sm">{t("organizer.backAll")}</Link>
      </div>
    </CalendarLayout>
  );

  const verified = org.status === "approved";
  const name = displayName(org.org_name);
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.start_at) >= now);
  const past = events.filter((e) => new Date(e.start_at) < now);

  const canonicalUrl = `https://thecatholiccalendar.org/catholic-calendar/organizers/${userId}`;
  const seoTitle = `${name} — Catholic Events & Organizer Profile — Catholic Calendar`;
  const rawDesc = (org.description ?? "").replace(/\s+/g, " ").trim();
  const seoDescription = rawDesc
    ? rawDesc.slice(0, 155) + (rawDesc.length > 155 ? "…" : "")
    : `${name} — Catholic events organizer on The Catholic Calendar. See upcoming Catholic events, Masses, and parish activities from ${name}.`;

  return (
    <CalendarLayout>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={canonicalUrl} />
        {org.logo_url && <meta property="og:image" content={org.logo_url} />}
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
      </Helmet>
      <section className="max-w-3xl mx-auto px-5 py-8">
        {backTo ? (
          <Link to={backTo} className="inline-flex items-center gap-1 text-xs text-charcoal/60 hover:text-crimson mb-4">
            <ArrowLeft className="w-3.5 h-3.5" />{" "}
            {backLabel === "thread"
              ? t("organizer.backThread")
              : backLabel === "back"
                ? t("organizer.backPrev")
                : t("organizer.backMessages")}
          </Link>
        ) : fromMessages ? (
          <Link to="/catholic-calendar/dashboard?tab=messages" className="inline-flex items-center gap-1 text-xs text-charcoal/60 hover:text-crimson mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> {t("organizer.backMessages")}
          </Link>
        ) : (
          <Link to="/catholic-calendar/organizers" className="inline-flex items-center gap-1 text-xs text-charcoal/60 hover:text-crimson mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> {t("organizer.backAllShort")}
          </Link>
        )}

        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-start gap-4">
            {org.logo_url ? (
              <img src={org.logo_url} alt="" className="w-20 h-20 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-crimson/15 text-crimson grid place-items-center font-display text-3xl">
                {(name[0] || "?").toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl md:text-3xl inline-flex items-center gap-2">
                {name}
                {verified && <VerifiedBadge size={20} />}
              </h1>
              {org.parish && (
                <p className="text-sm text-charcoal/60 mt-1 flex items-center gap-1 whitespace-nowrap">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{org.parish}</span>
                </p>
              )}
              {org.categories?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {org.categories.map((c: string) => (
                    <span key={c} className="text-[10px] uppercase tracking-wide bg-muted text-charcoal/70 px-2 py-0.5 rounded">{categoryLabel(c)}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {org.description && <p className="text-sm text-charcoal/80 mt-4 whitespace-pre-wrap">{translatedDescription ?? org.description}</p>}

          <div className="flex flex-wrap gap-3 mt-4 text-xs">
            {org.contact_email && (
              <a href={`mailto:${org.contact_email}`} className="inline-flex items-center gap-1 text-charcoal/70 hover:text-crimson">
                <Mail className="w-3.5 h-3.5" /> {org.contact_email}
              </a>
            )}
            {isApprovedOrganizer && org.contact_phone && (
              <a href={`tel:${org.contact_phone}`} className="inline-flex items-center gap-1 text-charcoal/70 hover:text-crimson">
                <Phone className="w-3.5 h-3.5" /> {org.contact_phone}
              </a>
            )}
            {org.website_url && (
              <a href={org.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-charcoal/70 hover:text-crimson">
                <ExternalLink className="w-3.5 h-3.5" /> {t("common.website")}
              </a>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <FollowButton organizerUserId={userId} organizerName={name} />
            {isApprovedOrganizer && viewerId && viewerId !== userId && (
              <Link
                to={`/catholic-calendar/dashboard?tab=messages&peer=${userId}`}
                className="inline-flex items-center gap-2 bg-crimson text-ivory px-4 py-2 rounded-md text-sm hover:bg-crimson/90"
              >
                <MessageSquare className="w-4 h-4" /> {t("organizer.directMessage")}
              </Link>
            )}
          </div>

        </div>

        <section className="mt-8">
          <h2 className="font-display text-xl mb-3 inline-flex items-center gap-2"><CalendarDays className="w-5 h-5" /> {t("organizer.upcoming")}</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-charcoal/50">{t("organizer.noneUpcoming")}</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((e) => <EventRow key={e.id} e={e} categoryLabel={categoryLabel} />)}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl mb-3">{t("organizer.past")}</h2>
            <div className="space-y-2">
              {past.map((e) => <EventRow key={e.id} e={e} categoryLabel={categoryLabel} />)}
            </div>
          </section>
        )}
      </section>
    </CalendarLayout>
  );
}

function EventRow({ e, categoryLabel }: { e: any; categoryLabel: (v: string) => string }) {
  return (
    <Link to={`/catholic-calendar/event/${e.id}`} className="block p-3 rounded-md border border-border bg-card hover:border-crimson/40 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold truncate">{e.title}</h3>
          <p className="text-xs text-charcoal/60 truncate">
            {formatEventTime(e.start_at, "MMM d, yyyy · h:mm a", (e as any).diocese_slug)}
            {e.venue_name && ` · ${e.venue_name}`}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide bg-muted px-2 py-0.5 rounded text-charcoal/70 shrink-0">{categoryLabel(e.category)}</span>
      </div>
    </Link>
  );
}
