import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BellRing, Check, Info, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import {
  currentPushEndpoint,
  disablePush,
  enablePush,
  needsHomeScreenInstall,
  pushSupported,
} from "@/lib/push";

type Prefs = {
  user_id: string;
  locale: string;
  email_follow_new_event: boolean;
  push_follow_new_event: boolean;
  email_event_reminder: boolean;
  push_event_reminder: boolean;
  email_dm: boolean;
  push_dm: boolean;
  email_thread_reply: boolean;
  push_thread_reply: boolean;
  email_dm_frequency: string;
  email_thread_reply_frequency: string;
};

const DEFAULTS: Omit<Prefs, "user_id"> = {
  locale: "en",
  email_follow_new_event: true,
  push_follow_new_event: true,
  email_event_reminder: true,
  push_event_reminder: true,
  email_dm: true,
  push_dm: true,
  email_thread_reply: true,
  push_thread_reply: true,
  email_dm_frequency: "hourly",
  email_thread_reply_frequency: "hourly",
};

const ROWS = [
  { key: "follow_new_event", label: "notify.typeFollowNewEvent", tip: "notify.tipFollowNewEvent" },
  { key: "event_reminder", label: "notify.typeEventReminder", tip: "notify.tipEventReminder" },
  { key: "dm", label: "notify.typeDm", tip: "notify.tipDm" },
  { key: "thread_reply", label: "notify.typeThreadReply", tip: "notify.tipThreadReply" },
] as const;

const FREQ_ROWS = [
  { field: "email_dm_frequency", label: "notify.freqDm" },
  { field: "email_thread_reply_frequency", label: "notify.freqThreadReply" },
] as const;

const FREQ_OPTIONS = [
  { value: "instant", label: "notify.freqInstant" },
  { value: "hourly", label: "notify.freqHourly" },
  { value: "daily", label: "notify.freqDaily" },
  { value: "off", label: "notify.freqOff" },
] as const;

/** Small info icon that explains a setting in plain language. */
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          aria-label={text}
          className="inline-flex align-middle text-charcoal/40 hover:text-crimson"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** Per-user email/push notification preferences with per-device push toggle. */
export default function NotificationSettings({ userId, hideTitle = false }: { userId: string; hideTitle?: boolean }) {
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [deviceOn, setDeviceOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supported = pushSupported();

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("notification_prefs")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setPrefs(data ?? { user_id: userId, ...DEFAULTS });
      setDeviceOn(!!(await currentPushEndpoint()));
    })();
  }, [userId]);

  const persist = async (patch: Partial<Prefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setError(null);
    const { error: err } = await (supabase as any)
      .from("notification_prefs")
      .upsert(
        { ...next, user_id: userId, locale: i18n.language?.slice(0, 2) || "en" },
        { onConflict: "user_id" },
      );
    if (err) setError(err.message);
    else {
      setMsg(t("notify.saved"));
      setTimeout(() => setMsg(null), 2000);
    }
  };

  const toggleDevice = async () => {
    setBusy(true);
    setError(null);
    try {
      if (deviceOn) {
        await disablePush();
        setDeviceOn(false);
      } else {
        const endpoint = await enablePush(i18n.language?.slice(0, 2) || "en");
        if (!endpoint) setError(t("notify.pushDenied"));
        setDeviceOn(!!endpoint);
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  if (!prefs) return null;

  return (
    <div className={hideTitle ? "" : "rounded-xl border border-gold/40 bg-ivory p-5"}>
      {!hideTitle && (
        <div className="flex items-center gap-2 mb-1">
          <BellRing className="w-4 h-4 text-crimson" />
          <h3 className="font-display text-xl text-charcoal">{t("notify.title")}</h3>
        </div>
      )}

      <p className="text-xs text-charcoal/60 mb-4">{t("notify.intro")}</p>

      {/* This device */}
      <div className="mb-5 rounded-lg border border-border bg-card p-3">
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-charcoal/60 mb-2">
          {t("notify.deviceLabel")} <InfoTip text={t("notify.tipDevice")} />
        </label>
        {supported ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleDevice}
              disabled={busy}
              className="px-3 py-2 rounded-md bg-crimson text-ivory text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />}
              {deviceOn ? t("notify.disableDevice") : t("notify.enableDevice")}
            </button>
            {deviceOn && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-crimson">
                <Check className="w-3.5 h-3.5" /> {t("notify.deviceOn")}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-charcoal/60">
            {needsHomeScreenInstall() ? t("notify.pushInstallHint") : t("notify.pushUnsupported")}
          </p>
        )}
        <p className="text-[11px] text-charcoal/50 mt-2">{t("notify.pushConsent")}</p>
      </div>

      {/* Channel matrix */}
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-[11px] font-bold uppercase tracking-wide text-charcoal/50 pb-1 border-b border-border">
          <span />
          <span className="w-14 text-center inline-flex items-center justify-center gap-1">
            {t("notify.channelEmail")} <InfoTip text={t("notify.tipChannelEmail")} />
          </span>
          <span className="w-14 text-center inline-flex items-center justify-center gap-1">
            {t("notify.channelPush")} <InfoTip text={t("notify.tipChannelPush")} />
          </span>
        </div>
        {ROWS.map((row) => {
          const emailKey = `email_${row.key}` as keyof Prefs;
          const pushKey = `push_${row.key}` as keyof Prefs;
          return (
            <div key={row.key} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-1">
              <span className="text-sm text-charcoal/80 flex items-center gap-1.5">
                {t(row.label)} <InfoTip text={t(row.tip)} />
              </span>
              <span className="w-14 text-center">
                <input
                  type="checkbox"
                  className="accent-crimson"
                  checked={!!prefs[emailKey]}
                  onChange={(e) => persist({ [emailKey]: e.target.checked } as Partial<Prefs>)}
                />
              </span>
              <span className="w-14 text-center">
                <input
                  type="checkbox"
                  className="accent-crimson"
                  disabled={!supported}
                  checked={!!prefs[pushKey]}
                  onChange={(e) => persist({ [pushKey]: e.target.checked } as Partial<Prefs>)}
                />
              </span>
            </div>
          );
        })}
      </div>
      {supported && !deviceOn && (
        <p className="text-[11px] text-charcoal/50 mt-3">{t("notify.enableDeviceFirst")}</p>
      )}

      {/* Email frequency for conversations */}
      <div className="mt-5 rounded-lg border border-border bg-card p-3">
        <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-charcoal/60 mb-1">
          {t("notify.emailFrequency")} <InfoTip text={t("notify.tipEmailFrequency")} />
        </label>
        <p className="text-[11px] text-charcoal/50 mb-3">{t("notify.freqHint")}</p>
        <div className="space-y-2">
          {FREQ_ROWS.map((row) => (
            <div key={row.field} className="flex items-center justify-between gap-3">
              <span className="text-sm text-charcoal/80">{t(row.label)}</span>
              <select
                className="rounded-md border border-border bg-ivory px-2 py-1 text-xs text-charcoal"
                value={String(prefs[row.field] ?? "hourly")}
                onChange={(e) => persist({ [row.field]: e.target.value } as Partial<Prefs>)}
              >
                {FREQ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(o.label)}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {msg && <p className="text-xs text-crimson mt-3">{msg}</p>}
      {error && <p className="text-xs text-destructive mt-3">{error}</p>}
    </div>
  );
}
