import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellRing, X, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { enablePush, needsHomeScreenInstall, pushPermission, pushSupported } from "@/lib/push";

/**
 * "Follow organizer" button + modal. Collects an email so the visitor gets an
 * automatic notification every time the organizer publishes a new approved
 * event. Also notifies the organizer that they got a new follower.
 */
export default function FollowButton({
  organizerUserId,
  organizerName,
  className = "",
  variant = "default",
}: {
  organizerUserId: string;
  organizerName: string;
  className?: string;
  variant?: "default" | "compact";
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);

  // Detect if current signed-in user already follows this organizer.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email ?? null;
      const uid = data.session?.user?.id ?? null;
      if (!mounted) return;
      setViewerEmail(email);
      if (!uid) {
        setFollowing(false);
        return;
      }
      const { data: row } = await (supabase as any)
        .from("organizer_follows")
        .select("id")
        .eq("organizer_user_id", organizerUserId)
        .eq("follower_user_id", uid)
        .maybeSingle();
      if (mounted) setFollowing(!!row);
    })();
    return () => {
      mounted = false;
    };
  }, [organizerUserId]);

  const handleUnfollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return;
    await (supabase as any)
      .from("organizer_follows")
      .delete()
      .eq("organizer_user_id", organizerUserId)
      .eq("follower_user_id", uid);
    setFollowing(false);
  };

  const compact = variant === "compact";
  const base =
    "inline-flex items-center gap-1.5 rounded-md border font-bold transition-colors " +
    (compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs");

  return (
    <>
      {following ? (
        <button
          type="button"
          onClick={handleUnfollow}
          className={`${base} border-crimson/40 bg-crimson/10 text-crimson hover:bg-crimson hover:text-ivory ${className}`}
          aria-label={t("follow.unfollow")}
          title={t("follow.unfollow") as string}
        >
          <BellRing className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} /> {t("follow.following")}
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className={`${base} border-crimson/50 text-crimson hover:bg-crimson hover:text-ivory ${className}`}
          aria-label={t("follow.button")}
        >
          <Bell className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} /> {t("follow.button")}
        </button>
      )}
      {open && (
        <FollowModal
          organizerUserId={organizerUserId}
          organizerName={organizerName}
          initialEmail={viewerEmail || ""}
          onClose={() => setOpen(false)}
          onDone={() => setFollowing(true)}
        />
      )}
    </>
  );
}

function FollowModal({
  organizerUserId,
  organizerName,
  initialEmail,
  onClose,
  onDone,
}: {
  organizerUserId: string;
  organizerName: string;
  initialEmail: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState(initialEmail);
  const [pushOptIn, setPushOptIn] = useState(pushPermission() !== "denied");
  const [pushError, setPushError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const supportsPush = pushSupported();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("follow.invalidEmail"));
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
    const { data: sess } = await supabase.auth.getSession();
    const { error: err } = await (supabase as any)
      .from("organizer_follows")
      .insert({
        organizer_user_id: organizerUserId,
        follower_email: trimmed,
        follower_user_id: sess.session?.user?.id ?? null,
        push_endpoint: endpoint,
        locale: i18n.language?.slice(0, 2) || "en",
      });

    setSubmitting(false);
    if (err && !/duplicate|unique/i.test(err.message)) {
      setError(err.message);
      return;
    }
    // Fire-and-forget: notify the organizer they got a new follower.
    (async () => {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "organizer-new-follower",
            idempotencyKey: `follow-${organizerUserId}-${trimmed}`,
            templateData: { organizerUserId, followerEmail: trimmed },
          },
        });
      } catch {
        /* non-blocking */
      }
    })();
    setDone(true);
    onDone();
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
            <h3 className="font-display text-2xl text-charcoal mb-2">
              {t("follow.success", { name: organizerName })}
            </h3>
            <p className="text-sm text-charcoal/70">
              {t("follow.successBody", { name: organizerName, email })}
            </p>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              className="mt-5 px-5 py-2 rounded-md bg-crimson text-ivory font-bold hover:bg-crimson-deep text-sm"
            >
              {t("common.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-5 h-5 text-crimson" />
              <h3 className="font-display text-2xl text-charcoal">
                {t("follow.modalTitle", { name: organizerName })}
              </h3>
            </div>
            <p className="text-sm text-charcoal/70 mb-4">
              {t("follow.modalIntro", { name: organizerName })}
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
                <span className="text-xs text-charcoal/75">{t("notify.pushFollowOptIn")}</span>
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
              {submitting ? t("common.submitting") : t("follow.cta")}
            </button>
            <p className="text-[11px] text-charcoal/50 mt-2 text-center">{t("follow.note")}</p>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
