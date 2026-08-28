import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dioceseBySlug, useDioceseName } from "@/context/DioceseContext";

type Stats = any;

function Card({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-charcoal/55 font-bold">{label}</p>
      <p className="font-display text-3xl text-crimson leading-tight mt-1">{value}</p>
      {hint && <p className="text-[11px] text-charcoal/50 mt-1">{hint}</p>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="font-display text-lg mb-3">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>
    </section>
  );
}

function Breakdown({ title, entries, labelFor }: {
  title: string;
  entries: [string, number][];
  labelFor?: (key: string) => string;
}) {
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, v]) => v)) || 1;
  return (
    <section className="mb-8">
      <h3 className="font-display text-lg mb-3">{title}</h3>
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-44 shrink-0 text-xs text-charcoal/70 truncate">{labelFor ? labelFor(k) : k}</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-crimson/70 rounded-full" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-bold text-charcoal/80">{v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminStats({ scopeSlugs }: { scopeSlugs: string[] | null }) {
  const { t } = useTranslation();
  const nameOf = useDioceseName();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = scopeSlugs ? scopeSlugs.join(",") : "all";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await (supabase as any).rpc("admin_stats", {
        _diocese_slugs: scopeSlugs,
      });
      if (cancelled) return;
      if (error) setError(error.message);
      else setStats(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [key]);

  if (loading) return <p className="text-sm text-charcoal/50">{t("admin.loading")}</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!stats) return null;

  const o = stats.organizers ?? {};
  const e = stats.events ?? {};
  const en = stats.engagement ?? {};
  const c = stats.community ?? {};
  const em = stats.emails ?? {};
  const byCat: [string, number][] = Object.entries(stats.eventsByCategory ?? {}) as any;
  const byDio: [string, number][] = Object.entries(stats.eventsByDiocese ?? {}) as any;
  const byMonth: [string, number][] = (Object.entries(stats.eventsByMonth ?? {}) as any).sort(
    (a: any, b: any) => String(a[0]).localeCompare(String(b[0])),
  );
  const topOrgs: { name: string; events: number }[] = stats.topOrganizers ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-5 h-5 text-crimson" />
        <h2 className="font-display text-xl">{t("admin.stats.title", { defaultValue: "Statistics" })}</h2>
      </div>

      <Group title={t("admin.stats.organizers", { defaultValue: "Organizers" })}>
        <Card label={t("admin.stats.verified", { defaultValue: "Verified organizers" })} value={o.approved ?? 0} />
        <Card label={t("admin.stats.totalOrganizers", { defaultValue: "Total accounts" })} value={o.total ?? 0} />
        <Card label={t("admin.stats.pendingOrganizers", { defaultValue: "Awaiting review" })} value={o.pending ?? 0} />
        <Card label={t("admin.stats.suspended", { defaultValue: "Suspended" })} value={o.suspended ?? 0} />
        <Card label={t("admin.stats.newOrganizers30", { defaultValue: "New (30 days)" })} value={o.new30d ?? 0} />
      </Group>

      <Group title={t("admin.stats.events", { defaultValue: "Events" })}>
        <Card label={t("admin.stats.totalEvents", { defaultValue: "Total events" })} value={e.total ?? 0} />
        <Card label={t("admin.stats.approvedEvents", { defaultValue: "Approved" })} value={e.approved ?? 0} />
        <Card label={t("admin.stats.pendingEvents", { defaultValue: "Pending" })} value={e.pending ?? 0} />
        <Card label={t("admin.stats.rejectedEvents", { defaultValue: "Rejected" })} value={e.rejected ?? 0} />
        <Card label={t("admin.stats.upcoming", { defaultValue: "Upcoming" })} value={e.upcoming ?? 0} />
        <Card label={t("admin.stats.next30", { defaultValue: "Next 30 days" })} value={e.next30d ?? 0} />
        <Card label={t("admin.stats.past", { defaultValue: "Past" })} value={e.past ?? 0} />
        <Card label={t("admin.stats.newEvents30", { defaultValue: "Submitted (30 days)" })} value={e.new30d ?? 0} />
        <Card label={t("admin.stats.guestEvents", { defaultValue: "Guest submissions" })} value={e.guestSubmitted ?? 0} />
        <Card label={t("admin.stats.freeEvents", { defaultValue: "Free events" })} value={e.free ?? 0} />
        <Card label={t("admin.stats.featuredEvents", { defaultValue: "Featured" })} value={e.featured ?? 0} />
      </Group>

      <Group title={t("admin.stats.engagement", { defaultValue: "Engagement" })}>
        <Card label={t("admin.stats.follows", { defaultValue: "Organizer follows" })} value={en.follows ?? 0}
          hint={t("admin.stats.last30", { defaultValue: "{{n}} in last 30 days", n: en.follows30d ?? 0 }) as string} />
        <Card label={t("admin.stats.interests", { defaultValue: "\u201cInterested\u201d clicks" })} value={en.interests ?? 0}
          hint={t("admin.stats.last30", { defaultValue: "{{n}} in last 30 days", n: en.interests30d ?? 0 }) as string} />
        <Card label={t("admin.stats.push", { defaultValue: "Push subscriptions" })} value={en.pushSubscriptions ?? 0} />
      </Group>

      <Group title={t("admin.stats.community", { defaultValue: "Community" })}>
        <Card label={t("admin.stats.threads", { defaultValue: "Discussion threads" })} value={c.threads ?? 0}
          hint={t("admin.stats.last30", { defaultValue: "{{n}} in last 30 days", n: c.threads30d ?? 0 }) as string} />
        <Card label={t("admin.stats.replies", { defaultValue: "Replies" })} value={c.replies ?? 0} />
        <Card label={t("admin.stats.dms", { defaultValue: "Direct messages" })} value={c.directMessages ?? 0}
          hint={t("admin.stats.last30", { defaultValue: "{{n}} in last 30 days", n: c.directMessages30d ?? 0 }) as string} />
      </Group>

      <Group title={t("admin.stats.emails", { defaultValue: "Email delivery" })}>
        <Card label={t("admin.stats.emailsSent", { defaultValue: "Sent (30 days)" })} value={em.sent30d ?? 0} />
        <Card label={t("admin.stats.emailsBounced", { defaultValue: "Bounced / failed (30 days)" })} value={em.bounced30d ?? 0} />
        <Card label={t("admin.stats.emailsSuppressed", { defaultValue: "Suppressed addresses" })} value={em.suppressed ?? 0} />
      </Group>

      <Breakdown
        title={t("admin.stats.byCategory", { defaultValue: "Events by category" })}
        entries={byCat}
        labelFor={(k) => t(`categories.${k}`, { defaultValue: k })}
      />
      <Breakdown
        title={t("admin.stats.byDiocese", { defaultValue: "Events by diocese" })}
        entries={byDio}
        labelFor={(k) => {
          const d = dioceseBySlug(k);
          return d ? nameOf(d) : k;
        }}
      />
      <Breakdown
        title={t("admin.stats.byMonth", { defaultValue: "Submissions by month" })}
        entries={byMonth}
      />
      <Breakdown
        title={t("admin.stats.topOrganizers", { defaultValue: "Most active organizers" })}
        entries={topOrgs.map((x) => [x.name, x.events]) as [string, number][]}
      />
    </div>
  );
}
