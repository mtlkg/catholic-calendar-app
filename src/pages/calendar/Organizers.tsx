import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, MapPin, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import CalendarLayout, { CATEGORIES, useCategoryLabel } from "./CalendarLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import FollowButton from "@/components/FollowButton";
import { currentTranslationTarget, translationCacheKey } from "@/lib/translation";
import { useDiocese } from "@/context/DioceseContext";

type Org = {
  id: string;
  user_id: string;
  org_name: string | null;
  parish: string | null;
  description: string | null;
  categories: string[] | null;
  website_url: string | null;
  logo_url: string | null;
  diocese_slug: string | null;
  diocese_slugs?: string[] | null;
  status?: string | null;
  created_at?: string | null;
};

/** Verified (approved) organizers always sort above everyone else. */
const isVerifiedOrg = (o: Org) => o.status === "approved";
const verifiedFirst = (a: Org, b: Org) => {
  const v = Number(isVerifiedOrg(b)) - Number(isVerifiedOrg(a));
  if (v !== 0) return v;
  // Among verified organizers, the earliest to become verified stays on top.
  if (isVerifiedOrg(a) && isVerifiedOrg(b)) {
    return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
  }
  return 0;
};

export default function Organizers() {
  const { t, i18n } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const { diocese, scopeSlugs, scopeKey } = useDiocese();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCats, setActiveCats] = useState<string[]>([]);
  const [translatedDescriptions, setTranslatedDescriptions] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Organizers appear in a diocese only when their own profile lists it —
      // never because they happened to publish an event there.
      const { data } = await (supabase as any)
        .from("organizer_profiles_public")
        .select("id,user_id,org_name,parish,description,categories,website_url,logo_url,diocese_slug,diocese_slugs,status,created_at");
      if (cancelled) return;
      const all = ((data ?? []) as unknown) as Org[];
      const list = all.filter((o) => {
        const slugs = o.diocese_slugs?.length
          ? o.diocese_slugs
          : o.diocese_slug
            ? [o.diocese_slug]
            : [];
        // No diocese at all means the organizer is global (shown everywhere).
        if (slugs.length === 0) return true;
        return slugs.some((s) => scopeSlugs.includes(s));
      });
      list.sort(
        (a, b) =>
          verifiedFirst(a, b) ||
          (a.org_name ?? "").localeCompare(b.org_name ?? "", undefined, { sensitivity: "base" }),
      );
      setOrgs(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [scopeKey]);

  useEffect(() => {
    const lang = currentTranslationTarget(i18n.language);
    let cancelled = false;
    setTranslatedDescriptions({});

    const descriptions = orgs
      .map((o) => ({ org: o, text: o.description?.trim() ?? "" }))
      .filter(({ text }) => text.length > 0);

    if (descriptions.length === 0) return;

    descriptions.forEach(({ org, text }) => {
      const cacheKey = translationCacheKey("org-list-desc-tr", lang, org.id, text);
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setTranslatedDescriptions((prev) => ({ ...prev, [org.id]: cached }));
        return;
      }

      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke("translate-text", {
            body: { text, target: lang },
          });
          if (cancelled || error || !data?.translated) return;
          setTranslatedDescriptions((prev) => ({ ...prev, [org.id]: data.translated }));
          try { sessionStorage.setItem(cacheKey, data.translated); } catch {}
        } catch {}
      })();
    });

    return () => { cancelled = true; };
  }, [orgs, i18n.language]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const matched = orgs.filter((o) => {
      if (activeCats.length) {
        const cats = o.categories ?? [];
        if (!activeCats.some((c) => cats.includes(c))) return false;
      }
      if (!q) return true;
      const hay = [o.org_name, o.parish, o.description, ...(o.categories ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    if (!q) return [...matched].sort(verifiedFirst);
    const score = (o: Org) => {
      const name = (o.org_name ?? "").toLowerCase();
      if (name.startsWith(q)) return 0;
      if (name.includes(q)) return 1;
      if ((o.parish ?? "").toLowerCase().includes(q)) return 2;
      return 3;
    };
    return [...matched].sort((a, b) => {
      const v = verifiedFirst(a, b);
      if (v !== 0) return v;
      const s = score(a) - score(b);
      if (s !== 0) return s;
      return (a.org_name ?? "").localeCompare(b.org_name ?? "", undefined, { sensitivity: "base" });
    });
  }, [orgs, q, activeCats]);

  const suggestions = useMemo(() => {
    if (!q) return [];
    return orgs
      .filter((o) => (o.org_name ?? "").toLowerCase().includes(q))
      .sort(verifiedFirst)
      .slice(0, 5);
  }, [orgs, q]);

  const toggleCat = (c: string) =>
    setActiveCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <CalendarLayout>
      <Helmet>
        <title>Catholic Organizers & Parishes — Catholic Calendar</title>
        <meta
          name="description"
          content="Browse Catholic organizers, parishes, and communities hosting Catholic events, retreats, and Masses on The Catholic Calendar."
        />
        <link rel="canonical" href="https://thecatholiccalendar.org/catholic-calendar/organizers" />
        <meta property="og:title" content="Catholic Organizers & Parishes — The Catholic Calendar" />
        <meta property="og:description" content="Browse Catholic organizers and parishes hosting events in your community." />
        <meta property="og:url" content="https://thecatholiccalendar.org/catholic-calendar/organizers" />
      </Helmet>
      <section className="max-w-5xl mx-auto px-5 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <p className="font-body text-crimson uppercase tracking-[0.3em] text-xs mb-2">{t("organizers.eyebrow")}</p>
            <h1 className="font-display text-3xl md:text-4xl">{t("organizers.title")}</h1>
            <p className="text-charcoal/70 mt-2 max-w-2xl">{t("organizers.subtitle")}</p>
          </div>
          <Link
            to="/catholic-calendar/auth?mode=signup"
            className="px-4 py-2 rounded-md bg-crimson text-ivory text-sm font-bold hover:bg-crimson-deep"
          >
            {t("organizers.becomeOrganizer")}
          </Link>
        </div>

        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("organizers.searchPlaceholder") as string}
              className="w-full h-10 pl-9 pr-9 rounded-md border border-border bg-card text-sm focus:outline-none focus:border-crimson"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-charcoal/50 hover:text-crimson"
                aria-label={t("organizers.clearSearch") as string}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                {suggestions.map((o) => (
                  <button
                    key={o.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate(`/catholic-calendar/organizers/${o.user_id}`);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted text-sm"
                  >
                    {o.logo_url ? (
                      <img src={o.logo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-crimson/15 text-crimson grid place-items-center text-xs font-display">
                        {(o.org_name?.[0] ?? "?").toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate inline-flex items-center gap-1">
                        <span className="truncate">{o.org_name || t("organizers.unnamed")}</span>
                        {isVerifiedOrg(o) && <VerifiedBadge size={12} className="shrink-0" />}
                      </div>
                      {o.parish && (
                        <div className="text-[11px] text-charcoal/50 truncate">{o.parish}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs uppercase tracking-wider text-charcoal/50 self-center mr-1">
              {t("organizers.filter")}
            </span>
            {CATEGORIES.map((c) => {
              const on = activeCats.includes(c.value);
              return (
                <button
                  key={c.value}
                  onClick={() => toggleCat(c.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    on
                      ? "bg-crimson text-ivory border-crimson"
                      : "bg-card text-charcoal/70 border-border hover:border-crimson/40"
                  }`}
                >
                  {categoryLabel(c.value)}
                </button>
              );
            })}
            {activeCats.length > 0 && (
              <button
                onClick={() => setActiveCats([])}
                className="text-xs text-crimson hover:underline self-center ml-1"
              >
                {t("organizers.clear")}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-charcoal/50">{t("organizers.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-charcoal/60">
            {orgs.length === 0 ? t("organizers.noneYet") : t("organizers.noneMatch")}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((o) => (
              <Link
                key={o.id}
                to={`/catholic-calendar/organizers/${o.user_id}`}
                className="block p-5 rounded-lg border border-border bg-card hover:border-crimson/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {o.logo_url ? (
                    <img src={o.logo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-crimson/15 text-crimson grid place-items-center font-display text-lg">
                      {(o.org_name?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 leading-tight">
                      <span className="font-display text-lg leading-none">
                        {o.org_name || t("organizers.unnamed")}
                      </span>
                      {isVerifiedOrg(o) && <VerifiedBadge size={16} className="shrink-0 relative top-[1px]" />}
                    </div>
                    {o.parish && (
                      <p className="mt-1 text-xs text-charcoal/60 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {o.parish}
                      </p>
                    )}
                    {o.categories && o.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {o.categories.slice(0, 4).map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-crimson/10 text-crimson"
                          >
                            {categoryLabel(c)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {o.description && (
                  <p className="mt-3 text-sm text-charcoal/70 line-clamp-3">
                    {translatedDescriptions[o.id] ?? o.description}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                  <FollowButton
                    organizerUserId={o.user_id}
                    organizerName={o.org_name || t("event.organizerFallback")}
                    variant="compact"
                  />
                  {o.website_url && (
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(o.website_url!, "_blank", "noopener,noreferrer");
                      }}
                      className="inline-flex items-center gap-1 text-crimson hover:underline cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" /> {t("organizers.website")}
                    </span>
                  )}
                </div>

              </Link>
            ))}
          </div>
        )}
      </section>
    </CalendarLayout>
  );
}
