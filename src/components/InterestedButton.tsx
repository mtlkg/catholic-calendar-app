import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, X, Check } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { enablePush, needsHomeScreenInstall, pushPermission, pushSupported } from "@/lib/push";

export default function InterestedButton({
  eventId,
  eventTitle,
  className = "",
}: {
  eventId: string;
  eventTitle: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-crimson/50 text-crimson text-[11px] font-bold hover:bg-crimson hover:text-ivory transition-colors " +
          className
        }
        aria-label={t("event.imInterested", { title: eventTitle }) as string}
      >
        <Heart className="w-3 h-3" /> {t("interested.button")}
      </button>
      {open && (
        <InterestedModal
          eventId={eventId}
          eventTitle={eventTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function InterestedModal({
  eventId,
  eventTitle,
  onClose,
}: {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [pushOptIn, setPushOptIn] = useState(pushPermission() !== "denied");
  const [pushError, setPushError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const supportsPush = pushSupported();

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
    let endpoint: string | null = null;
    if (pushOptIn && supportsPush) {
      try {
        endpoint = await enablePush(i18n.language?.slice(0, 2) || "en");
        if (!endpoint) setPushError(t("notify.pushDenied"));
      } catch {
        setPushError(t("notify.pushDenied"));
      }
    }
    const { data: session } = await supabase.auth.getSession();
    const { error: err } = await (supabase as any)
      .from("event_interests")
      .insert({
        event_id: eventId,
        email: trimmed,
        user_id: session.session?.user?.id ?? null,
        push_endpoint: endpoint,
        locale: i18n.language?.slice(0, 2) || "en",
      });

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
            templateData: { eventId, interestedEmail: trimmed },
          },
        });
      } catch {
        /* non-blocking */
      }
    })();
    setDone(true);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-ivory border border-gold/40 shadow-2xl p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
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
                i18nKey="event.reminderSuccess24"
                values={{ email, title: eventTitle }}
                components={{ strong: <strong />, em: <em /> }}
              />
            </p>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
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
                i18nKey="event.reminderBody24"
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
            {supportsPush ? (
              <label className="flex items-start gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pushOptIn}
                  onChange={(e) => setPushOptIn(e.target.checked)}
                  className="mt-0.5 accent-crimson"
                />
                <span className="text-xs text-charcoal/75">{t("notify.pushRemindOptIn")}</span>
              </label>
            ) : (
              needsHomeScreenInstall() && (
                <p className="text-[11px] text-charcoal/50 mb-2">{t("notify.pushInstallHint")}</p>
              )
            )}
            {pushError && <p className="text-[11px] text-charcoal/60 mb-2">{pushError}</p>}

            {error && <p className="text-xs text-destructive mb-3">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-5 py-2.5 rounded-md bg-crimson text-ivory font-bold hover:bg-crimson-deep disabled:opacity-50 text-sm"
            >
              {submitting ? t("common.submitting") : t("event.remindMe24")}
            </button>
            <p className="text-[11px] text-charcoal/50 mt-2 text-center">{t("event.emailPrivacy")}</p>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
