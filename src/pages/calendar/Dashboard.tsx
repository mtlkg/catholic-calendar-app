import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { parseISO } from "date-fns";
import { format } from "@/lib/dateLocale";
import { formatEventTime } from "@/lib/timezone";
import { Trash2, Edit3, Send, Plus, MessageSquare, CalendarDays, Users2, UserCircle2, ShieldCheck, Pin, X, Rows3, Square, ImagePlus, Heart, UserPlus, Bell, BellOff, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import CalendarLayout, { CATEGORIES, useCategoryLabel } from "./CalendarLayout";
import VerifiedBadge from "@/components/VerifiedBadge";
import VerifiedPaymentBanner from "@/components/VerifiedPaymentBanner";
import { AdminPanel } from "./CalendarAdmin";
import { MessageBody, AttachButton, PendingAttachments, AutoGrowTextarea } from "@/components/calendar/MessageBody";
import { SwipeToReply, ReplyingToBar, buildQuotedReply } from "@/components/calendar/SwipeToReply";
import { ReplyChainProvider, ChainMessage, isFocusOpen } from "@/components/calendar/ReplyChainContext";
import { uploadChatFiles } from "@/lib/chatAttachments";
import { uploadEventPoster, getPosterUrl } from "@/lib/posterUrl";
import { useDiocese, useDioceseName, dioceseBySlug } from "@/context/DioceseContext";
import DioceseSelect from "@/components/DioceseSelect";
import DioceseMultiSelect from "@/components/DioceseMultiSelect";
import NotificationSettings from "@/components/NotificationSettings";
import { toast } from "@/hooks/use-toast";
import { DIOCESES, UNLOCKED_CITY } from "@/data/dioceses";


type Tab = "events" | "followers" | "threads" | "messages" | "profile" | "admin";

const ADMIN_EMAIL = "globalcatholiccalendar@gmail.com";

/** Display the org's chosen name. Hides email-shaped fallbacks left over from old accounts. */
function displayName(name?: string | null): string {
  if (!name) return "Organizer";
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes("@")) return "Organizer";
  return trimmed;
}

/** Find nearest scrollable ancestor (overflow-y auto/scroll). Prevents scrolling the page/window. */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}
/** Scroll the messages container so the target sits at the bottom, without moving the page. */
function scrollElToBottom(target: HTMLElement | null) {
  if (!target) return;
  const parent = getScrollParent(target);
  if (parent) {
    parent.scrollTop = parent.scrollHeight;
  } else {
    // Fallback that avoids affecting window scroll when possible.
    target.scrollIntoView({ block: "end", inline: "nearest" });
  }
}
/** Scroll target into view inside its own container only. */
function scrollElIntoContainer(target: HTMLElement | null, block: "center" | "end" = "center") {
  if (!target) return;
  const parent = getScrollParent(target);
  if (parent) {
    const pRect = parent.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const offset = (tRect.top - pRect.top) + parent.scrollTop;
    if (block === "center") {
      parent.scrollTop = offset - parent.clientHeight / 2 + target.clientHeight / 2;
    } else {
      parent.scrollTop = offset - parent.clientHeight + target.clientHeight;
    }
  } else {
    target.scrollIntoView({ block, inline: "nearest" });
  }
}
/**
 * Marks a post/message made by an organizer whose home diocese differs from the
 * diocese the post was made in ("visiting" organizer).
 */
function VisitingDioceseNote({ homeSlug, postedSlug }: { homeSlug?: string | null; postedSlug?: string | null }) {
  const { t } = useTranslation();
  const nameOf = useDioceseName();
  if (!homeSlug || !postedSlug || homeSlug === postedSlug) return null;
  const home = dioceseBySlug(homeSlug);
  if (!home) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold leading-none">
      {t("dashboard.visitingFrom", { diocese: nameOf(home) })}
    </span>
  );
}


function ProfileLink({ userId, children, backTo }: { userId?: string | null; children: React.ReactNode; backTo?: string }) {
  if (!userId) return <span className="inline-flex items-center gap-1.5">{children}</span>;
  return (
    <Link to={`/catholic-calendar/organizers/${userId}`} state={backTo ? { backTo, backLabel: "thread" } : undefined} className="inline-flex items-center gap-1.5 hover:opacity-80">
      {children}
    </Link>
  );
}

function useUnreadCounts(user: User | null, tab: Tab) {
  const [threads, setThreads] = useState(0);
  const [messages, setMessages] = useState(0);

  const refresh = async () => {
    if (!user) return;
    // Messages: incoming direct_messages newer than per-peer last_read_at, excluding soft-deleted conversations.
    const [{ data: dms }, { data: states }] = await Promise.all([
      supabase
        .from("direct_messages")
        .select("sender_user_id,created_at")
        .eq("recipient_user_id", user.id),
      supabase
        .from("dm_conversation_state")
        .select("peer_user_id,last_read_at,deleted_at")
        .eq("user_id", user.id),
    ]);
    const stateMap: Record<string, { last_read_at: string; deleted_at: string | null }> = {};
    (states ?? []).forEach((s: any) => { stateMap[s.peer_user_id] = { last_read_at: s.last_read_at, deleted_at: s.deleted_at }; });
    const msgCount = (dms ?? []).filter((m: any) => {
      const st = stateMap[m.sender_user_id];
      if (st?.deleted_at) return false;
      const lastRead = st?.last_read_at ?? new Date(0).toISOString();
      return m.created_at > lastRead;
    }).length;

    // Group chats: messages from others newer than my per-group last_read_at.
    // Muted groups never contribute to the badge.
    let groupCount = 0;
    const { data: allGroups } = await supabase
      .from("dm_group_members")
      .select("group_id,last_read_at,muted")
      .eq("user_id", user.id);
    const myGroups = (allGroups ?? []).filter((g: any) => !g.muted);
    if (myGroups && myGroups.length) {
      const { data: gMsgs } = await supabase
        .from("dm_group_messages")
        .select("group_id,sender_user_id,created_at")
        .in("group_id", myGroups.map((g: any) => g.group_id));
      const readMap: Record<string, string> = {};
      myGroups.forEach((g: any) => { readMap[g.group_id] = g.last_read_at ?? new Date(0).toISOString(); });
      groupCount = (gMsgs ?? []).filter((m: any) =>
        m.sender_user_id !== user.id && m.created_at > (readMap[m.group_id] ?? "")).length;
    }
    setMessages(msgCount + groupCount);


    // Threads: discussion_threads from other authors newer than locally-stored last seen timestamp.
    const seenKey = `threads_last_seen_${user.id}`;
    const v = typeof window !== "undefined" ? window.localStorage.getItem(seenKey) : null;
    const lastSeen = v ? parseInt(v, 10) : 0;
    const { data: ths } = await supabase
      .from("discussion_threads")
      .select("author_user_id,created_at")
      .neq("author_user_id", user.id);
    const thrCount = (ths ?? []).filter((t: any) => new Date(t.created_at).getTime() > lastSeen).length;
    setThreads(thrCount);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    const ch = supabase
      .channel(`unread-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_user_id=eq.${user.id}` },
        () => refresh())
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "discussion_threads" },
        () => refresh())
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_group_messages" },
        () => refresh())
      .subscribe();

    const interval = setInterval(refresh, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, [user?.id]);

  // Re-check when switching tabs (child components mark-as-read on open).
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(refresh, 2000);
    return () => clearTimeout(t);
  }, [tab, user?.id]);

  return { threads, messages };
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const threadParam = searchParams.get("thread");
  const initialTab = (searchParams.get("tab") as Tab) || (threadParam ? "threads" : "events");
  const initialPeer = searchParams.get("peer");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orgStatus, setOrgStatus] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [hasVerifiedAccess, setHasVerifiedAccess] = useState(false);
  const unread = useUnreadCounts(user, tab);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { navigate("/catholic-calendar/auth"); return; }
      setUser(data.session.user);
      const email = (data.session.user.email || "").toLowerCase();
      const { data: roles } = await supabase
        .from("user_roles").select("role").eq("user_id", data.session.user.id);
      const hasAdminRole = !!roles?.some((r: any) => r.role === "admin");
      setIsAdmin(email === ADMIN_EMAIL || hasAdminRole);
      const [{ data: prof }, { data: paying }] = await Promise.all([
        supabase
          .from("organizer_profiles")
          .select("status,org_name,diocese_slug,created_at")
          .eq("user_id", data.session.user.id)
          .maybeSingle(),
        (supabase as any).rpc("is_paying_verified", { _user_id: data.session.user.id }),
      ]);
      setOrgStatus(prof?.status ?? "pending");
      setOrgName(prof?.org_name ?? null);
      const city = DIOCESES.find((d) => d.slug === prof?.diocese_slug)?.city;
      const freeUntil = prof?.created_at
        ? new Date(new Date(prof.created_at).setFullYear(new Date(prof.created_at).getFullYear() + 1))
        : null;
      const hasMontrealFreeYear = city === UNLOCKED_CITY && !!freeUntil && freeUntil > new Date();
      setHasVerifiedAccess(!!paying || (prof?.status === "approved" && hasMontrealFreeYear));
      setReady(true);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate("/catholic-calendar/auth");
      else setUser(s.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // React to URL changes (e.g. clicking a thread from Admin panel while on dashboard)
  useEffect(() => {
    if (threadParam) setTab("threads");
  }, [threadParam]);

  if (!ready || !user) return <CalendarLayout><div className="py-20 text-center text-charcoal/50">{t("dashboard.loading")}</div></CalendarLayout>;

  const isApproved = orgStatus === "approved";
  // Applicants and approved organizers awaiting payment see only their profile.
  if (!isAdmin && (!isApproved || !hasVerifiedAccess)) {
    return (
      <CalendarLayout>
        <div className="max-w-2xl mx-auto px-5 py-10">
          <h1 className="font-display text-3xl mb-1">{t("dashboard.title")}</h1>
          <p className="text-sm text-charcoal/80 font-bold">{displayName(orgName)}</p>
          <p className="text-xs text-charcoal/50 mb-6">{user.email}</p>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 mb-6">
            <h2 className="font-display text-xl text-amber-900 mb-1">
              {orgStatus === "suspended"
                ? t("dashboard.suspendedTitle")
                : isApproved
                  ? t("verifiedPayment.title")
                  : t("dashboard.awaitingTitle")}
            </h2>
            <p className="text-sm text-amber-900/85">
               {orgStatus === "suspended"
                 ? t("dashboard.suspendedBody")
                 : isApproved
                   ? t("verifiedPayment.body")
                   : t("dashboard.awaitingBody")}
               {!isApproved && orgStatus !== "suspended" && <strong>{user.email}</strong>}
               {!isApproved && orgStatus !== "suspended" && t("dashboard.awaitingBodyEnd")}
            </p>
             {isApproved && (
               <Link
                 to="/catholic-calendar/subscribe"
                 className="inline-block mt-4 px-4 py-2 rounded-md bg-crimson text-ivory text-sm font-bold hover:bg-crimson-deep"
               >
                 {t("verifiedPayment.cta")}
               </Link>
             )}
          </div>
          <Profile user={user} />
        </div>
      </CalendarLayout>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Plus }[] = [
    { id: "events", label: t("dashboard.tabs.events"), icon: CalendarDays },
    { id: "followers", label: t("dashboard.tabs.followers"), icon: UserPlus },
    { id: "threads", label: t("dashboard.tabs.threads"), icon: MessageSquare },
    { id: "messages", label: t("dashboard.tabs.messages"), icon: Users2 },
    { id: "profile", label: t("dashboard.tabs.profile"), icon: UserCircle2 },
    ...(isAdmin ? [{ id: "admin" as Tab, label: t("dashboard.tabs.admin"), icon: ShieldCheck }] : []),
  ];

  return (
    <CalendarLayout>
      <div className="max-w-5xl mx-auto px-5 py-8">
        <h1 className="font-display text-3xl mb-1">{t("dashboard.title")}</h1>
        <p className="text-sm text-charcoal/80 font-bold">{displayName(orgName)}</p>
        <p className="text-xs text-charcoal/50 mb-6">{user.email}</p>

        <VerifiedPaymentBanner user={user} />

        {/* Mobile: two rows — top: Profile + My Events (centered); bottom: Discussions, Messages, (Admin). */}
        {(() => {
          const byId = Object.fromEntries(tabs.map((t) => [t.id, t]));
          const top = [byId.events, byId.followers, byId.profile].filter(Boolean) as typeof tabs;
          const bottom = [byId.threads, byId.messages, ...(isAdmin && byId.admin ? [byId.admin] : [])] as typeof tabs;
          const badgeFor = (id: Tab) => id === "threads" ? unread.threads : id === "messages" ? unread.messages : 0;
          const renderBtn = (t: typeof tabs[number]) => {
            const active = tab === t.id;
            const count = badgeFor(t.id);
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-body transition-colors ${
                  active
                    ? "border-crimson bg-crimson/10 text-crimson font-bold"
                    : "border-border bg-background text-charcoal/70 hover:text-charcoal"
                }`}
              >
                <t.icon className="w-4 h-4" />
                <span className="leading-none">{t.label}</span>
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 inline-flex items-center justify-center rounded-full bg-crimson text-ivory text-[10px] font-bold leading-none">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          };
          return (
            <div className="md:hidden mb-6 space-y-2">
              <div className="grid grid-cols-3 gap-2 mx-auto">
                {top.map(renderBtn)}
              </div>
              <div
                className={`grid gap-2 mx-auto ${
                  bottom.length === 3 ? "grid-cols-3" : "grid-cols-2 max-w-[16rem]"
                }`}
              >
                {bottom.map(renderBtn)}
              </div>
            </div>
          );
        })()}
        <div className="hidden md:block mb-6 border-b border-border">
          <div className="flex gap-1">
            {tabs.map((t) => {
              const count = t.id === "threads" ? unread.threads : t.id === "messages" ? unread.messages : 0;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-sm font-body inline-flex items-center gap-1.5 border-b-2 -mb-px whitespace-nowrap transition-colors ${
                    tab === t.id ? "border-crimson text-crimson font-bold" : "border-transparent text-charcoal/60 hover:text-charcoal"
                  }`}
                >
                  <t.icon className="w-4 h-4 shrink-0" /> {t.label}
                  {count > 0 && (
                    <span className="ml-0.5 min-w-[1.1rem] h-[1.1rem] px-1 inline-flex items-center justify-center rounded-full bg-crimson text-ivory text-[10px] font-bold leading-none">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "events" && <MyEvents user={user} />}
        {tab === "followers" && <Followers user={user} />}
        {tab === "threads" && <Threads user={user} initialThreadId={threadParam} />}
        {tab === "messages" && <Messages user={user} initialPeer={initialPeer} />}
        {tab === "profile" && <Profile user={user} />}
        {tab === "admin" && isAdmin && (
          <AdminPanel />
        )}
      </div>
    </CalendarLayout>
  );
}

/* ------------- My Events ------------- */
function MyEvents({ user }: { user: User }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [verified, setVerified] = useState(false);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});
  const [interestEvent, setInterestEvent] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showPast, setShowPast] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).rpc("my_events");
    const list = data ?? [];
    setEvents(list);
    setLoading(false);
    const ids = list.map((e: any) => e.id);
    if (ids.length) {
      const { data: rows } = await supabase
        .from("event_interests")
        .select("event_id")
        .in("event_id", ids);
      const counts: Record<string, number> = {};
      (rows ?? []).forEach((r: any) => { counts[r.event_id] = (counts[r.event_id] ?? 0) + 1; });
      setInterestCounts(counts);
    } else {
      setInterestCounts({});
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    (async () => {
      const [{ data: paying }, { data: prof }] = await Promise.all([
        (supabase as any).rpc("is_paying_verified", { _user_id: user.id }),
        (supabase as any).rpc("get_my_organizer_profile"),
      ]);
      const approved = Array.isArray(prof) && prof[0]?.status === "approved";
      setVerified(Boolean(paying) || approved);
    })();
  }, [user.id]);

  const remove = async (id: string) => {
    if (!confirm(t("dashboard.confirmDelete"))) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) { toast({ title: t("dashboard.delete") as string, description: error.message, variant: "destructive" }); return; }
    load();
  };

  const removeSeries = async (groupId: string, occurrenceCount: number) => {
    if (!confirm(t("dashboard.series.confirmDeleteAll", { count: occurrenceCount }))) return;
    const { error } = await (supabase as any).rpc("delete_my_event_series", {
      _recurrence_group_id: groupId,
    });
    if (error) { toast({ title: t("dashboard.series.deleteAll") as string, description: error.message, variant: "destructive" }); return; }
    setEvents((current) => current.filter((event) => event.recurrence_group_id !== groupId));
    toast({ title: t("dashboard.series.deleteAll") as string });
  };


  // Group recurring occurrences under a single displayed event.
  const groupBy = (list: any[]) => {
    const byGroup = new Map<string, any[]>();
    const rows: { key: string; groupId: string | null; items: any[] }[] = [];
    list.forEach((e) => {
      const gid = e.recurrence_group_id as string | null;
      if (!gid) { rows.push({ key: e.id, groupId: null, items: [e] }); return; }
      if (!byGroup.has(gid)) {
        const items: any[] = [];
        byGroup.set(gid, items);
        rows.push({ key: gid, groupId: gid, items });
      }
      byGroup.get(gid)!.push(e);
    });
    rows.forEach((r) => r.items.sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at)));
    rows.sort((a, b) => +new Date(a.items[0].start_at) - +new Date(b.items[0].start_at));
    return rows;
  };

  const isPast = (e: any) => new Date(e.start_at).getTime() < Date.now();


  const { groups, pastGroups } = useMemo(() => {
    const upcoming = events.filter((e) => !isPast(e));
    const past = events.filter(isPast);
    const pastRows = groupBy(past);
    pastRows.forEach((r) => r.items.reverse());
    pastRows.reverse();
    return { groups: groupBy(upcoming), pastGroups: pastRows };
  }, [events]);


  const renderEventBody = (e: any) => (
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-display text-lg truncate">{e.title}</h3>
        <StatusPill status={e.status} />
      </div>
      <p className="text-xs text-charcoal/60 mt-0.5">
        {formatEventTime(e.start_at, "EEE, MMM d, yyyy · h:mm a", (e as any).diocese_slug)}
        {e.venue_name && ` · ${e.venue_name}`}
      </p>
      {e.status === "rejected" && e.rejection_reason && (
        <p className="text-xs text-destructive mt-1">{t("dashboard.rejectedReason")} {e.rejection_reason}</p>
      )}
      <button
        onClick={() => setInterestEvent(e)}
        className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-crimson/30 bg-crimson/5 text-crimson text-xs font-bold hover:bg-crimson/10"
      >
        <Heart className="w-3.5 h-3.5" />
        {t("dashboard.interested.count", { count: interestCounts[e.id] ?? 0 })}
      </button>
    </div>
  );

  const renderEventActions = (e: any) => (
    <div className="flex items-center gap-1 shrink-0">
      {e.status === "approved" && (
        <button
          onClick={() => setEditing(e)}
          className="px-2 py-1 rounded text-xs font-bold text-crimson hover:bg-crimson/10 inline-flex items-center gap-1"
          aria-label={verified ? t("dashboard.edit") as string : t("dashboard.reschedule") as string}
        >
          <Edit3 className="w-3.5 h-3.5" /> {verified ? t("dashboard.edit") : t("dashboard.reschedule")}
        </button>
      )}
      <button onClick={() => remove(e.id)} className="p-2 text-charcoal/50 hover:text-destructive" aria-label={t("dashboard.delete") as string}>
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  const renderGroup = (g: { key: string; groupId: string | null; items: any[] }) => {
    if (!g.groupId || g.items.length < 2) {
      const e = g.items[0];
      return (
        <div key={g.key} className="flex items-center justify-between gap-3 p-4 rounded-md border border-border bg-card">
          {renderEventBody(e)}
          {renderEventActions(e)}
        </div>
      );
    }
    const first = g.items[0];
    const open = expanded.has(g.key);
    return (
      <div key={g.key} className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg truncate">{first.title}</h3>
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-gold/20 text-charcoal/70">
                {t("dashboard.series.badge", { count: g.items.length })}
              </span>
            </div>
            <p className="text-xs text-charcoal/60 mt-0.5">
              {formatEventTime(first.start_at, "EEE, MMM d, yyyy · h:mm a", first.diocese_slug)}
              {first.venue_name && ` · ${first.venue_name}`}
            </p>
            <button
              onClick={() => setExpanded((cur) => {
                const n = new Set(cur);
                n.has(g.key) ? n.delete(g.key) : n.add(g.key);
                return n;
              })}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-crimson hover:underline"
            >
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {open ? t("dashboard.series.hideDates") : t("dashboard.series.showDates", { count: g.items.length })}
            </button>
          </div>
          <div className="shrink-0">
            <button
              onClick={() => removeSeries(g.groupId, g.items.length)}
              className="px-2 py-1 rounded text-xs font-bold text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> {t("dashboard.series.deleteAll")}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-border divide-y divide-border">
            {g.items.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/30">
                {renderEventBody(e)}
                {renderEventActions(e)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-xl">{t("dashboard.myEvents")}</h2>
        <button
          onClick={() => navigate("/catholic-calendar/submit")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-crimson text-ivory text-sm font-bold hover:bg-crimson-deep"
        >
          <Plus className="w-4 h-4" /> {t("dashboard.newEvent")}
        </button>
      </div>
      {loading ? <p className="text-charcoal/50">{t("dashboard.loading")}</p> : events.length === 0 ? (
        <p className="text-charcoal/60 py-8 text-center">{t("dashboard.noneYet")}</p>
      ) : (
        <>
          {groups.length === 0 ? (
            <p className="text-charcoal/60 py-6 text-center">{t("dashboard.noUpcoming")}</p>
          ) : (
            <div className="space-y-2">{groups.map(renderGroup)}</div>
          )}
          {pastGroups.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowPast((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-md border border-border bg-muted/40 text-sm font-bold text-charcoal/70 hover:bg-muted/60"
              >
                <span>{t("dashboard.pastEvents", { count: pastGroups.length })}</span>
                {showPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showPast && (
                <div className="space-y-2 mt-2 opacity-80">{pastGroups.map(renderGroup)}</div>
              )}
            </div>
          )}
        </>
      )}

      {interestEvent && (
        <InterestedModal event={interestEvent} onClose={() => setInterestEvent(null)} />
      )}
      {editing && (
        <EditEventModal
          event={editing}
          verified={verified}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

/* ------------- Interested people modal ------------- */
function InterestedModal({ event, onClose }: { event: any; onClose: () => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("event_interests")
        .select("id,email,phone_e164,created_at,user_id")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, [event.id]);

  return (
    <div className="fixed inset-0 z-50 bg-charcoal/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg border border-border w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
          <div>
            <h3 className="font-display text-lg">{t("dashboard.interested.title")}</h3>
            <p className="text-xs text-charcoal/60 mt-0.5">{event.title}</p>
          </div>
          <button onClick={onClose} className="p-1 text-charcoal/50 hover:text-charcoal" aria-label={t("dashboard.interested.close") as string}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          {rows === null ? (
            <p className="text-charcoal/50 text-sm">{t("dashboard.interested.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-charcoal/60 text-sm">{t("dashboard.interested.none")}</p>
          ) : (
            <>
              <p className="text-sm font-bold text-crimson mb-3">
                {t("dashboard.interested.count", { count: rows.length })}
              </p>
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{r.email}</p>
                      {r.phone_e164 && <p className="text-xs text-charcoal/60">{r.phone_e164}</p>}
                    </div>
                    <span className="text-xs text-charcoal/50 shrink-0">
                      {format(parseISO(r.created_at), "MMM d, yyyy")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------- Followers ------------- */
function Followers({ user }: { user: User }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("organizer_follows")
        .select("id,follower_email,created_at")
        .eq("organizer_user_id", user.id)
        .order("created_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, [user.id]);

  const copyAll = async () => {
    if (!rows || rows.length === 0) return;
    const emails = rows.map((f) => f.follower_email).join("; ");
    try {
      await navigator.clipboard.writeText(emails);
      setCopied(true);
      toast({ title: t("dashboard.followers.copied") });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-xl">{t("dashboard.followers.title")}</h2>
        {rows && rows.length > 0 && (
          <button
            onClick={copyAll}
            className="inline-flex items-center gap-1.5 text-xs font-body bg-crimson text-ivory px-3 py-2 rounded-md hover:bg-crimson/90 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {t("dashboard.followers.copyAll")}
          </button>
        )}
      </div>
      {rows === null ? (
        <p className="text-charcoal/50">{t("dashboard.followers.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-charcoal/60 py-8 text-center">{t("dashboard.followers.none")}</p>
      ) : (
        <>
          <p className="text-sm font-bold text-crimson mb-3">
            {t("dashboard.followers.count", { count: rows.length })}
          </p>
          <div className="space-y-2">
            {rows.map((f) => (
              <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md border border-border bg-card">
                <p className="text-sm break-all">{f.follower_email}</p>
                <span className="text-xs text-charcoal/50 shrink-0">
                  {t("dashboard.followers.since")} {format(parseISO(f.created_at), "MMM d, yyyy")}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditEventModal({ event, verified, onClose, onSaved }: { event: any; verified: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const [form, setForm] = useState({
    title: event.title ?? "",
    description: event.description ?? "",
    category: event.category ?? "other",
    category_other: event.category_other ?? "",
    start: toLocalInput(event.start_at),
    end: toLocalInput(event.end_at),
    all_day: !!event.all_day,
    venue_name: event.venue_name ?? "",
    address: event.address ?? "",
    parish: event.parish ?? "",
    is_free: event.is_free ?? true,
    price_note: event.price_note ?? "",
    registration_url: event.registration_url ?? "",
  });
  const originalAddress = event.address ?? "";
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [removePoster, setRemovePoster] = useState(false);
  const [existingPosterUrl, setExistingPosterUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (event.poster_url) {
        const u = await getPosterUrl(event.poster_url);
        if (!cancelled) setExistingPosterUrl(u);
      }
    })();
    return () => { cancelled = true; };
  }, [event.poster_url]);

  const update = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.start) { setErr(t("dashboard.editModal.startRequired")); return; }
    if (verified && !form.title.trim()) { setErr(t("dashboard.editModal.titleRequired")); return; }
    setSaving(true); setErr(null);
    const patch: Record<string, any> = {
      start_at: new Date(form.start).toISOString(),
      end_at: form.end ? new Date(form.end).toISOString() : null,
    };
    if (verified) {
      patch.title = form.title.trim();
      patch.description = form.description || null;
      patch.category = form.category;
      patch.category_other = form.category === "other" ? (form.category_other || null) : null;
      patch.all_day = form.all_day;
      patch.venue_name = form.venue_name || null;
      patch.address = form.address || null;
      patch.parish = form.parish || null;
      patch.is_free = form.is_free;
      patch.price_note = form.is_free ? null : (form.price_note || null);
      patch.registration_url = form.registration_url || null;

      // If the address changed, wipe cached coords so the geocoder re-locates the pin.
      const addressChanged = (form.address ?? "").trim() !== (originalAddress ?? "").trim();
      if (addressChanged) {
        patch.latitude = null;
        patch.longitude = null;
      }

      // Poster handling
      if (posterFile) {
        try {
          const path = await uploadEventPoster(posterFile, event.owner_id ?? null);
          patch.poster_url = path;
        } catch (e: any) {
          setSaving(false);
          setErr(e?.message ?? t("dashboard.editModal.posterFailed"));
          return;
        }
      } else if (removePoster) {
        patch.poster_url = null;
      }
    }
    const { error } = await (supabase.from("calendar_events") as any).update(patch).eq("id", event.id);
    if (error) { setSaving(false); setErr(error.message); return; }

    // Geocode whenever the event has an address but no coords (either freshly cleared
    // above, or never geocoded in the first place). Await so the map has coords by
    // the time the list refreshes.
    if (form.address) {
      const needsGeocode =
        (form.address ?? "").trim() !== (originalAddress ?? "").trim() ||
        event.latitude == null ||
        event.longitude == null;
      if (needsGeocode) {
        const q = [form.venue_name, form.address].filter(Boolean).join(", ");
        try {
          await supabase.functions.invoke("geocode-address", {
            body: { address: q, eventId: event.id },
          });
        } catch { /* non-fatal */ }
      }
    }

    setSaving(false);
    onSaved();
  };


  const input = "w-full px-3 py-2 rounded border border-border bg-background";
  const label = "block text-xs font-bold uppercase tracking-wide text-charcoal/70 mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-lg max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl mb-1">{verified ? t("dashboard.editModal.editTitle") : t("dashboard.editModal.rescheduleTitle")}</h3>
        <p className="text-xs text-charcoal/60 mb-4 truncate">{event.title}</p>

        {verified && (
          <>
            <label className={label}>{t("dashboard.editModal.title")}</label>
            <input value={form.title} onChange={(e) => update("title", e.target.value)} className={`${input} mb-3`} />

            <label className={label}>{t("dashboard.editModal.category")}</label>
            <select value={form.category} onChange={(e) => update("category", e.target.value)} className={`${input} mb-3`}>
              {CATEGORIES.map((c: any) => (
                <option key={c.value} value={c.value}>{categoryLabel(c.value)}</option>
              ))}
            </select>

            {form.category === "other" && (
              <>
                <label className={label}>{t("dashboard.editModal.categoryOther")}</label>
                <input value={form.category_other} onChange={(e) => update("category_other", e.target.value)} className={`${input} mb-3`} />
              </>
            )}

            <label className={label}>{t("dashboard.editModal.description")}</label>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} className={`${input} mb-3`} />
          </>
        )}

        <label className={label}>{t("dashboard.editModal.start")}</label>
        <input type="datetime-local" value={form.start} onChange={(e) => update("start", e.target.value)} className={`${input} mb-3`} />

        <label className={label}>{t("dashboard.editModal.end")}</label>
        <input type="datetime-local" value={form.end} onChange={(e) => update("end", e.target.value)} className={`${input} mb-3`} />

        {verified && (
          <>
            <label className="inline-flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" checked={form.all_day} onChange={(e) => update("all_day", e.target.checked)} />
              {t("dashboard.editModal.allDay")}
            </label>

            <label className={label}>{t("dashboard.editModal.venue")}</label>
            <input value={form.venue_name} onChange={(e) => update("venue_name", e.target.value)} className={`${input} mb-3`} />

            <label className={label}>{t("dashboard.editModal.address")}</label>
            <input value={form.address} onChange={(e) => update("address", e.target.value)} className={`${input} mb-3`} />
            <p className="text-[11px] text-charcoal/55 -mt-2 mb-3">{t("dashboard.editModal.addressNote")}</p>

            <label className={label}>{t("dashboard.editModal.parish")}</label>
            <input value={form.parish} onChange={(e) => update("parish", e.target.value)} className={`${input} mb-3`} />

            <label className={label}>{t("dashboard.editModal.regUrl")}</label>
            <input value={form.registration_url} onChange={(e) => update("registration_url", e.target.value)} className={`${input} mb-3`} />

            <label className="inline-flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" checked={form.is_free} onChange={(e) => update("is_free", e.target.checked)} />
              {t("dashboard.editModal.free")}
            </label>

            {!form.is_free && (
              <>
                <label className={label}>{t("dashboard.editModal.priceNote")}</label>
                <input value={form.price_note} onChange={(e) => update("price_note", e.target.value)} className={`${input} mb-3`} />
              </>
            )}

            <label className={label}>{t("dashboard.editModal.poster")}</label>
            <div className="flex items-start gap-3 mb-3">
              {posterPreview || (existingPosterUrl && !removePoster) ? (
                <div className="relative w-28 h-36 rounded-md overflow-hidden border border-border bg-muted shrink-0">
                  <img
                    src={posterPreview ?? existingPosterUrl ?? ""}
                    alt="Poster preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (posterFile) { setPosterFile(null); setPosterPreview(null); }
                      else { setRemovePoster(true); }
                    }}
                    className="absolute top-1 right-1 p-1 rounded-full bg-charcoal/80 text-ivory hover:bg-charcoal"
                    aria-label={t("submit.posterRemove") as string}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1 w-28 h-36 rounded-md border-2 border-dashed border-gold/50 bg-gold/5 text-charcoal/60 cursor-pointer hover:border-crimson hover:text-crimson transition-colors shrink-0">
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-[10px] text-center px-1">{t("submit.posterAdd")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!/^image\//.test(f.type)) { setErr(t("submit.posterImage")); return; }
                      if (f.size > 8 * 1024 * 1024) { setErr(t("submit.posterSize")); return; }
                      setPosterFile(f);
                      setPosterPreview(URL.createObjectURL(f));
                      setRemovePoster(false);
                      setErr(null);
                    }}
                  />
                </label>
              )}
              <p className="text-xs text-charcoal/60 leading-relaxed">
                {t("submit.posterFormat")}
              </p>
            </div>
          </>
        )}

        {err && <p className="text-xs text-destructive mb-2">{err}</p>}
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-3 py-2 rounded text-sm text-charcoal/70 hover:bg-charcoal/5">{t("dashboard.editModal.cancel")}</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-crimson text-ivory text-sm font-bold hover:bg-crimson-deep disabled:opacity-50">
            {saving ? t("dashboard.editModal.saving") : t("dashboard.editModal.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "approved" ? "bg-emerald-100 text-emerald-800" :
    status === "rejected" ? "bg-red-100 text-red-800" :
    "bg-amber-100 text-amber-800";
  return <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}

/* ------------- Discussion Threads ------------- */
function Threads({ user, initialThreadId }: { user: User; initialThreadId?: string | null }) {
  const { t } = useTranslation();
  const { diocese, dioceseName, scopeSlugs, scopeKey, primarySlug } = useDiocese();
  const [threads, setThreads] = useState<any[]>([]);
  const [authors, setAuthors] = useState<Record<string, { org_name: string | null; parish: string | null; logo_url: string | null; status: string | null; diocese_slug?: string | null }>>({});
  const [open, setOpen] = useState<string | null>(initialThreadId ?? null);
  const threadPaneRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (initialThreadId) setOpen(initialThreadId);
  }, [initialThreadId]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      threadPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(t);
  }, [open]);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [pins, setPins] = useState<Set<string>>(new Set());
  const seenKey = `threads_last_seen_${user.id}`;
  const [lastSeen, setLastSeen] = useState<number>(() => {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(seenKey) : null;
    return v ? parseInt(v, 10) : 0;
  });
  const markAllSeen = () => {
    const now = Date.now();
    window.localStorage.setItem(seenKey, String(now));
    setLastSeen(now);
  };
  const isNew = (t: any) => t.author_user_id !== user.id && new Date(t.created_at).getTime() > lastSeen;
  const newCount = threads.filter(isNew).length;

  const loadPins = async () => {
    const { data } = await supabase.from("thread_pins").select("thread_id").eq("user_id", user.id);
    setPins(new Set((data ?? []).map((p: any) => p.thread_id)));
  };
  const togglePin = async (threadId: string) => {
    if (pins.has(threadId)) {
      await supabase.from("thread_pins").delete().eq("user_id", user.id).eq("thread_id", threadId);
      setPins((cur) => { const n = new Set(cur); n.delete(threadId); return n; });
    } else {
      await supabase.from("thread_pins").insert({ user_id: user.id, thread_id: threadId });
      setPins((cur) => new Set(cur).add(threadId));
    }
  };

  const load = async () => {
    const { data } = await supabase
      .from("discussion_threads")
      .select("*")
      .order("created_at", { ascending: false });
    const list = data ?? [];
    const ids = Array.from(new Set(list.map((t: any) => t.author_user_id).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("organizer_profiles_public")
        .select("user_id,org_name,parish,logo_url,status,diocese_slug,diocese_slugs")
        .in("user_id", ids);
      const map: Record<string, { org_name: string | null; parish: string | null; logo_url: string | null; status: string | null; diocese_slug?: string | null }> = {};
      const inDiocese = new Set<string>();
      (profs ?? []).forEach((p: any) => {
        map[p.user_id] = { org_name: p.org_name, parish: p.parish, logo_url: p.logo_url, status: p.status, diocese_slug: p.diocese_slug };
        const slugs: string[] = p.diocese_slugs?.length ? p.diocese_slugs : p.diocese_slug ? [p.diocese_slug] : [];
        // No diocese at all means the organizer is global (visible everywhere).
        if (slugs.length === 0 || slugs.some((s) => scopeSlugs.includes(s))) inDiocese.add(p.user_id);
      });
      setAuthors(map);
      // A thread belongs to the diocese it was posted in. Legacy threads without
      // one fall back to the author's diocese. Your own threads always show.
      setThreads(
        list.filter((th: any) =>
          th.author_user_id === user.id ||
          (th.diocese_slug ? scopeSlugs.includes(th.diocese_slug) : inDiocese.has(th.author_user_id)),
        ),
      );
    } else {
      setThreads(list);
    }
  };
  useEffect(() => { load(); loadPins(); }, [scopeKey]);

  // Mark all current threads as seen shortly after viewing the list/feed
  useEffect(() => {
    if (!threads.length) return;
    const t = setTimeout(markAllSeen, 1500);
    return () => clearTimeout(t);
  }, [threads.length]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await supabase.from("discussion_threads").insert({
      title: newTitle,
      body: newBody || null,
      author_user_id: user.id,
      diocese_slug: primarySlug,
    });
    setNewTitle(""); setNewBody(""); setCreating(false);
    load();
  };


  return (
    <div className="grid md:grid-cols-[1fr_1.4fr] gap-6">
      <div className={open ? "hidden md:block" : "block"}>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl flex items-center gap-2">
            {t("dashboard.threads.heading")}
            {newCount > 0 && (
              <span className="text-[10px] font-bold bg-crimson text-ivory rounded-full px-2 py-0.5 leading-none">
                {newCount} {t("dashboard.threads.newBadge")}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setCreating((c) => !c)} className="text-xs text-crimson hover:underline">
              {creating ? t("dashboard.threads.cancel") : t("dashboard.threads.newThread")}
            </button>
          </div>
        </div>
        <p className="text-xs text-charcoal/60 mb-3 leading-relaxed">
          {t("dashboard.threads.intro", { diocese: dioceseName })}
        </p>
        {creating && (
          <form onSubmit={create} className="mb-4 space-y-2 p-3 border border-border rounded-md bg-card">
            <input className={txt} placeholder={t("dashboard.threads.titlePh") as string} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
            <textarea className={txt} placeholder={t("dashboard.threads.bodyPh") as string} rows={3} value={newBody} onChange={(e) => setNewBody(e.target.value)} />
            <button className="px-3 py-1.5 text-xs rounded bg-crimson text-ivory font-bold">{t("dashboard.threads.post")}</button>
          </form>
        )}
        <ThreadsFeed
          threads={[...threads].sort((a, b) => {
            const ap = pins.has(a.id) || a.pinned ? 1 : 0;
            const bp = pins.has(b.id) || b.pinned ? 1 : 0;
            if (ap !== bp) return bp - ap;
            const at = new Date(a.last_activity_at || a.created_at).getTime();
            const bt = new Date(b.last_activity_at || b.created_at).getTime();
            return bt - at;
          })}
          authors={authors}
          isNew={isNew}
          user={user}
          pins={pins}
          onTogglePin={togglePin}
          onOpen={(id) => setOpen(id)}
        />
      </div>
      <div className={`min-h-[300px] ${open ? "block" : "hidden md:block"}`} ref={threadPaneRef}>
        {open ? <ThreadView threadId={open} user={user} authors={authors} onClose={() => setOpen(null)} onDeleted={() => { setOpen(null); load(); }} onActivity={() => load()} /> : (
          <div className="h-full grid place-items-center text-sm text-charcoal/50 border border-dashed border-border rounded-md p-8">
            {t("dashboard.threads.selectPrompt")}
          </div>
        )}
      </div>

    </div>
  );
}

/* ------------- Threads Feed (reels-style vertical snap) ------------- */
function ThreadsFeed({
  threads, authors, isNew, user, pins, onTogglePin, onOpen,
}: {
  threads: any[];
  authors: Record<string, { org_name: string | null; parish: string | null; logo_url: string | null; status: string | null; diocese_slug?: string | null }>;
  isNew: (t: any) => boolean;
  user: User;
  pins: Set<string>;
  onTogglePin: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (threads.length === 0) {
    return <p className="text-sm text-charcoal/50 py-6 text-center">{t("dashboard.threads.empty")}</p>;
  }
  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-md border border-border bg-card divide-y divide-border">
      {threads.map((t) => (
        <FeedCard
          key={t.id}
          thread={t}
          author={authors[t.author_user_id] || { org_name: null, parish: null, logo_url: null, status: null }}
          isNewThread={isNew(t)}
          user={user}
          pinned={pins.has(t.id)}
          onTogglePin={() => onTogglePin(t.id)}
          onOpen={() => onOpen(t.id)}
        />
      ))}
    </div>
  );
}

function FeedCard({
  thread, author, isNewThread, pinned, onTogglePin, onOpen,
}: {
  thread: any;
  author: { org_name: string | null; parish: string | null; logo_url: string | null; status: string | null; diocese_slug?: string | null };
  isNewThread: boolean;
  user: User;
  pinned: boolean;
  onTogglePin: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const [replyCount, setReplyCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("discussion_replies")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", thread.id);
      if (!cancelled) setReplyCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [thread.id]);

  return (
    <div className="p-4 relative hover:bg-muted/40 transition-colors">
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {isNewThread && (
          <span className="text-[10px] font-bold bg-crimson text-ivory rounded-full px-2 py-0.5 leading-none">
            NEW
          </span>
        )}
        <button
          onClick={onTogglePin}
          className={`p-1 rounded ${pinned ? "text-crimson" : "text-charcoal/40 hover:text-crimson"}`}
          aria-label={pinned ? t("dashboard.threads.unpin") as string : t("dashboard.threads.pin") as string}
          title={pinned ? t("dashboard.threads.pinShort") as string : t("dashboard.threads.pinToTop") as string}
        >
          <Pin className={`w-4 h-4 ${pinned ? "fill-crimson" : ""}`} />
        </button>
      </div>

      <button onClick={onOpen} className="w-full text-left block pr-20">
        <div className="flex items-center gap-2 mb-2">
          <OrgAvatar logo={author.logo_url} name={author.org_name} size={28} />
          <div className="min-w-0">
            <div className="text-xs font-bold text-charcoal/80 inline-flex items-center gap-1 truncate">
              {displayName(author.org_name)}
              {author.status === "approved" && <VerifiedBadge size={12} />}
            </div>
            <div className="mt-0.5"><VisitingDioceseNote homeSlug={author.diocese_slug} postedSlug={thread.diocese_slug} /></div>
            <div className="text-[10px] text-charcoal/55">{format(parseISO(thread.created_at), "MMM d · h:mm a")}</div>
          </div>

        </div>

        <h3 className="font-display text-lg leading-tight mb-1 [overflow-wrap:anywhere] line-clamp-2">
          {thread.title}
        </h3>
        {thread.body && (
          <p className="text-sm text-charcoal/70 [overflow-wrap:anywhere] line-clamp-2 mb-2">
            {thread.body}
          </p>
        )}

        <div className="inline-flex items-center gap-1.5 text-xs text-charcoal/65 mt-1">
          <MessageSquare className="w-4 h-4 text-crimson" />
          <span className="font-bold">{replyCount ?? "…"}</span>
          <span className="text-charcoal/55">{replyCount === 1 ? t("dashboard.threads.reply") : t("dashboard.threads.replies")}</span>
        </div>
      </button>
    </div>
  );
}

function ThreadView({ threadId, user, authors, onClose, onDeleted, onActivity }: { threadId: string; user: User; authors: Record<string, { org_name: string | null; parish: string | null; logo_url: string | null; status: string | null; diocese_slug?: string | null }>; onClose: () => void; onDeleted: () => void; onActivity?: () => void }) {
  const { t } = useTranslation();
  const [thread, setThread] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [replyAuthors, setReplyAuthors] = useState<Record<string, { org_name: string | null; logo_url: string | null; status: string | null }>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyTo, setReplyTo] = useState<{ name: string; snippet: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  // Snapshot the last-seen reply timestamp at open time so we can draw a divider
  // before the first reply you hadn't read yet. Persist per-thread in localStorage.
  const seenKey = `thread_last_seen_${user.id}_${threadId}`;
  const [openSnapshot, setOpenSnapshot] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const v = window.localStorage.getItem(seenKey);
    return v ? parseInt(v, 10) : 0;
  });
  useEffect(() => {
    if (isFocusOpen()) return;
    const mineLast = replies.length > 0 && replies[replies.length - 1].author_user_id === user.id;
    const timers: number[] = [];
    if (mineLast) {
      [0, 60, 200, 500].forEach((d) => timers.push(window.setTimeout(() => scrollElToBottom(bottomRef.current), d)));
    } else {
      timers.push(window.setTimeout(() => {
        if (dividerRef.current) {
          scrollElIntoContainer(dividerRef.current, "center");
        } else {
          scrollElToBottom(bottomRef.current);
        }
      }, 50));
    }
    return () => { timers.forEach((t) => clearTimeout(t)); };
  }, [replies.length, threadId, user.id]);
  // Mark as seen up to the newest reply (or thread creation) on open / when new arrive while open.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const latest = replies.length ? new Date(replies[replies.length - 1].created_at).getTime() : 0;
    if (latest > 0) window.localStorage.setItem(seenKey, String(latest));
  }, [replies.length, seenKey]);

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));
    })();
  }, [user.id]);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("discussion_threads").select("*").eq("id", threadId).maybeSingle();
      setThread(t);
      const { data: r } = await supabase.from("discussion_replies").select("*").eq("thread_id", threadId).order("created_at");
      setReplies(r ?? []);
      const ids = Array.from(new Set((r ?? []).map((x: any) => x.author_user_id).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from("organizer_profiles")
          .select("user_id,org_name,logo_url,status")
          .in("user_id", ids);
        const map: Record<string, { org_name: string | null; logo_url: string | null; status: string | null }> = {};
        (profs ?? []).forEach((p: any) => { map[p.user_id] = { org_name: p.org_name, logo_url: p.logo_url, status: p.status }; });
        setReplyAuthors(map);
      } else {
        setReplyAuthors({});
      }
    })();
    const ch = supabase
      .channel(`thread-${threadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "discussion_replies", filter: `thread_id=eq.${threadId}` },
        async (payload) => {
          const nr: any = payload.new;
          setReplies((cur) => (cur.some((x) => x.id === nr.id) ? cur : [...cur, nr]));
          if (nr.author_user_id) {
            const { data: p } = await supabase
              .from("organizer_profiles").select("user_id,org_name,logo_url,status")
              .eq("user_id", nr.author_user_id).maybeSingle();
            if (p) setReplyAuthors((cur) => ({ ...cur, [p.user_id]: { org_name: p.org_name, logo_url: (p as any).logo_url, status: (p as any).status } }));
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [threadId, user.id]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const attachments = pendingFiles.length ? await uploadChatFiles(user.id, pendingFiles) : [];
      const body = replyTo ? buildQuotedReply(replyTo.name, replyTo.snippet, text) : (text || null);
      const { error } = await supabase.from("discussion_replies").insert({
        thread_id: threadId, body, author_user_id: user.id, attachments,
      });
      if (error) { console.error(error); alert(t("dashboard.threads.sendFailed") + " " + error.message); return; }
      setText(""); setPendingFiles([]); setReplyTo(null);
      const now = Date.now();
      if (typeof window !== "undefined") window.localStorage.setItem(seenKey, String(now));
      setOpenSnapshot(now);
      onActivity?.();
    } finally { setSending(false); }
  };

  const deleteThread = async () => {
    if (!confirm(t("dashboard.threads.confirmDeleteThread"))) return;
    await supabase.from("discussion_replies").delete().eq("thread_id", threadId);
    const { error } = await supabase.from("discussion_threads").delete().eq("id", threadId);
    if (error) { alert(t("dashboard.threads.deleteFailed") + " " + error.message); return; }
    onDeleted();
  };

  const deleteReply = async (id: string) => {
    if (!confirm(t("dashboard.threads.confirmDeleteReply"))) return;
    const { error } = await supabase.from("discussion_replies").delete().eq("id", id);
    if (error) { alert(t("dashboard.threads.deleteFailed") + " " + error.message); return; }
    setReplies((cur) => cur.filter((r) => r.id !== id));
  };

  if (!thread) return null;

  const threadAuthorName = displayName(authors[thread.author_user_id]?.org_name);
  const threadAuthorLogo = authors[thread.author_user_id]?.logo_url || null;
  const threadAuthorVerified = authors[thread.author_user_id]?.status === "approved";
  const canDeleteThread = isAdmin || thread.author_user_id === user.id;

  const chainMessages: ChainMessage[] = [
    {
      id: `thread:${thread.id}`,
      authorName: threadAuthorName,
      body: thread.body || "",
      mine: thread.author_user_id === user.id,
      createdAt: thread.created_at,
    },
    ...replies.map((r) => ({
      id: r.id,
      authorName: displayName(replyAuthors[r.author_user_id]?.org_name),
      body: r.body,
      attachments: r.attachments,
      mine: r.author_user_id === user.id,
      createdAt: r.created_at,
    })),
  ];
  const sendReplyInChain = async (parent: { name: string; text: string }, replyText: string) => {
    const body = buildQuotedReply(parent.name, parent.text, replyText);
    const { error } = await supabase.from("discussion_replies").insert({
      thread_id: threadId, body, author_user_id: user.id, attachments: [],
    });
    if (error) alert(t("dashboard.threads.sendFailed") + " " + error.message);
  };

  return (
    <ReplyChainProvider messages={chainMessages} sendReply={sendReplyInChain}>
    <div className="border border-border rounded-md bg-card p-4 flex flex-col h-[70vh] min-w-0 overflow-hidden">
      <header className="border-b border-border pb-3 mb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <button type="button" onClick={onClose} className="md:hidden px-2 py-1 -ml-1 rounded text-sm text-charcoal/70 hover:bg-muted shrink-0">←</button>
            <h3 className="font-display text-xl leading-tight min-w-0 break-words">{thread.title}</h3>
          </div>

          <div className="flex items-center gap-1 shrink-0 -mt-1">
            {canDeleteThread && (
              <button onClick={deleteThread} className="p-1.5 rounded text-red-700 hover:bg-red-50" aria-label={t("dashboard.threads.deleteThreadAria") as string} title={t("dashboard.threads.deleteThreadTitle") as string}>
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded text-charcoal/60 hover:bg-muted" aria-label={t("dashboard.threads.closeAria") as string} title={t("dashboard.threads.closeTitle") as string}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-charcoal/55 min-w-0">
          <ProfileLink userId={thread.author_user_id} backTo={`/catholic-calendar/dashboard?tab=threads&thread=${thread.id}`}>
            <OrgAvatar logo={threadAuthorLogo} name={threadAuthorName} size={20} />
            <span className="font-bold text-charcoal/80 inline-flex items-center gap-1 hover:text-crimson truncate">
              {threadAuthorName}
              {threadAuthorVerified && <VerifiedBadge size={12} />}
            </span>
          </ProfileLink>
          <span className="text-charcoal/40">·</span>
          <span className="truncate">{format(parseISO(thread.created_at), "MMM d · h:mm a")}</span>
          <VisitingDioceseNote homeSlug={authors[thread.author_user_id]?.diocese_slug} postedSlug={thread.diocese_slug} />
        </div>

        {thread.body && <p className="text-sm text-charcoal/75 mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{thread.body}</p>}
      </header>
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {(() => {
          const firstUnreadIdx = openSnapshot > 0
            ? replies.findIndex((r) => r.author_user_id !== user.id && new Date(r.created_at).getTime() > openSnapshot)
            : -1;
          return replies.map((r, i) => {
            const name = displayName(replyAuthors[r.author_user_id]?.org_name);
            const logo = replyAuthors[r.author_user_id]?.logo_url || null;
            const verified = replyAuthors[r.author_user_id]?.status === "approved";
            const mine = r.author_user_id === user.id;
            const canDelete = isAdmin || mine;
            const showDivider = i === firstUnreadIdx;
            return (
              <React.Fragment key={r.id}>
                {showDivider && (
                  <div ref={dividerRef} className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-crimson/30" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-crimson/80">{t("dashboard.threads.newMessages")}</span>
                    <div className="flex-1 h-px bg-crimson/30" />
                  </div>
                )}
                <SwipeToReply onReply={() => setReplyTo({ name, snippet: r.body || "" })}>
                  <div className={`p-2.5 rounded-md text-sm ${mine ? "bg-crimson/10 ml-6" : "bg-muted mr-6"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <ProfileLink userId={r.author_user_id} backTo={`/catholic-calendar/dashboard?tab=threads&thread=${thread.id}`}>
                        <OrgAvatar logo={logo} name={name} size={16} />
                        <span className="text-[11px] font-bold text-charcoal/75 inline-flex items-center gap-1 hover:text-crimson">
                          {name}
                          {verified && <VerifiedBadge size={12} />}
                          {mine && t("dashboard.threads.you")}
                        </span>
                      </ProfileLink>
                      {canDelete && (
                        <button onClick={() => deleteReply(r.id)} className="text-red-700 hover:text-red-900" aria-label={t("dashboard.threads.deleteReplyAria") as string}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="mt-0.5"><MessageBody body={r.body} attachments={r.attachments} /></div>
                    <p className="text-[10px] text-charcoal/50 mt-1">{format(parseISO(r.created_at), "MMM d · h:mm a")}</p>
                  </div>
                </SwipeToReply>
              </React.Fragment>
            );
          });
        })()}
        {replies.length === 0 && <p className="text-xs text-charcoal/40 text-center py-4">{t("dashboard.threads.beFirstReply")}</p>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="space-y-1 min-w-0">
        {replyTo && <ReplyingToBar name={replyTo.name} snippet={replyTo.snippet} onCancel={() => setReplyTo(null)} />}
        <PendingAttachments files={pendingFiles} onRemove={(i) => setPendingFiles((cur) => cur.filter((_, idx) => idx !== i))} />
        <div className="flex gap-2">
          <AttachButton disabled={sending} onFiles={(f) => setPendingFiles((cur) => [...cur, ...f])} />
          <AutoGrowTextarea
            className={txt + " flex-1"}
            value={text}
            onChange={setText}
            onSubmit={() => send()}
            placeholder={t("dashboard.threads.replyPh") as string}
          />
          <button disabled={sending} className="px-3 rounded bg-crimson text-ivory disabled:opacity-60 self-end" aria-label={t("dashboard.threads.sendAria") as string}><Send className="w-4 h-4" /></button>
        </div>
      </form>
    </div>
    </ReplyChainProvider>
  );
}

/* ------------- Direct Messages ------------- */
function DmThreadProvider({
  activePeer,
  thread,
  userId,
  peerName,
  dioceseSlug,
  children,
}: {
  activePeer: string | null;
  thread: any[];
  userId: string;
  peerName: string;
  dioceseSlug: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const messages: ChainMessage[] = thread.map((m) => {
    const mine = m.sender_user_id === userId;
    return {
      id: m.id,
      authorName: mine ? (t("dashboard.messages.yourself") as string) : peerName,
      body: m.body,
      attachments: m.attachments,
      mine,
      createdAt: m.created_at,
    };
  });
  const sendReply = async (parent: { name: string; text: string }, replyText: string) => {
    if (!activePeer) return;
    const body = buildQuotedReply(parent.name, parent.text, replyText);
    const { error } = await supabase.from("direct_messages").insert({
      sender_user_id: userId, recipient_user_id: activePeer, body, attachments: [], diocese_slug: dioceseSlug,
    });
    if (error) alert(t("dashboard.messages.sendFailed") + " " + error.message);
  };
  return <ReplyChainProvider messages={messages} sendReply={sendReply}>{children}</ReplyChainProvider>;
}

function Messages({ user, initialPeer }: { user: User; initialPeer?: string | null }) {
  const { t } = useTranslation();
  const { diocese, dioceseName, scopeSlugs, scopeKey, primarySlug } = useDiocese();
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const orgs = useMemo(
    () =>
      allOrgs.filter((o) => {
        if (o.user_id === user.id) return false;
        const slugs: string[] = o.diocese_slugs?.length
          ? o.diocese_slugs
          : o.diocese_slug
            ? [o.diocese_slug]
            : [];
        // Organizers with no diocese set are visible everywhere.
        return slugs.length === 0 || slugs.some((s) => scopeSlugs.includes(s));
      }),
    [allOrgs, scopeKey, user.id],
  );
  const [allMsgs, setAllMsgs] = useState<any[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(initialPeer ?? null);
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [listTab, setListTab] = useState<"conversations" | "groups" | "all" | "trash">("conversations");
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [groupUnread, setGroupUnread] = useState<Record<string, number>>({});
  const [myGroupRoles, setMyGroupRoles] = useState<Record<string, string>>({});
  const [mutedGroups, setMutedGroups] = useState<Record<string, boolean>>({});
  const activeGroupRef = useRef<string | null>(null);
  useEffect(() => { activeGroupRef.current = activeGroup; }, [activeGroup]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [convStates, setConvStates] = useState<Record<string, { last_read_at: string; deleted_at: string | null }>>({});
  const [replyTo, setReplyTo] = useState<{ name: string; snippet: string } | null>(null);
  const [openSnapshot, setOpenSnapshot] = useState<string | null>(null);
  const dmBottomRef = useRef<HTMLDivElement | null>(null);
  const dmDividerRef = useRef<HTMLDivElement | null>(null);
  const dmPaneRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!activePeer) return;
    const t = setTimeout(() => {
      dmPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(t);
  }, [activePeer]);

  const loadOrgs = async () => {
    // All approved organizers are loaded so names/avatars resolve for any peer,
    // but the visible directory + conversation list are scoped to the diocese.
    const { data } = await supabase
      .from("organizer_profiles_public")
      .select("user_id,org_name,parish,logo_url,diocese_slug,diocese_slugs")
      .eq("status", "approved");
    setAllOrgs(data ?? []);
  };

  const loadMsgs = async () => {
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_user_id.eq.${user.id},recipient_user_id.eq.${user.id}`)
      .order("created_at");
    setAllMsgs(data ?? []);
  };

  const loadStates = async () => {
    const { data } = await supabase
      .from("dm_conversation_state")
      .select("peer_user_id,last_read_at,deleted_at")
      .eq("user_id", user.id);
    const m: Record<string, { last_read_at: string; deleted_at: string | null }> = {};
    (data ?? []).forEach((r: any) => { m[r.peer_user_id] = { last_read_at: r.last_read_at, deleted_at: r.deleted_at }; });
    setConvStates(m);
  };

  const upsertState = async (peer: string, patch: { last_read_at?: string; deleted_at?: string | null }) => {
    setConvStates((c) => ({ ...c, [peer]: { last_read_at: patch.last_read_at ?? c[peer]?.last_read_at ?? new Date(0).toISOString(), deleted_at: patch.deleted_at !== undefined ? patch.deleted_at : (c[peer]?.deleted_at ?? null) } }));
    await supabase.from("dm_conversation_state").upsert({
      user_id: user.id,
      peer_user_id: peer,
      ...patch,
    }, { onConflict: "user_id,peer_user_id" });
  };

  const loadGroups = async () => {
    const { data: mem } = await supabase
      .from("dm_group_members")
      .select("group_id,role,last_read_at,muted")
      .eq("user_id", user.id);
    const ids = (mem ?? []).map((m: any) => m.group_id);
    if (!ids.length) { setGroups([]); setGroupUnread({}); setMyGroupRoles({}); setMutedGroups({}); return; }
    const roles: Record<string, string> = {};
    const reads: Record<string, string> = {};
    const muted: Record<string, boolean> = {};
    (mem ?? []).forEach((m: any) => {
      roles[m.group_id] = m.role ?? "member";
      reads[m.group_id] = m.last_read_at ?? new Date(0).toISOString();
      muted[m.group_id] = !!m.muted;
    });
    setMyGroupRoles(roles);
    setMutedGroups(muted);
    const { data } = await supabase
      .from("dm_groups")
      .select("id,name,created_by,created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    setGroups(data ?? []);

    const { data: gMsgs } = await supabase
      .from("dm_group_messages")
      .select("group_id,sender_user_id,created_at")
      .in("group_id", ids);
    const counts: Record<string, number> = {};
    (gMsgs ?? []).forEach((m: any) => {
      if (m.sender_user_id === user.id) return;
      if (muted[m.group_id]) return;
      if (m.created_at > (reads[m.group_id] ?? "")) counts[m.group_id] = (counts[m.group_id] ?? 0) + 1;
    });
    setGroupUnread(counts);
  };

  // Mute / unmute a specific group for me only.
  const toggleGroupMute = async (groupId: string) => {
    const next = !mutedGroups[groupId];
    setMutedGroups((c) => ({ ...c, [groupId]: next }));
    if (next) setGroupUnread((c) => ({ ...c, [groupId]: 0 }));
    await supabase
      .from("dm_group_members")
      .update({ muted: next } as any)
      .eq("group_id", groupId)
      .eq("user_id", user.id);
    loadGroups();
  };

  // Opening a group clears its unread badge.
  const markGroupRead = async (groupId: string) => {
    setGroupUnread((c) => ({ ...c, [groupId]: 0 }));
    await supabase
      .from("dm_group_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("group_id", groupId)
      .eq("user_id", user.id);
  };


  useEffect(() => {
    loadOrgs();
    loadMsgs();
    loadStates();
    loadGroups();
    const ch = supabase
      .channel(`dm-${user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_user_id=eq.${user.id}` },
        (p) => {
          setAllMsgs((c) => [...c, p.new]);
          // Auto-restore a soft-deleted conversation when a new message arrives
          const peer = (p.new as any).sender_user_id as string;
          setConvStates((c) => c[peer]?.deleted_at ? { ...c, [peer]: { ...c[peer], deleted_at: null } } : c);
        })
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `sender_user_id=eq.${user.id}` },
        (p) => setAllMsgs((c) => c.some((m) => m.id === (p.new as any).id) ? c : [...c, p.new]))
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_group_messages" },
        (p) => {
          const row = p.new as any;
          if (row.sender_user_id === user.id) return;
          if (activeGroupRef.current === row.group_id) { void markGroupRead(row.group_id); return; }
          setGroupUnread((c) => ({ ...c, [row.group_id]: (c[row.group_id] ?? 0) + 1 }));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id]);


  const allPeers = useMemo(() => {
    const lastMsgAt: Record<string, number> = {};
    allMsgs.forEach((m) => {
      const peer = m.sender_user_id === user.id ? m.recipient_user_id : m.sender_user_id;
      const t = new Date(m.created_at).getTime();
      if (!lastMsgAt[peer] || t > lastMsgAt[peer]) lastMsgAt[peer] = t;
    });
    // DMs are private to their two participants and remain in both participants'
    // chat lists regardless of which diocese either person is currently viewing.
    // Most recent conversations appear first.
    return Object.keys(lastMsgAt).sort((a, b) => lastMsgAt[b] - lastMsgAt[a]);
  }, [allMsgs, user.id]);


  const peers = useMemo(() => allPeers.filter((id) => !convStates[id]?.deleted_at), [allPeers, convStates]);
  // Deleted conversations stay restorable for 5 days, then drop off the list.
  const deletedPeers = useMemo(() => {
    const cutoff = Date.now() - 5 * 24 * 60 * 60 * 1000;
    return allPeers.filter((id) => {
      const d = convStates[id]?.deleted_at;
      return !!d && new Date(d).getTime() >= cutoff;
    });
  }, [allPeers, convStates]);

  const unreadFor = (peer: string) => {
    const lastRead = convStates[peer]?.last_read_at ?? new Date(0).toISOString();
    return allMsgs.filter((m) => m.sender_user_id === peer && m.recipient_user_id === user.id && m.created_at > lastRead).length;
  };
  const totalUnread = peers.reduce((sum, id) => sum + unreadFor(id), 0);
  const totalGroupUnread = Object.values(groupUnread).reduce((a, b) => a + b, 0);


  // Names/avatars resolve for every approved organizer, even outside the diocese
  // (e.g. an open thread while switching cities).
  const orgByUser = useMemo(() => {
    const m: Record<string, any> = {};
    allOrgs.forEach((o) => (m[o.user_id] = o));
    return m;
  }, [allOrgs]);
  const ownDioceseSlug = orgByUser[user.id]?.diocese_slug ?? null;

  const thread = activePeer
    ? allMsgs.filter((m) =>
        (m.sender_user_id === user.id && m.recipient_user_id === activePeer) ||
        (m.sender_user_id === activePeer && m.recipient_user_id === user.id),
      )
    : [];

  // Snapshot the last_read_at the moment we open a conversation, so we can render
  // a "New messages" divider before the first message you hadn't seen yet.
  useEffect(() => {
    if (!activePeer) { setOpenSnapshot(null); return; }
    setOpenSnapshot(convStates[activePeer]?.last_read_at ?? new Date(0).toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeer]);

  useEffect(() => {
    if (isFocusOpen()) return;
    const mineLast = thread.length > 0 && thread[thread.length - 1].sender_user_id === user.id;
    const timers: number[] = [];
    if (mineLast) {
      [0, 60, 200, 500].forEach((d) => timers.push(window.setTimeout(() => scrollElToBottom(dmBottomRef.current), d)));
    } else {
      timers.push(window.setTimeout(() => {
        if (dmDividerRef.current) {
          scrollElIntoContainer(dmDividerRef.current, "center");
        } else {
          scrollElToBottom(dmBottomRef.current);
        }
      }, 50));
    }
    return () => { timers.forEach((t) => clearTimeout(t)); };
  }, [thread.length, activePeer, openSnapshot, user.id]);

  useEffect(() => { setReplyTo(null); }, [activePeer]);

  // Mark conversation as read whenever it's opened or new messages arrive while open
  useEffect(() => {
    if (!activePeer) return;
    if (thread.length === 0) return;
    void upsertState(activePeer, { last_read_at: new Date().toISOString() });
  }, [activePeer, thread.length]);

  const markUnread = async (peer: string) => {
    // Set last_read_at to just before the most recent incoming message so it shows as unread
    const incoming = allMsgs.filter((m) => m.sender_user_id === peer && m.recipient_user_id === user.id);
    if (incoming.length === 0) return;
    const latest = incoming[incoming.length - 1].created_at;
    const before = new Date(new Date(latest).getTime() - 1000).toISOString();
    await upsertState(peer, { last_read_at: before });
  };

  const softDelete = async (peer: string) => {
    if (activePeer === peer) setActivePeer(null);
    await upsertState(peer, { deleted_at: new Date().toISOString() });
  };

  const restore = async (peer: string) => {
    await upsertState(peer, { deleted_at: null });
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!text.trim() && pendingFiles.length === 0) || !activePeer) return;
    setSending(true);
    try {
      const attachments = pendingFiles.length ? await uploadChatFiles(user.id, pendingFiles) : [];
      const body = replyTo ? buildQuotedReply(replyTo.name, replyTo.snippet, text) : (text || null);
      const { error } = await supabase.from("direct_messages").insert({
        sender_user_id: user.id, recipient_user_id: activePeer, body, attachments, diocese_slug: primarySlug,
      });
      if (error) { alert(t("dashboard.messages.sendFailed") + " " + error.message); return; }
      setText(""); setPendingFiles([]); setReplyTo(null);
      if (activePeer) {
        const now = new Date().toISOString();
        setOpenSnapshot(now);
        void upsertState(activePeer, { last_read_at: now });
      }
    } finally { setSending(false); }
  };

  return (
    <div className="grid md:grid-cols-[1fr_1.5fr] gap-4 h-[70vh]">
      <div className={`border border-border rounded-md bg-card overflow-hidden flex-col ${activePeer ? "hidden md:flex" : "flex"}`}>
        <div className="p-3 border-b border-border">
          <h3 className="font-display text-lg">{t("dashboard.messages.organizers")}</h3>
          <p className="text-[11px] text-charcoal/50">{t("dashboard.messages.swipeHint")}</p>
        </div>
        <div className="grid grid-cols-4 gap-1 p-2 border-b border-border">
          <button
            type="button"
            onClick={() => setListTab("conversations")}
            className={`relative px-1 py-1.5 text-[11px] rounded flex items-center justify-center gap-1 ${listTab === "conversations" ? "bg-crimson text-ivory shadow-sm" : "bg-muted text-charcoal/70 hover:bg-muted/70"}`}
          >
            {t("dashboard.messages.chats")}
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-ivory text-crimson px-1 min-w-[16px] h-[16px]">
                {totalUnread}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setListTab("groups")}
            className={`relative px-1 py-1.5 text-[11px] rounded flex items-center justify-center gap-1 ${listTab === "groups" ? "bg-crimson text-ivory shadow-sm" : "bg-muted text-charcoal/70 hover:bg-muted/70"}`}
          >
            {t("dashboard.messages.groups")}
            {totalGroupUnread > 0 && (
              <span className="inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-ivory text-crimson px-1 min-w-[16px] h-[16px]">
                {totalGroupUnread}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setListTab("all")}
            className={`px-1 py-1.5 text-[11px] rounded flex items-center justify-center ${listTab === "all" ? "bg-crimson text-ivory shadow-sm" : "bg-muted text-charcoal/70 hover:bg-muted/70"}`}
          >
            {t("dashboard.messages.all")}
          </button>
          <button
            type="button"
            onClick={() => setListTab("trash")}
            className={`px-1 py-1.5 text-[11px] rounded flex items-center justify-center gap-1 ${listTab === "trash" ? "bg-crimson text-ivory shadow-sm" : "bg-muted text-charcoal/70 hover:bg-muted/70"}`}
            title={t("dashboard.messages.recentlyDeleted") as string}
          >
            {t("dashboard.messages.deleted")}{deletedPeers.length > 0 ? ` (${deletedPeers.length})` : ""}
          </button>
        </div>
        <p className="px-3 py-1.5 text-[11px] text-charcoal/50 border-b border-border">{dioceseName}</p>
        <div className="flex-1 overflow-y-auto">
          {listTab === "conversations" ? (
            <>
              {peers.length === 0 && <p className="p-3 text-xs text-charcoal/50">{t("dashboard.messages.noConversations")}</p>}
              {peers.map((id) => (
                <SwipeablePeerRow
                  key={id}
                  active={activePeer === id}
                  unread={unreadFor(id)}
                  org={orgByUser[id]}
                  ownDioceseSlug={ownDioceseSlug}
                  onClick={() => setActivePeer(id)}
                  onMarkUnread={() => markUnread(id)}
                  onDelete={() => softDelete(id)}
                />
              ))}
            </>
          ) : listTab === "groups" ? (
            <>
              <button
                type="button"
                onClick={() => setCreatingGroup(true)}
                className="w-full flex items-center gap-2 px-3 py-2 border-b border-border text-sm text-crimson font-bold hover:bg-muted"
              >
                <Plus className="w-4 h-4" /> {t("dashboard.messages.newGroup")}
              </button>
              {groups.length === 0 && <p className="p-3 text-xs text-charcoal/50">{t("dashboard.messages.noGroups")}</p>}
              {groups.map((g) => {
                const gu = groupUnread[g.id] ?? 0;
                const role = myGroupRoles[g.id] ?? "member";
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => { setActivePeer(null); setActiveGroup(g.id); void markGroupRead(g.id); }}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 border-b border-border text-sm ${
                      activeGroup === g.id ? "bg-crimson/10" : "hover:bg-muted"
                    }`}
                  >
                    <span className="w-7 h-7 rounded-full bg-crimson/15 text-crimson inline-flex items-center justify-center shrink-0">
                      <Users2 className="w-4 h-4" />
                    </span>
                    <span className={`truncate flex-1 ${gu > 0 ? "font-extrabold text-charcoal" : "font-bold"}`}>{g.name}</span>
                    {mutedGroups[g.id] && (
                      <BellOff className="w-3.5 h-3.5 text-charcoal/40 shrink-0" aria-label={t("dashboard.messages.muted") as string} />
                    )}
                    {role !== "member" && (
                      <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-charcoal/60 shrink-0">
                        {t(`dashboard.messages.role_${role}`)}
                      </span>
                    )}
                    {gu > 0 && (
                      <span className="inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-crimson text-ivory px-1.5 min-w-[18px] h-[18px] shrink-0">
                        {gu}
                      </span>
                    )}
                  </button>
                );
              })}

            </>
          ) : listTab === "all" ? (
            <>
              {orgs.length === 0 && <p className="p-3 text-xs text-charcoal/50">{t("dashboard.messages.noOrganizers")}</p>}
              {orgs.map((o) => (
                <PeerRow key={o.user_id} active={activePeer === o.user_id} onClick={() => setActivePeer(o.user_id)} org={o} />
              ))}
            </>
          ) : (
            <>
              {deletedPeers.length === 0 && <p className="p-3 text-xs text-charcoal/50">{t("dashboard.messages.noDeleted")}</p>}
              {deletedPeers.map((id) => (
                <div key={id} className="flex items-center gap-2 px-3 py-2 border-b border-border text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <OrgAvatar logo={orgByUser[id]?.logo_url} name={orgByUser[id]?.org_name} size={28} />
                    <div className="min-w-0">
                      <div className="font-bold truncate">{displayName(orgByUser[id]?.org_name)}</div>
                      <div className="text-[11px] text-charcoal/55 truncate">{t("dashboard.messages.deletedLabel")}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => restore(id)}
                    className="px-2 py-1 text-xs rounded bg-crimson text-ivory hover:opacity-90 shrink-0"
                  >
                    {t("dashboard.messages.restore")}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      <DmThreadProvider
        activePeer={activePeer}
        thread={thread}
        userId={user.id}
        peerName={activePeer ? displayName(orgByUser[activePeer]?.org_name) : ""}
        dioceseSlug={primarySlug}
      >
      {activeGroup ? (
        <GroupChatPane
          key={activeGroup}
          user={user}
          group={groups.find((g) => g.id === activeGroup)}
          orgByUser={orgByUser}
          orgs={orgs}
          onClose={() => setActiveGroup(null)}
          onChanged={() => { loadGroups(); }}
          onRead={() => markGroupRead(activeGroup)}
          muted={!!mutedGroups[activeGroup]}
          onToggleMute={() => toggleGroupMute(activeGroup)}
        />
      ) : (
      <div ref={dmPaneRef} className={`border border-border rounded-md bg-card flex-col h-[70vh] ${activePeer ? "flex" : "hidden md:flex"}`}>
        {activePeer ? (
          <>
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setActivePeer(null)}
                    className="md:hidden px-2 py-1 rounded text-sm text-charcoal/70 hover:bg-muted shrink-0"
                    aria-label={t("dashboard.messages.back") as string}
                  >
                    ←
                  </button>
                  <Link to={`/catholic-calendar/organizers/${activePeer}`} state={{ fromMessages: true, backTo: `/catholic-calendar/dashboard?tab=messages&peer=${activePeer}` }} className="flex items-center gap-2 hover:opacity-80 min-w-0">
                    <OrgAvatar logo={orgByUser[activePeer]?.logo_url} name={orgByUser[activePeer]?.org_name} size={32} />
                    <div className="min-w-0">
                      <h3 className="font-display text-lg leading-tight hover:text-crimson truncate">{displayName(orgByUser[activePeer]?.org_name)}</h3>
                      <VisitingDioceseNote homeSlug={orgByUser[activePeer]?.diocese_slug} postedSlug={ownDioceseSlug} />
                      {orgByUser[activePeer]?.parish && <p className="text-xs text-charcoal/60 truncate">{orgByUser[activePeer].parish}</p>}
                    </div>
                  </Link>
                </div>
                {thread.length > 0 && (
                  <button
                    onClick={async () => {
                      if (!confirm(t("dashboard.messages.confirmSoftDelete"))) return;
                      await softDelete(activePeer);
                      setActivePeer(null);
                    }}
                    className="p-2 rounded text-charcoal/50 hover:text-destructive hover:bg-destructive/5 shrink-0"
                    aria-label={t("dashboard.messages.deleteConvAria") as string}
                    title={t("dashboard.messages.deleteConvAria") as string}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(() => {
                const firstUnreadIdx = openSnapshot
                  ? thread.findIndex((m) => m.sender_user_id !== user.id && m.created_at > openSnapshot)
                  : -1;
                return thread.map((m, i) => {
                  const mine = m.sender_user_id === user.id;
                  const peerName = displayName(orgByUser[activePeer]?.org_name);
                  const replyName = mine ? (t("dashboard.messages.yourself") as string) : peerName;
                  const showDivider = i === firstUnreadIdx;
                  return (
                    <React.Fragment key={m.id}>
                      {showDivider && (
                        <div ref={dmDividerRef} className="flex items-center gap-2 py-1 my-1">
                          <div className="flex-1 h-px bg-crimson/30" />
                          <span className="text-[10px] font-bold uppercase tracking-wide text-crimson/80">{t("dashboard.threads.newMessages")}</span>
                          <div className="flex-1 h-px bg-crimson/30" />
                        </div>
                      )}
                      <SwipeToReply
                        align={mine ? "right" : "left"}
                        onReply={() => setReplyTo({ name: replyName, snippet: m.body || "" })}
                      >
                        <div className={`p-2.5 rounded-md text-sm max-w-[80%] ${
                          mine ? "bg-crimson text-ivory ml-auto" : "bg-muted"
                        }`}>
                          <MessageBody body={m.body} attachments={m.attachments} tone={mine ? "light" : "dark"} />
                          <p className={`text-[10px] mt-1 ${mine ? "text-ivory/70" : "text-charcoal/50"}`}>
                            {format(parseISO(m.created_at), "MMM d · h:mm a")}
                          </p>
                        </div>
                      </SwipeToReply>
                    </React.Fragment>
                  );
                });
              })()}
              {thread.length === 0 && <p className="text-center text-xs text-charcoal/40 py-6">{t("dashboard.messages.noMessages")}</p>}
              <div ref={dmBottomRef} />
            </div>
            <form onSubmit={send} className="p-3 border-t border-border space-y-1 min-w-0 overflow-hidden">
              {replyTo && <ReplyingToBar name={replyTo.name} snippet={replyTo.snippet} onCancel={() => setReplyTo(null)} />}
              <PendingAttachments files={pendingFiles} onRemove={(i) => setPendingFiles((cur) => cur.filter((_, idx) => idx !== i))} />

              <div className="flex gap-2">
                <AttachButton disabled={sending} onFiles={(f) => setPendingFiles((cur) => [...cur, ...f])} />
                <AutoGrowTextarea
                  className={txt + " flex-1"}
                  value={text}
                  onChange={setText}
                  onSubmit={() => send()}
                  placeholder={t("dashboard.messages.typePh") as string}
                />
                <button disabled={sending} className="px-3 rounded bg-crimson text-ivory disabled:opacity-60 self-end"><Send className="w-4 h-4" /></button>
              </div>
            </form>
          </>
        ) : (
          <div className="h-full grid place-items-center text-sm text-charcoal/50 p-6 text-center">
            {t("dashboard.messages.selectOrganizer")}
          </div>
        )}
      </div>
      )}
      </DmThreadProvider>
      {creatingGroup && (
        <CreateGroupModal
          user={user}
          orgs={orgs}
          dioceseSlug={primarySlug}
          onClose={() => setCreatingGroup(false)}
          onCreated={async (id) => {
            setCreatingGroup(false);
            await loadGroups();
            setListTab("groups");
            setActivePeer(null);
            setActiveGroup(id);
          }}
        />
      )}
    </div>
  );
}

/* ------------- Group chats ------------- */
function CreateGroupModal({
  user, orgs, dioceseSlug, onClose, onCreated,
}: { user: User; orgs: any[]; dioceseSlug: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = orgs.filter((o) =>
    displayName(o.org_name).toLowerCase().includes(query.trim().toLowerCase()),
  );

  const submit = async () => {
    if (!name.trim()) { setErr(t("dashboard.messages.nameRequired") as string); return; }
    if (selected.length === 0) { setErr(t("dashboard.messages.membersRequired") as string); return; }
    setSaving(true); setErr(null);
    const { data: group, error } = await supabase
      .from("dm_groups")
      .insert({ name: name.trim(), created_by: user.id, diocese_slug: dioceseSlug || null })
      .select("id")
      .single();
    if (error || !group) {
      setSaving(false);
      setErr(`${t("dashboard.messages.createFailed")} ${error?.message ?? ""}`);
      return;
    }
    const rows = [
      { group_id: group.id, user_id: user.id, role: "owner" as const },
      ...selected.map((uid) => ({ group_id: group.id, user_id: uid, role: "member" as const })),
    ];

    const { error: memErr } = await supabase.from("dm_group_members").insert(rows);
    setSaving(false);
    if (memErr) { setErr(`${t("dashboard.messages.createFailed")} ${memErr.message}`); return; }
    onCreated(group.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-charcoal/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg border border-border w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-display text-lg">{t("dashboard.messages.createTitle")}</h3>
          <button onClick={onClose} className="p-1 text-charcoal/50 hover:text-charcoal" aria-label={t("dashboard.messages.cancel") as string}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <label className="block text-xs font-bold text-charcoal/70">{t("dashboard.messages.groupName")}</label>
          <input
            className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("dashboard.messages.groupNamePh") as string}
          />
          <label className="block text-xs font-bold text-charcoal/70 pt-1">{t("dashboard.messages.selectMembers")}</label>
          <input
            className="w-full px-3 py-2 rounded border border-border bg-background text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dashboard.messages.searchPh") as string}
          />
          <div className="max-h-56 overflow-y-auto border border-border rounded divide-y divide-border">
            {filtered.map((o) => (
              <label key={o.user_id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted">
                <input
                  type="checkbox"
                  checked={selected.includes(o.user_id)}
                  onChange={(e) =>
                    setSelected((cur) => e.target.checked ? [...cur, o.user_id] : cur.filter((id) => id !== o.user_id))
                  }
                />
                <OrgAvatar logo={o.logo_url} name={o.org_name} size={22} />
                <span className="truncate">{displayName(o.org_name)}</span>
              </label>
            ))}
            {filtered.length === 0 && <p className="p-3 text-xs text-charcoal/50">{t("dashboard.messages.noOrganizers")}</p>}
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded border border-border">{t("dashboard.messages.cancel")}</button>
          <button onClick={submit} disabled={saving} className="px-3 py-2 text-sm rounded bg-crimson text-ivory font-bold disabled:opacity-60">
            {t("dashboard.messages.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupChatPane({
  user, group, orgByUser, orgs, onClose, onChanged, onRead, muted, onToggleMute,
}: { user: User; group: any; orgByUser: Record<string, any>; orgs: any[]; onClose: () => void; onChanged: () => void; onRead?: () => void; muted?: boolean; onToggleMute?: () => void }) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [panel, setPanel] = useState<"none" | "members" | "activity">("none");
  const [activity, setActivity] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadMembers = async () => {
    const { data } = await supabase
      .from("dm_group_members")
      .select("user_id,joined_at,role")
      .eq("group_id", group?.id);
    setMembers(data ?? []);
  };
  const loadMsgs = async () => {
    const { data } = await supabase
      .from("dm_group_messages")
      .select("*")
      .eq("group_id", group?.id)
      .order("created_at");
    setMsgs(data ?? []);
  };
  const loadActivity = async () => {
    const { data } = await supabase
      .from("dm_group_activity")
      .select("*")
      .eq("group_id", group?.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setActivity(data ?? []);
  };

  useEffect(() => {
    if (!group?.id) return;
    loadMembers();
    loadMsgs();
    onRead?.();
    const ch = supabase
      .channel(`dm-group-${group.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_group_messages", filter: `group_id=eq.${group.id}` },
        (p) => {
          setMsgs((c) => c.some((m) => m.id === (p.new as any).id) ? c : [...c, p.new]);
          onRead?.();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  useEffect(() => { if (panel === "activity") loadActivity(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [panel, group?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (sending || (!text.trim() && pendingFiles.length === 0)) return;
    setSending(true);
    let attachments: any[] = [];
    try {
      if (pendingFiles.length) attachments = await uploadChatFiles(user.id, pendingFiles);
    } catch (err: any) {
      setSending(false);
      alert(t("dashboard.messages.sendFailed") + " " + (err?.message ?? ""));
      return;
    }
    const { error } = await supabase.from("dm_group_messages").insert({
      group_id: group.id, sender_user_id: user.id, body: text.trim() || null, attachments,
    });
    setSending(false);
    if (error) { alert(t("dashboard.messages.sendFailed") + " " + error.message); return; }
    setText(""); setPendingFiles([]);
    loadMsgs();
  };

  const myRole: string = members.find((m) => m.user_id === user.id)?.role
    ?? (group?.created_by === user.id ? "owner" : "member");
  const isOwner = myRole === "owner" || group?.created_by === user.id;
  const isManager = isOwner || myRole === "admin";

  const leave = async () => {
    if (!confirm(t("dashboard.messages.confirmLeave"))) return;
    const { error } = await supabase.from("dm_group_members").delete().eq("group_id", group.id).eq("user_id", user.id);
    if (error) { alert(error.message); return; }
    onClose(); onChanged();
  };
  const removeGroup = async () => {
    if (!confirm(t("dashboard.messages.confirmDeleteGroup"))) return;
    const { error } = await supabase.from("dm_groups").delete().eq("id", group.id);
    if (error) { alert(error.message); return; }
    onClose(); onChanged();
  };
  const addMember = async (uid: string) => {
    const { error } = await supabase.from("dm_group_members").insert({ group_id: group.id, user_id: uid, role: "member" });
    if (error) { alert(error.message); return; }
    setAdding(false);
    loadMembers();
    if (panel === "activity") loadActivity();
  };
  const changeRole = async (uid: string, role: string) => {
    const { error } = await supabase.from("dm_group_members").update({ role: role as any }).eq("group_id", group.id).eq("user_id", uid);
    if (error) { alert(error.message); return; }
    loadMembers();
    if (panel === "activity") loadActivity();
  };
  const removeMember = async (uid: string) => {
    if (!confirm(t("dashboard.messages.confirmRemoveMember"))) return;
    const { error } = await supabase.from("dm_group_members").delete().eq("group_id", group.id).eq("user_id", uid);
    if (error) { alert(error.message); return; }
    loadMembers();
    if (panel === "activity") loadActivity();
  };

  if (!group) return null;
  const memberIds = members.map((m) => m.user_id);
  const addable = orgs.filter((o) => !memberIds.includes(o.user_id));
  const nameOf = (id?: string | null) =>
    !id ? t("dashboard.messages.someone") : id === user.id ? t("dashboard.messages.yourself") : displayName(orgByUser[id]?.org_name);

  const activityText = (a: any) => {
    const actor = nameOf(a.actor_user_id);
    const target = nameOf(a.target_user_id);
    switch (a.action) {
      case "group_created": return t("dashboard.messages.actCreated", { actor });
      case "group_renamed": return t("dashboard.messages.actRenamed", { actor, to: a.detail?.to ?? "" });
      case "group_deleted": return t("dashboard.messages.actDeleted", { actor });
      case "joined": return t("dashboard.messages.actJoined", { actor });
      case "left": return t("dashboard.messages.actLeft", { actor });
      case "member_added": return t("dashboard.messages.actAdded", { actor, target });
      case "member_removed": return t("dashboard.messages.actRemoved", { actor, target });
      case "role_changed": return t("dashboard.messages.actRoleChanged", {
        actor, target,
        role: t(`dashboard.messages.role_${a.detail?.to ?? "member"}`),
      });
      default: return a.action;
    }
  };

  return (
    <div className="border border-border rounded-md bg-card flex flex-col h-[70vh]">
      <div className="p-3 border-b border-border flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={onClose} className="md:hidden px-2 py-1 rounded text-sm text-charcoal/70 hover:bg-muted shrink-0">←</button>
          <span className="w-8 h-8 rounded-full bg-crimson/15 text-crimson inline-flex items-center justify-center shrink-0">
            <Users2 className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg leading-tight truncate">{group.name}</h3>
            <p className="text-xs text-charcoal/60 truncate">
              {t("dashboard.messages.members", { count: members.length })} · {t(`dashboard.messages.role_${myRole}`)}
              {muted ? ` · ${t("dashboard.messages.muted")}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className={`p-2 rounded border border-border hover:bg-muted ${muted ? "text-charcoal/40" : "text-charcoal/70"}`}
              title={(muted ? t("dashboard.messages.unmuteGroup") : t("dashboard.messages.muteGroup")) as string}
              aria-label={(muted ? t("dashboard.messages.unmuteGroup") : t("dashboard.messages.muteGroup")) as string}
            >
              {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPanel((p) => (p === "members" ? "none" : "members"))}
            className={`px-2 py-1 text-xs rounded border border-border hover:bg-muted ${panel === "members" ? "bg-muted" : ""}`}
          >
            {t("dashboard.messages.membersTab")}
          </button>
          <button
            type="button"
            onClick={() => setPanel((p) => (p === "activity" ? "none" : "activity"))}
            className={`px-2 py-1 text-xs rounded border border-border hover:bg-muted ${panel === "activity" ? "bg-muted" : ""}`}
          >
            {t("dashboard.messages.activity")}
          </button>
          {isManager && (
            <button type="button" onClick={() => { setAdding((v) => !v); setPanel("none"); }} className="p-2 rounded text-charcoal/60 hover:text-crimson hover:bg-muted" title={t("dashboard.messages.addMembers") as string}>
              <Plus className="w-4 h-4" />
            </button>
          )}
          {isOwner ? (
            <button type="button" onClick={removeGroup} className="p-2 rounded text-charcoal/50 hover:text-destructive hover:bg-destructive/5" title={t("dashboard.messages.deleteGroup") as string}>
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={leave} className="px-2 py-1 text-xs rounded border border-border hover:bg-muted">
              {t("dashboard.messages.leave")}
            </button>
          )}
        </div>
      </div>

      {adding && isManager && (
        <div className="border-b border-border max-h-40 overflow-y-auto">
          {addable.map((o) => (
            <button key={o.user_id} type="button" onClick={() => addMember(o.user_id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
              <OrgAvatar logo={o.logo_url} name={o.org_name} size={22} />
              <span className="truncate">{displayName(o.org_name)}</span>
            </button>
          ))}
          {addable.length === 0 && <p className="p-3 text-xs text-charcoal/50">{t("dashboard.messages.noOrganizers")}</p>}
        </div>
      )}

      {panel === "members" && (
        <div className="border-b border-border max-h-56 overflow-y-auto divide-y divide-border">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <OrgAvatar logo={orgByUser[m.user_id]?.logo_url} name={orgByUser[m.user_id]?.org_name} size={22} />
              <span className="truncate flex-1">{nameOf(m.user_id)}</span>
              {isOwner && m.user_id !== user.id ? (
                <>
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.user_id, e.target.value)}
                    className="text-xs rounded border border-border bg-background px-1.5 py-1"
                  >
                    <option value="member">{t("dashboard.messages.role_member")}</option>
                    <option value="admin">{t("dashboard.messages.role_admin")}</option>
                    <option value="owner">{t("dashboard.messages.role_owner")}</option>
                  </select>
                  <button type="button" onClick={() => removeMember(m.user_id)} className="p-1 rounded text-charcoal/50 hover:text-destructive" title={t("dashboard.messages.removeMember") as string}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-muted text-charcoal/60">
                  {t(`dashboard.messages.role_${m.role ?? "member"}`)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {panel === "activity" && (
        <div className="border-b border-border max-h-56 overflow-y-auto divide-y divide-border">
          {activity.length === 0 && <p className="p-3 text-xs text-charcoal/50">{t("dashboard.messages.noActivity")}</p>}
          {activity.map((a) => (
            <div key={a.id} className="px-3 py-2 text-xs">
              <p className="text-charcoal/80">{activityText(a)}</p>
              <p className="text-[10px] text-charcoal/45">{format(parseISO(a.created_at), "MMM d, yyyy · h:mm a")}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.map((m) => {
          const mine = m.sender_user_id === user.id;
          return (
            <div key={m.id} className={`p-2.5 rounded-md text-sm max-w-[80%] ${mine ? "bg-crimson text-ivory ml-auto" : "bg-muted"}`}>
              {!mine && (
                <p className="text-[11px] font-bold text-charcoal/70 mb-0.5">{displayName(orgByUser[m.sender_user_id]?.org_name)}</p>
              )}
              <MessageBody body={m.body} attachments={m.attachments} tone={mine ? "light" : "dark"} />
              <p className={`text-[10px] mt-1 ${mine ? "text-ivory/70" : "text-charcoal/50"}`}>
                {format(parseISO(m.created_at), "MMM d · h:mm a")}
              </p>
            </div>
          );
        })}
        {msgs.length === 0 && <p className="text-center text-xs text-charcoal/40 py-6">{t("dashboard.messages.noMessages")}</p>}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="p-3 border-t border-border space-y-1 min-w-0 overflow-hidden">
        <PendingAttachments files={pendingFiles} onRemove={(i) => setPendingFiles((cur) => cur.filter((_, idx) => idx !== i))} />
        <div className="flex gap-2">
          <AttachButton disabled={sending} onFiles={(f) => setPendingFiles((cur) => [...cur, ...f])} />
          <AutoGrowTextarea
            className={txt + " flex-1"}
            value={text}
            onChange={setText}
            onSubmit={() => send()}
            placeholder={t("dashboard.messages.typePh") as string}
          />
          <button disabled={sending} className="px-3 rounded bg-crimson text-ivory disabled:opacity-60 self-end"><Send className="w-4 h-4" /></button>
        </div>
      </form>
    </div>
  );
}


function PeerRow({ active, onClick, org }: { active: boolean; onClick: () => void; org?: any }) {
  const { primarySlug } = useDiocese();
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 border-b border-border text-sm hover:bg-muted transition-colors ${
        active ? "bg-crimson/10" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <OrgAvatar logo={org?.logo_url} name={org?.org_name} size={28} />
        <div className="min-w-0">
          <div className="font-bold truncate">{displayName(org?.org_name)}</div>
          <VisitingDioceseNote homeSlug={org?.diocese_slug} postedSlug={primarySlug} />
          {org?.parish && <div className="text-[11px] text-charcoal/55 truncate">{org.parish}</div>}
        </div>
      </div>
    </button>
  );
}

function SwipeablePeerRow({
  active, unread, org, ownDioceseSlug, onClick, onMarkUnread, onDelete,
}: {
  active: boolean;
  unread: number;
  org?: any;
  ownDioceseSlug?: string | null;
  onClick: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);
  const THRESHOLD = 80;

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    moved.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    const d = e.clientX - startX.current;
    if (Math.abs(d) > 5) moved.current = true;
    setDx(Math.max(-140, Math.min(140, d)));
  };
  const onPointerUp = () => {
    const d = dx;
    setDx(0);
    startX.current = null;
    if (d >= THRESHOLD) { onMarkUnread(); return; }
    if (d <= -THRESHOLD) { onDelete(); return; }
    if (!moved.current) onClick();
  };

  return (
    <div className="relative border-b border-border overflow-hidden select-none">
      {/* Background hints */}
      <div className="absolute inset-0 flex items-center justify-between px-3 text-[11px] font-bold uppercase tracking-wide pointer-events-none">
        <span className={`text-emerald-700 transition-opacity ${dx > 10 ? "opacity-100" : "opacity-0"}`}>{t("dashboard.messages.swipeUnread")}</span>
        <span className={`text-destructive transition-opacity ${dx < -10 ? "opacity-100" : "opacity-0"}`}>{t("dashboard.messages.swipeDelete")}</span>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform 180ms ease" : "none", touchAction: "pan-y" }}
        className={`w-full text-left px-3 py-2.5 text-sm bg-card cursor-pointer ${active ? "bg-crimson/10" : ""}`}
      >
        <div className="flex items-center gap-2">
          <OrgAvatar logo={org?.logo_url} name={org?.org_name} size={28} />
          <div className="min-w-0 flex-1">
            <div className={`truncate ${unread > 0 ? "font-extrabold text-charcoal" : "font-bold"}`}>{displayName(org?.org_name)}</div>
            <VisitingDioceseNote homeSlug={org?.diocese_slug} postedSlug={ownDioceseSlug} />
            {org?.parish && <div className="text-[11px] text-charcoal/55 truncate">{org.parish}</div>}
          </div>
          {unread > 0 && (
            <span className="inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-crimson text-ivory px-1.5 min-w-[18px] h-[18px] shrink-0">
              {unread}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function OrgAvatar({ logo, name, size = 20 }: { logo?: string | null; name?: string | null; size?: number }) {
  const initial = (name || "O").trim().charAt(0).toUpperCase();
  const style = { width: size, height: size, minWidth: size };
  if (logo) {
    return (
      <img
        src={logo}
        alt={name || "Organizer"}
        style={style}
        className="rounded-full object-cover border border-border bg-white"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <span
      style={{ ...style, fontSize: Math.max(9, Math.floor(size * 0.5)) }}
      className="rounded-full bg-crimson/15 text-crimson font-bold grid place-items-center"
      aria-hidden
    >
      {initial}
    </span>
  );
}

/* ------------- Profile ------------- */
function Profile({ user }: { user: User }) {
  const { t } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    // Contact fields are protected — fetch via SECURITY DEFINER RPC that only
    // returns the caller's own profile.
    const { data } = await (supabase as any).rpc("get_my_organizer_profile");
    const row = Array.isArray(data) ? data[0] : data;
    setProfile(row || {
      user_id: user.id, org_name: "", parish: "", description: "",
      categories: [], contact_email: user.email, contact_phone: "", website_url: "", logo_url: "",
    });
  };

  useEffect(() => { load(); }, [user.id]);

  if (!profile) return <p className="text-charcoal/50">{t("dashboard.profile.loading")}</p>;

  const set = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }));
  const toggleCat = (c: string) =>
    set("categories", (profile.categories ?? []).includes(c)
      ? profile.categories.filter((x: string) => x !== c)
      : [...(profile.categories ?? []), c]);

  const save = async () => {
    setSaving(true); setSaved(false); setError(null);
    const payload = {
      user_id: user.id,
      org_name: profile.org_name || null,
      parish: profile.parish || null,
      description: profile.description || null,
      categories: profile.categories ?? [],
      categories_other: (profile.categories ?? []).includes("other")
        ? (profile.categories_other || null)
        : null,
      contact_email: profile.contact_email || null,
      contact_phone: profile.contact_phone || null,
      representative_name: profile.representative_name || null,
      address: profile.address || null,
      diocese_slug: (profile.diocese_slugs?.[0] ?? profile.diocese_slug) || null,
      diocese_slugs: profile.diocese_slugs ?? (profile.diocese_slug ? [profile.diocese_slug] : []),
      website_url: profile.website_url || null,
      logo_url: profile.logo_url || null,
    };

    const { error: upErr } = await (supabase as any).rpc("upsert_my_organizer_profile", {
      _patch: payload,
    });
    if (upErr) {
      console.error("Profile save failed", upErr);
      setError(upErr.message);
      setSaving(false);
      return;
    }
    await load();
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl space-y-3">
      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="font-display text-xl">{t("dashboard.profile.title")}</span>
          <span className="text-charcoal/50 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-4 border-t border-border px-4 py-4">
      <p className="text-sm text-charcoal/60">{t("dashboard.profile.yourStatus")} <StatusPill status={profile.status ?? "pending"} /></p>

      <div className="grid sm:grid-cols-2 gap-4">

        <Lab label={t("dashboard.profile.orgName")}><input className={txt} value={profile.org_name ?? ""} onChange={(e) => set("org_name", e.target.value)} /></Lab>
        <Lab label={t("dashboard.profile.parish")}><input className={txt} value={profile.parish ?? ""} onChange={(e) => set("parish", e.target.value)} /></Lab>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Lab label={t("dashboard.profile.representative")}><input className={txt} value={profile.representative_name ?? ""} onChange={(e) => set("representative_name", e.target.value)} /></Lab>
        <Lab label={t("dashboard.profile.address")}><input className={txt} value={profile.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Lab>
      </div>
      <Lab label={t("dashboard.profile.diocese")}>
        <DioceseMultiSelect
          value={profile.diocese_slugs ?? (profile.diocese_slug ? [profile.diocese_slug] : [])}
          onChange={(slugs) => set("diocese_slugs", slugs)}
          placeholder={t("auth.diocese") as string}
        />
        <p className="mt-1 text-[11px] text-charcoal/55">{t("auth.dioceseHintMulti")}</p>
      </Lab>
      <Lab label={t("dashboard.profile.description")}><textarea rows={3} className={txt} value={profile.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Lab>


      <Lab label={t("dashboard.profile.focus")}>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const active = (profile.categories ?? []).includes(c.value);
            return (
              <button key={c.value} type="button" onClick={() => toggleCat(c.value)}
                className={`px-2.5 py-1 rounded-full text-xs border ${active ? "bg-crimson text-ivory border-crimson" : "bg-card border-border text-charcoal/70"}`}>
                {categoryLabel(c.value)}
              </button>
            );
          })}
        </div>
      </Lab>

      {(profile.categories ?? []).includes("other") && (
        <Lab label={t("dashboard.profile.focusOther")}>
          <input
            className={txt}
            placeholder={t("dashboard.profile.focusOtherPh") as string}
            value={profile.categories_other ?? ""}
            onChange={(e) => set("categories_other", e.target.value)}
          />
        </Lab>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Lab label={t("dashboard.profile.contactEmail")}><input className={txt} value={profile.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} /></Lab>
        <Lab label={t("dashboard.profile.contactPhone")}><input className={txt} value={profile.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} /></Lab>
      </div>
      <Lab label={t("dashboard.profile.website")}><input className={txt} placeholder="https://" value={profile.website_url ?? ""} onChange={(e) => set("website_url", e.target.value)} /></Lab>
      <Lab label={t("dashboard.profile.logoUrl")}><input className={txt} placeholder="https://…/logo.png" value={profile.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} /></Lab>
      <div>
        <span className="block text-xs font-bold uppercase tracking-wide text-charcoal/60 mb-1">{t("dashboard.profile.orUpload")}</span>
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !user) return;
            if (file.size > 5 * 1024 * 1024) { alert(t("dashboard.profile.logoSizeErr")); return; }
            const ext = file.name.split(".").pop()?.toLowerCase() || "png";
            const path = `${user.id}/logo-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from("sponsor-logos").upload(path, file, { upsert: true, contentType: file.type });
            if (upErr) { alert(t("dashboard.profile.uploadFailed") + " " + upErr.message); return; }
            const { data } = supabase.storage.from("sponsor-logos").getPublicUrl(path);
            set("logo_url", data.publicUrl);
          }}
          className="block text-sm"
        />
      </div>

      <button onClick={save} disabled={saving}
        className="px-5 py-2.5 rounded-md bg-crimson text-ivory font-bold hover:bg-crimson-deep disabled:opacity-50">
        {saving ? t("dashboard.profile.saving") : t("dashboard.profile.save")}
      </button>
      {saved && <span className="ml-3 text-sm text-emerald-700">{t("dashboard.profile.saved")}</span>}
      {error && <p className="mt-2 text-sm text-crimson">{t("dashboard.profile.saveFailed")} {error}</p>}

      {profile.logo_url && (
        <div className="mt-4">
          <span className="block text-xs font-bold uppercase tracking-wide text-charcoal/60 mb-1">{t("dashboard.profile.logoPreview")}</span>
          <img
            src={profile.logo_url}
            alt="Organizer logo"
            className="h-24 w-24 object-contain rounded-md border border-border bg-card"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
        </div>
      )}
        </div>
      </details>

      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="font-display text-xl">{t("notify.title")}</span>
          <span className="text-charcoal/50 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-border px-4 py-4">
          <NotificationSettings userId={user.id} hideTitle />
        </div>
      </details>
    </div>

  );
}

function Lab({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wide text-charcoal/60 mb-1">{label}</span>
      {children}
    </label>
  );
}

const txt =
  "w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-crimson/40";