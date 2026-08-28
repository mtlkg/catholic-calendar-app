import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";
import { format } from "@/lib/dateLocale";
import { formatEventTime } from "@/lib/timezone";
import { Check, X, Trash2, MessageSquare, Users2, CalendarDays, ExternalLink, Pencil, ShieldCheck, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import CalendarLayout from "./CalendarLayout";
import { useDiocese, dioceseBySlug } from "@/context/DioceseContext";
import { UNLOCKED_CITY } from "@/data/dioceses";
import AdminStats from "./AdminStats";

const ADMIN_EMAIL = "globalcatholiccalendar@gmail.com";

/** Scope prop shared by every admin section: null = every diocese. */
export type AdminScope = { scopeSlugs?: string[] | null };

/** True when a row belongs to the currently selected diocese scope. */
function inScope(slug: string | null | undefined, scopeSlugs?: string[] | null) {
  if (!scopeSlugs || scopeSlugs.length === 0) return true;
  return !!slug && scopeSlugs.includes(slug);
}

/* ---------------- Inline edit modals ---------------- */
function EditModal({ title, fields, initial, onSave, onClose }: {
  title: string;
  fields: { key: string; label: string; type?: "text" | "textarea" | "datetime" | "select"; options?: string[] }[];
  initial: Record<string, any>;
  onSave: (patch: Record<string, any>) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    for (const f of fields) {
      let raw = initial[f.key] ?? "";
      if (f.type === "datetime" && raw) {
        try { raw = new Date(raw).toISOString().slice(0, 16); } catch {}
      }
      v[f.key] = raw ?? "";
    }
    return v;
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = {};
      for (const f of fields) {
        let val = values[f.key];
        if (f.type === "datetime" && val) val = new Date(val).toISOString();
        patch[f.key] = val === "" ? null : val;
      }
      await onSave(patch);
      onClose();
    } catch (e) {
      alert(t("admin.saveFailed") + " " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg">{title}</h3>
          <button onClick={onClose} className="text-charcoal/50 hover:text-charcoal"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-[11px] uppercase tracking-wide font-bold text-charcoal/60 mb-1">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background" rows={4}
                  value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              ) : f.type === "select" ? (
                <select className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                  value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                  {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type === "datetime" ? "datetime-local" : "text"}
                  className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background"
                  value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-xs rounded border border-border">{t("admin.cancel")}</button>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 text-xs rounded bg-crimson text-ivory font-bold disabled:opacity-50">
            {saving ? t("admin.saving") : t("admin.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function useEventFields() {
  const { t } = useTranslation();
  return [
    { key: "title", label: t("admin.fields.title") },
    { key: "description", label: t("admin.fields.description"), type: "textarea" as const },
    { key: "venue_name", label: t("admin.fields.venue") },
    { key: "address", label: t("admin.fields.address") },
    { key: "start_at", label: t("admin.fields.startsAt"), type: "datetime" as const },
    { key: "end_at", label: t("admin.fields.endsAt"), type: "datetime" as const },
    { key: "poster_url", label: t("admin.fields.posterUrl") },
    { key: "registration_url", label: t("admin.fields.regUrl") },
    { key: "guest_email", label: t("admin.fields.guestEmail") },
    { key: "status", label: t("admin.fields.status"), type: "select" as const, options: ["pending", "approved", "rejected"] },
    { key: "rejection_reason", label: t("admin.fields.rejectionReason"), type: "textarea" as const },
  ];
}

function useOrganizerFields() {
  const { t } = useTranslation();
  return [
    { key: "org_name", label: t("admin.fields.orgName") },
    { key: "parish", label: t("admin.fields.parish") },
    { key: "contact_email", label: t("admin.fields.contactEmail") },
    { key: "contact_phone", label: t("admin.fields.phone") },
    { key: "representative_name", label: t("admin.fields.representative") },
    { key: "address", label: t("admin.fields.address") },
    { key: "website_url", label: t("admin.fields.website") },
    { key: "logo_url", label: t("admin.fields.logoUrl") },
    { key: "description", label: t("admin.fields.description"), type: "textarea" as const },
    { key: "status", label: t("admin.fields.status"), type: "select" as const, options: ["pending", "approved", "suspended"] },
  ];
}

export default function CalendarAdmin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { navigate("/catholic-calendar/auth"); return; }
      setUser(data.session.user);
      const email = (data.session.user.email || "").toLowerCase();
      if (email !== ADMIN_EMAIL) { setIsAdmin(false); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id);
      setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
    })();
  }, [navigate]);

  if (isAdmin === null) return <CalendarLayout><div className="py-20 text-center text-charcoal/50">{t("admin.loading")}</div></CalendarLayout>;
  if (!isAdmin) return (
    <CalendarLayout>
      <div className="max-w-md mx-auto py-20 px-5 text-center">
        <h1 className="font-display text-2xl mb-2">{t("admin.onlyAdmins")}</h1>
        <p className="text-sm text-charcoal/60">{t("admin.noAccess")}</p>
        <p className="text-xs text-charcoal/40 mt-3">{t("admin.signedIn")} {user?.email}</p>
      </div>
    </CalendarLayout>
  );

  return (
    <CalendarLayout>
      <div className="max-w-5xl mx-auto px-5 py-8">
        <AdminPanel />
      </div>
    </CalendarLayout>
  );
}

/* ---------------- Admin panel (tabs + diocese scope) ---------------- */
type AdminSection = "pending" | "organizers" | "events" | "threads" | "stats";

export function AdminPanel() {
  const { t } = useTranslation();
  const { dioceseName, scopeSlugs: activeScope } = useDiocese();
  const [section, setSection] = useState<AdminSection>("pending");
  const [allDioceses, setAllDioceses] = useState(false);
  const scopeSlugs = allDioceses ? null : activeScope;

  const sections: { id: AdminSection; label: string; icon: typeof Users2 }[] = [
    { id: "pending", label: t("admin.sections.pending"), icon: ShieldCheck },
    { id: "organizers", label: t("admin.sections.organizers"), icon: Users2 },
    { id: "events", label: t("admin.sections.events"), icon: CalendarDays },
    { id: "threads", label: t("admin.sections.threads"), icon: MessageSquare },
    { id: "stats", label: t("admin.sections.stats", { defaultValue: "Stats" }), icon: BarChart3 },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-crimson" />
        <h2 className="font-display text-2xl">{t("admin.moderation")}</h2>
      </div>
      <p className="text-xs text-charcoal/55 mb-4">{t("admin.moderationSub")}</p>

      {/* Diocese scope */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 mb-3 rounded-lg border border-border bg-muted/40">
        <button
          onClick={() => setAllDioceses(false)}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            !allDioceses ? "bg-card text-crimson shadow-sm" : "text-charcoal/60 hover:text-charcoal"
          }`}
        >
          {dioceseName}
        </button>
        <button
          onClick={() => setAllDioceses(true)}
          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
            allDioceses ? "bg-card text-crimson shadow-sm" : "text-charcoal/60 hover:text-charcoal"
          }`}
        >
          {t("admin.scopeAll", { defaultValue: "All dioceses" })}
        </button>
      </div>

      {/* Segmented sub-nav */}
      <div className="flex flex-wrap gap-1 p-1 mb-6 rounded-lg border border-border bg-muted/40 w-fit">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              section === s.id ? "bg-card text-crimson shadow-sm" : "text-charcoal/60 hover:text-charcoal"
            }`}
          >
            <s.icon className="w-3.5 h-3.5" /> {s.label}
          </button>
        ))}
      </div>

      {section === "pending" && (
        <div className="space-y-6">
          <PendingEvents scopeSlugs={scopeSlugs} />
          <PendingOrganizers scopeSlugs={scopeSlugs} />
        </div>
      )}
      {section === "organizers" && <AllOrganizers scopeSlugs={scopeSlugs} />}
      {section === "events" && <AllEvents scopeSlugs={scopeSlugs} />}
      {section === "threads" && <AllThreads scopeSlugs={scopeSlugs} />}
      {section === "stats" && <AdminStats scopeSlugs={scopeSlugs} />}
    </div>
  );
}


export function PendingEvents({ scopeSlugs = null }: AdminScope) {
  const { t } = useTranslation();
  const scopeKey = scopeSlugs ? scopeSlugs.join(",") : "all";
  const [items, setItems] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [submitters, setSubmitters] = useState<Record<string, { org_name: string | null; contact_email: string | null }>>({});
  const load = async () => {
    const { data } = await (supabase as any).rpc("admin_list_events", { _status: "pending" });
    const list = (data ?? []).filter((e: any) => inScope(e.diocese_slug, scopeSlugs));
    setItems(list);
    const ids = Array.from(new Set(list.map((e: any) => e.submitted_by_user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await (supabase as any).rpc("admin_get_organizer_contacts", { _user_ids: ids });
      const map: Record<string, { org_name: string | null; contact_email: string | null }> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = { org_name: p.org_name, contact_email: p.contact_email }; });
      setSubmitters(map);
    }
  };
  useEffect(() => {
    load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    const poll = setInterval(load, 20000);
    const channel = supabase
      .channel("admin-pending-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => load())
      .subscribe();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [scopeKey]);

  const decide = async (id: string, approve: boolean, reason?: string) => {
    const event = items.find((e) => e.id === id);
    await supabase.from("calendar_events").update({
      status: approve ? "approved" : "rejected",
      rejection_reason: approve ? null : (reason ?? null),
    }).eq("id", id);
    if (approve && event) {
      if (event.latitude == null && (event.address || event.venue_name)) {
        const q = [event.venue_name, event.address].filter(Boolean).join(", ");
        try {
          await supabase.functions.invoke("geocode-address", {
            body: { address: q, eventId: id },
          });
        } catch (e) { console.error("post-approval geocode failed", e); }
      }
      let recipientEmail: string | null = event.guest_email ?? null;
      let recipientName: string = event.guest_name ?? "";
      if (!recipientEmail && event.submitted_by_user_id) {
        const { data: contacts } = await (supabase as any).rpc("admin_get_organizer_contacts", { _user_ids: [event.submitted_by_user_id] });
        const org = Array.isArray(contacts) ? contacts[0] : null;
        recipientEmail = org?.contact_email ?? null;
        recipientName = recipientName || (org?.org_name ?? "");
      }
      if (recipientEmail) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "event-approved",
              recipientEmail,
              idempotencyKey: `event-approved-${id}`,
              templateData: {
                title: event.title,
                startAt: event.start_at ? formatEventTime(event.start_at, "MMMM d, yyyy · h:mm a", (event as any).diocese_slug) : "",
                venue: event.venue_name ?? "",
                eventUrl: `${window.location.origin}/catholic-calendar`,
                recipientName,
              },
            },
          });
        } catch (e) { console.error("approval email failed", e); }
      }
    }
    load();
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl">{t("admin.pendingEvents")} ({items.length})</h2>
        <button onClick={load} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted">{t("admin.refresh")}</button>
      </div>
      {items.length === 0 && <p className="text-sm text-charcoal/50">{t("admin.allCaughtUp")}</p>}
      <div className="space-y-3">
        {items.map((e) => (
          <PendingEventRow
            key={e.id}
            event={e}
            open={openId === e.id}
            onToggle={() => setOpenId((cur) => (cur === e.id ? null : e.id))}
            submitterProfile={e.submitted_by_user_id ? submitters[e.submitted_by_user_id] : undefined}
            onApprove={() => decide(e.id, true)}
            onReject={() => {
              const r = prompt(t("admin.rejectPrompt")) ?? "";
              decide(e.id, false, r);
            }}
          />
        ))}
      </div>
    </section>
  );
}

function PendingEventRow({
  event: e,
  open,
  onToggle,
  submitterProfile,
  onApprove,
  onReject,
}: {
  event: any;
  open: boolean;
  onToggle: () => void;
  submitterProfile?: { org_name: string | null; contact_email: string | null };
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const submittedByLabel = e.guest_name
    ? `${e.guest_name} (${e.guest_email}) — ${t("admin.guestSuffix")}`
    : submitterProfile
      ? `${submitterProfile.org_name ?? t("admin.organizerFallback")} (${submitterProfile.contact_email ?? t("admin.noEmail")}) — ${t("admin.verifiedSuffix")}`
      : e.submitted_by_user_id ?? "—";
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="p-4 flex items-start justify-between gap-3">
        <button onClick={onToggle} className="min-w-0 text-left flex-1 group">
          <h3 className="font-display text-lg flex items-center gap-2 group-hover:text-crimson">
            {e.title}
            {e.is_featured && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-gold text-charcoal px-1.5 py-0.5 rounded font-bold">
                {t("admin.featuredFlag")}
              </span>
            )}
          </h3>
          <p className="text-xs text-charcoal/60 mt-1">
            {formatEventTime(e.start_at, "MMM d, yyyy · h:mm a", (e as any).diocese_slug)} · {e.category}
            {e.venue_name && ` · ${e.venue_name}`}
          </p>
          <p className="text-[11px] text-crimson/80 mt-1">{open ? t("admin.hideDetails") : t("admin.reviewDetails")}</p>
        </button>
        <div className="flex gap-1 shrink-0">
          <button onClick={onApprove} className="p-2 rounded bg-emerald-600 text-white" aria-label={t("admin.approve") as string}>
            <Check className="w-4 h-4" />
          </button>
          <button onClick={onReject} className="p-2 rounded bg-red-600 text-white" aria-label={t("admin.reject") as string}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border/60 text-sm space-y-2">
          <DetailRow label={t("admin.rows.submittedBy")} value={submittedByLabel} />
          <DetailRow label={t("admin.rows.category")} value={e.category + (e.category_other ? ` — ${e.category_other}` : "")} />
          <DetailRow label={t("admin.rows.parishOrg")} value={e.parish} />
          <DetailRow label={t("admin.rows.starts")} value={e.start_at ? formatEventTime(e.start_at, "EEE MMM d, yyyy · h:mm a", (e as any).diocese_slug) : null} />
          <DetailRow label={t("admin.rows.ends")} value={e.end_at ? formatEventTime(e.end_at, "EEE MMM d, yyyy · h:mm a", (e as any).diocese_slug) : null} />
          <DetailRow label={t("admin.rows.allDay")} value={e.all_day ? t("admin.rows.yes") : t("admin.rows.no")} />
          <DetailRow label={t("admin.rows.venue")} value={e.venue_name} />
          <DetailRow label={t("admin.rows.address")} value={e.address} />
          <DetailRow label={t("admin.rows.coords")} value={e.latitude && e.longitude ? `${e.latitude}, ${e.longitude}` : null} />
          <DetailRow
            label={t("admin.rows.regLink")}
            value={e.registration_url ? (
              <a href={e.registration_url} target="_blank" rel="noreferrer" className="text-crimson underline break-all">{e.registration_url}</a>
            ) : null}
          />
          <DetailRow label={t("admin.rows.cost")} value={e.is_free ? t("admin.rows.free") : (e.price_note || t("admin.rows.paidNoDetails"))} />
          <DetailRow label={t("admin.rows.featuredReq")} value={e.is_featured ? t("admin.rows.featuredYes") : t("admin.rows.no")} />
          <DetailRow
            label={t("admin.rows.description")}
            value={e.description ? <span className="whitespace-pre-wrap">{e.description}</span> : null}
          />
          <DetailRow label={t("admin.rows.submittedAt")} value={e.created_at ? format(parseISO(e.created_at), "MMM d, yyyy · h:mm a") : null} />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode | null | undefined }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <span className="text-[11px] uppercase tracking-wide text-charcoal/55 font-bold">{label}</span>
      <span className="text-charcoal/85">{value || <span className="text-charcoal/40 italic">{t("admin.notProvided")}</span>}</span>
    </div>
  );
}

export function PendingOrganizers({ scopeSlugs = null }: AdminScope) {
  const { t } = useTranslation();
  const scopeKey = scopeSlugs ? scopeSlugs.join(",") : "all";
  const [items, setItems] = useState<any[]>([]);
  const load = async () => {
    const { data } = await (supabase as any).rpc("admin_list_organizer_profiles");
    const pending = (data ?? []).filter((o: any) => o.status === "pending" && inScope(o.diocese_slug, scopeSlugs))
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setItems(pending);
  };
  useEffect(() => { load(); }, [scopeKey]);

  const decide = async (id: string, approve: boolean) => {
    const org = items.find((o) => o.id === id);
    await supabase.from("organizer_profiles").update({
      status: approve ? "approved" : "suspended",
    }).eq("id", id);
    if (approve && org?.contact_email) {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "organizer-approved",
            recipientEmail: org.contact_email,
            idempotencyKey: `organizer-approved-${id}`,
            templateData: {
              orgName: org.org_name || "your organization",
              dashboardUrl: `${window.location.origin}/catholic-calendar/dashboard`,
              requiresPayment: dioceseBySlug(org.diocese_slug)?.city !== UNLOCKED_CITY,
              subscribeUrl: `${window.location.origin}/catholic-calendar/subscribe`,
            },
          },
        });
      } catch (e) { console.error("approval email failed", e); }
    }
    load();
  };

  return (
    <section>
      <h2 className="font-display text-xl mb-3">{t("admin.pendingOrganizers")} ({items.length})</h2>
      {items.length === 0 && <p className="text-sm text-charcoal/50">{t("admin.noApplications")}</p>}
      <div className="space-y-3">
        {items.map((o) => (
          <div key={o.id} className="p-4 rounded-md border border-border bg-card">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-display text-lg">{o.org_name || t("admin.unnamed")}</h3>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => decide(o.id, true)} className="p-2 rounded bg-emerald-600 text-white"><Check className="w-4 h-4" /></button>
                <button onClick={() => decide(o.id, false)} className="p-2 rounded bg-red-600 text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <DetailRow label={t("admin.rows.representative")} value={o.representative_name} />
              <DetailRow label={t("admin.rows.orgMinistry")} value={o.org_name} />
              <DetailRow label={t("admin.rows.parish")} value={o.parish} />
              <DetailRow label={t("admin.rows.email")} value={o.contact_email} />
              <DetailRow label={t("admin.rows.phone")} value={o.contact_phone} />
              <DetailRow label={t("admin.rows.address")} value={o.address} />
              <DetailRow label={t("admin.rows.website")} value={o.website_url} />
              <DetailRow label={t("admin.rows.categories")} value={(o.categories || []).join(", ")} />
              <DetailRow label={t("admin.rows.otherCategories")} value={o.categories_other} />
              <DetailRow label={t("admin.rows.description")} value={o.description} />
              <DetailRow label={t("admin.rows.applied")} value={o.created_at ? new Date(o.created_at).toLocaleString() : null} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- All Organizers ---------------- */
export function AllOrganizers({ scopeSlugs = null }: AdminScope) {
  const { t } = useTranslation();
  const scopeKey = scopeSlugs ? scopeSlugs.join(",") : "all";
  const ORGANIZER_FIELDS = useOrganizerFields();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState<"all" | "approved" | "pending" | "suspended">("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await (supabase as any).rpc("admin_list_organizer_profiles");
    setItems((data ?? []).filter((o: any) => inScope(o.diocese_slug, scopeSlugs)));
  };
  useEffect(() => { load(); }, [scopeKey]);

  const filtered = items.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (!`${o.org_name ?? ""} ${o.parish ?? ""} ${o.contact_email ?? ""}`.toLowerCase().includes(needle)) return false;
    }
    return true;
  });

  const setStatusFor = async (id: string, next: "approved" | "pending" | "suspended") => {
    const org = items.find((o) => o.id === id);
    const wasApproved = org?.status === "approved";
    await supabase.from("organizer_profiles").update({ status: next }).eq("id", id);
    if (next === "approved" && !wasApproved && org?.contact_email) {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "organizer-approved",
            recipientEmail: org.contact_email,
            idempotencyKey: `organizer-approved-${id}-${Date.now()}`,
            templateData: {
              orgName: org.org_name || "your organization",
              dashboardUrl: `${window.location.origin}/catholic-calendar/dashboard`,
              requiresPayment: dioceseBySlug(org.diocese_slug)?.city !== UNLOCKED_CITY,
              subscribeUrl: `${window.location.origin}/catholic-calendar/subscribe`,
            },
          },
        });
      } catch (e) { console.error("approval email failed", e); }
    }
    load();
  };

  const remove = async (id: string) => {
    const org = items.find((o) => o.id === id);
    if (!org?.user_id) { alert(t("admin.missingUserId")); return; }
    if (!confirm(t("admin.confirmDeleteOrg"))) return;
    const { data, error } = await supabase.functions.invoke("delete-organizer-account", {
      body: { user_id: org.user_id },
    });
    if (error || (data as any)?.error) {
      alert(t("admin.deleteFailed") + " " + (error?.message || (data as any)?.error));
      return;
    }
    load();
  };

  const statusLabel = (s: string) => {
    if (s === "all") return t("admin.statusAll");
    if (s === "approved") return t("admin.statusApproved");
    if (s === "pending") return t("admin.statusPending");
    if (s === "suspended") return t("admin.statusSuspended");
    if (s === "rejected") return t("admin.statusRejected");
    return s;
  };

  return (
    <section className="mb-10">
      <h2 className="font-display text-xl mb-3 flex items-center gap-2"><Users2 className="w-5 h-5" /> {t("admin.allOrganizers")} ({items.length})</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {(["all","approved","pending","suspended"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-2.5 py-1 text-xs rounded-full border ${status === s ? "bg-crimson text-ivory border-crimson" : "bg-card border-border text-charcoal/70"}`}>
            {statusLabel(s)}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.searchOrgPh") as string}
          className="ml-auto px-3 py-1.5 text-xs rounded-md border border-border bg-background w-full sm:w-64" />
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-charcoal/50">{t("admin.noOrgMatch")}</p>}
        {filtered.map((o) => (
          <details key={o.id} className="p-3 rounded-md border border-border bg-card group">
            <summary className="flex items-start justify-between gap-3 cursor-pointer list-none">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold truncate">{o.org_name || t("admin.unnamed")}</h3>
                  <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    o.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                    o.status === "suspended" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                  }`}>{statusLabel(o.status)}</span>
                </div>
                <p className="text-xs text-charcoal/60 truncate">{o.parish} · {o.contact_email}</p>
              </div>
              <div className="flex gap-1 shrink-0" onClick={(e) => e.preventDefault()}>
                <button onClick={() => setEditing(o)} className="p-1.5 rounded bg-charcoal text-ivory" aria-label={t("admin.editAria") as string}><Pencil className="w-3.5 h-3.5" /></button>
                {o.status !== "approved" && (
                  <button onClick={() => setStatusFor(o.id, "approved")} className="p-1.5 rounded bg-emerald-600 text-white" aria-label={t("admin.approveAria") as string}><Check className="w-3.5 h-3.5" /></button>
                )}
                {o.status !== "suspended" && (
                  <button onClick={() => setStatusFor(o.id, "suspended")} className="p-1.5 rounded bg-amber-600 text-white" aria-label={t("admin.suspendAria") as string}><X className="w-3.5 h-3.5" /></button>
                )}
                <button onClick={() => remove(o.id)} className="p-1.5 rounded bg-red-600 text-white" aria-label={t("admin.deleteAria") as string}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </summary>
            <div className="space-y-1.5 text-sm mt-3 pt-3 border-t border-border">
              <DetailRow label={t("admin.rows.representative")} value={o.representative_name} />
              <DetailRow label={t("admin.rows.orgMinistry")} value={o.org_name} />
              <DetailRow label={t("admin.rows.parish")} value={o.parish} />
              <DetailRow label={t("admin.rows.email")} value={o.contact_email} />
              <DetailRow label={t("admin.rows.phone")} value={o.contact_phone} />
              <DetailRow label={t("admin.rows.address")} value={o.address} />
              <DetailRow label={t("admin.rows.website")} value={o.website_url} />
              <DetailRow label={t("admin.rows.categories")} value={(o.categories || []).join(", ")} />
              <DetailRow label={t("admin.rows.otherCategories")} value={o.categories_other} />
              <DetailRow label={t("admin.rows.description")} value={o.description} />
              <DetailRow label={t("admin.rows.applied")} value={o.created_at ? new Date(o.created_at).toLocaleString() : null} />
            </div>
          </details>
        ))}
      </div>
      {editing && (
        <EditModal
          title={t("admin.editOrgTitle", { name: editing.org_name || t("admin.orgFallback") }) as string}
          fields={ORGANIZER_FIELDS}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            const { error } = await (supabase as any).rpc("admin_update_organizer", { _user_id: editing.user_id, _patch: patch });
            if (error) throw error;
            await load();
          }}
        />
      )}
    </section>
  );
}

/* ---------------- All Events ---------------- */
export function AllEvents({ scopeSlugs = null }: AdminScope) {
  const { t } = useTranslation();
  const scopeKey = scopeSlugs ? scopeSlugs.join(",") : "all";
  const EVENT_FIELDS = useEventFields();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState<"all" | "approved" | "pending" | "rejected">("all");
  const [category, setCategory] = useState<string>("all");
  const [q, setQ] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await (supabase as any).rpc("admin_list_events");
    setItems((data ?? []).filter((e: any) => inScope(e.diocese_slug, scopeSlugs)));
  };
  useEffect(() => { load(); }, [scopeKey]);

  const categories = Array.from(new Set(items.map((e) => e.category).filter(Boolean)));

  const now = new Date();
  const filtered = items.filter((e) => {
    if (!showPast) {
      const end = e.end_at ?? e.start_at;
      if (end && new Date(end) < now) return false;
    }
    if (status !== "all" && e.status !== status) return false;
    if (category !== "all" && e.category !== category) return false;
    if (q) {
      const n = q.toLowerCase();
      if (!`${e.title ?? ""} ${e.venue_name ?? ""} ${e.address ?? ""}`.toLowerCase().includes(n)) return false;
    }
    return true;
  });

  const remove = async (id: string) => {
    if (!confirm(t("admin.confirmDeleteEvent"))) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) { alert(t("admin.deleteFailed") + " " + error.message); return; }
    load();
  };

  const statusLabel = (s: string) => {
    if (s === "all") return t("admin.statusAll");
    if (s === "approved") return t("admin.statusApproved");
    if (s === "pending") return t("admin.statusPending");
    if (s === "rejected") return t("admin.statusRejected");
    return s;
  };

  return (
    <section className="mb-10">
      <h2 className="font-display text-xl mb-3 flex items-center gap-2"><CalendarDays className="w-5 h-5" /> {t("admin.allEvents")} ({filtered.length})</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {(["all","approved","pending","rejected"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-2.5 py-1 text-xs rounded-full border ${status === s ? "bg-crimson text-ivory border-crimson" : "bg-card border-border text-charcoal/70"}`}>
            {statusLabel(s)}
          </button>
        ))}
        <button onClick={() => setShowPast((v) => !v)}
          className={`px-2.5 py-1 text-xs rounded-full border ${showPast ? "bg-crimson text-ivory border-crimson" : "bg-card border-border text-charcoal/70"}`}>
          {showPast ? t("admin.hidePast") : t("admin.showPast")}
        </button>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="px-2 py-1 text-xs rounded-md border border-border bg-background">
          <option value="all">{t("admin.allCategories")}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.searchEventsPh") as string}
          className="ml-auto px-3 py-1.5 text-xs rounded-md border border-border bg-background w-full sm:w-64" />
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-charcoal/50">{t("admin.noEventsMatch")}</p>}
        {filtered.map((e) => (
          <div key={e.id} className="p-3 rounded-md border border-border bg-card flex items-start justify-between gap-3 hover:border-crimson/50 transition-colors">
            <Link to={`/catholic-calendar/event/${e.id}`} className="min-w-0 flex-1 group">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold truncate group-hover:text-crimson">{e.title}</h3>
                <ExternalLink className="w-3 h-3 text-charcoal/40 group-hover:text-crimson" />
                <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                  e.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                  e.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                }`}>{statusLabel(e.status)}</span>
                {e.is_featured && <span className="text-[10px] bg-gold text-charcoal px-1.5 py-0.5 rounded font-bold">{t("admin.featured")}</span>}
              </div>
              <p className="text-xs text-charcoal/60 truncate">
                {e.start_at && formatEventTime(e.start_at, "MMM d, yyyy · h:mm a", (e as any).diocese_slug)} · {e.category}
                {e.venue_name && ` · ${e.venue_name}`}
              </p>
            </Link>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setEditing(e)} className="p-1.5 rounded bg-charcoal text-ivory" aria-label={t("admin.editAria") as string}><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => remove(e.id)} className="p-1.5 rounded bg-red-600 text-white" aria-label={t("admin.deleteAria") as string}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <EditModal
          title={t("admin.editEventTitle", { title: editing.title }) as string}
          fields={EVENT_FIELDS}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            const nextVenue = Object.prototype.hasOwnProperty.call(patch, "venue_name") ? patch.venue_name : editing.venue_name;
            const nextAddress = Object.prototype.hasOwnProperty.call(patch, "address") ? patch.address : editing.address;
            const locationChanged =
              String(nextVenue ?? "").trim() !== String(editing.venue_name ?? "").trim() ||
              String(nextAddress ?? "").trim() !== String(editing.address ?? "").trim();
            if (locationChanged) {
              patch.latitude = null;
              patch.longitude = null;
            }
            const { error } = await (supabase as any).rpc("admin_update_event", { _event_id: editing.id, _patch: patch });
            if (error) throw error;
            if ((nextAddress || nextVenue) && (locationChanged || editing.latitude == null || editing.longitude == null)) {
              const { error: geoError } = await supabase.functions.invoke("geocode-address", {
                body: { address: [nextVenue, nextAddress].filter(Boolean).join(", "), eventId: editing.id },
              });
              if (geoError) throw geoError;
            }
            await load();
          }}
        />
      )}
    </section>
  );
}

/* ---------------- All Threads ---------------- */
export function AllThreads({ scopeSlugs = null }: AdminScope) {
  const { t } = useTranslation();
  const scopeKey = scopeSlugs ? scopeSlugs.join(",") : "all";
  const [items, setItems] = useState<any[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("discussion_threads")
      .select("*")
      .order("last_activity_at", { ascending: false });
    const list = (data ?? []).filter((th: any) => inScope(th.diocese_slug, scopeSlugs));
    setItems(list);
    const ids = Array.from(new Set(list.map((t: any) => t.author_user_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await (supabase as any).rpc("admin_get_organizer_contacts", { _user_ids: ids });
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = p.org_name || p.contact_email || "Organizer"; });
      setAuthors(map);
    }
  };
  useEffect(() => { load(); }, [scopeKey]);

  const filtered = items.filter((th) => {
    if (!q) return true;
    const n = q.toLowerCase();
    return `${th.title ?? ""} ${th.body ?? ""} ${authors[th.author_user_id] ?? ""}`.toLowerCase().includes(n);
  });

  const remove = async (id: string) => {
    if (!confirm(t("admin.confirmDeleteThread"))) return;
    await supabase.from("discussion_replies").delete().eq("thread_id", id);
    const { error } = await supabase.from("discussion_threads").delete().eq("id", id);
    if (error) { alert(t("admin.deleteFailed") + " " + error.message); return; }
    load();
  };

  return (
    <section className="mb-10">
      <h2 className="font-display text-xl mb-3 flex items-center gap-2"><MessageSquare className="w-5 h-5" /> {t("admin.allThreads")} ({items.length})</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.searchThreadsPh") as string}
          className="ml-auto px-3 py-1.5 text-xs rounded-md border border-border bg-background w-full sm:w-64" />
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-charcoal/50">{t("admin.noThreads")}</p>}
        {filtered.map((th) => (
          <div key={th.id} className="p-3 rounded-md border border-border bg-card flex items-start justify-between gap-3 hover:border-crimson/50 transition-colors">
            <Link to={`/catholic-calendar/dashboard?thread=${th.id}`} className="min-w-0 flex-1 group">
              <h3 className="font-bold truncate group-hover:text-crimson inline-flex items-center gap-1">
                {th.title} <ExternalLink className="w-3 h-3 text-charcoal/40 group-hover:text-crimson" />
              </h3>
              <p className="text-xs text-charcoal/55">
                <span className="font-bold text-charcoal/75">{authors[th.author_user_id] || t("admin.organizerFallback")}</span>
                {" · "}{format(parseISO(th.created_at), "MMM d, yyyy · h:mm a")}
              </p>
              {th.body && <p className="text-xs text-charcoal/70 mt-1 line-clamp-2 whitespace-pre-wrap">{th.body}</p>}
            </Link>
            <button onClick={() => remove(th.id)} className="p-1.5 rounded bg-red-600 text-white shrink-0" aria-label={t("admin.deleteAria") as string}><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
