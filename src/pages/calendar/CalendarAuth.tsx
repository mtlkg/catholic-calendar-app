import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import CalendarLayout from "./CalendarLayout";
import DioceseMultiSelect from "@/components/DioceseMultiSelect";
import { currentTranslationTarget } from "@/lib/translation";

export default function CalendarAuth() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(() =>
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [parish, setParish] = useState("");
  const [repName, setRepName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [dioceseSlugs, setDioceseSlugs] = useState<string[]>([]);
  const dioceseSlug = dioceseSlugs[0] ?? null;
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "signup" || m === "signin") setMode(m);
  }, [searchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!agreedTerms) {
          throw new Error(t("auth.mustAgree"));
        }
        if (!dioceseSlug) {
          throw new Error(t("auth.mustPickDiocese"));
        }
        const submissionLocale = currentTranslationTarget(i18n.language);
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/catholic-calendar/dashboard`,
            data: {
              org_name: name || null,
              parish: parish || null,
              contact_phone: phone || null,
              representative_name: repName || null,
              address: address || null,
              diocese_slug: dioceseSlug,
              preferred_language: submissionLocale,
            },
          },
        });
        if (err) throw err;
        if (data.user) {
          await supabase
            .from("organizer_profiles")
            .update({
              org_name: name || null,
              parish: parish || null,
              contact_email: email,
              contact_phone: phone || null,
              representative_name: repName || null,
              address: address || null,
              diocese_slug: dioceseSlug,
              diocese_slugs: dioceseSlugs,
            })
            .eq("user_id", data.user.id);

          try {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "admin-organizer-applied",
                idempotencyKey: `organizer-apply-${data.user.id}`,
                templateData: {
                  organizerUserId: data.user.id,
                  locale: submissionLocale,
                },
              },
            });
          } catch (e) {
            console.warn("Admin notification email failed", e);
          }
          try {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "organizer-application-received",
                idempotencyKey: `organizer-apply-ack-${data.user.id}`,
                templateData: {
                  organizerUserId: data.user.id,
                },
              },
            });
          } catch (e) {
            console.warn("Applicant confirmation email failed", e);
          }

        }
        if (data.session) {
          navigate("/catholic-calendar/dashboard");
        } else {
          setMsg(t("auth.checkEmail"));
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate("/catholic-calendar/dashboard");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CalendarLayout>
      <div className="max-w-md mx-auto px-5 py-12">
        <h1 className="font-display text-3xl text-center mb-2">
          {mode === "signup" ? t("auth.titleSignup") : t("auth.titleSignin")}
        </h1>
        <p className="text-center text-sm text-charcoal/60 mb-6">
          {mode === "signup" ? t("auth.subSignup") : t("auth.subSignin")}
        </p>

        <form onSubmit={submit} className="space-y-3 bg-card border border-border rounded-lg p-6">
          {mode === "signup" && (
            <>
              <input className={cls} required placeholder={t("auth.repName") as string}
                value={repName} onChange={(e) => setRepName(e.target.value)} />
              <p className="text-[11px] text-charcoal/55 -mt-1 px-1">{t("auth.repNameHint")}</p>
              <input className={cls} required placeholder={t("auth.orgName") as string}
                value={name} onChange={(e) => setName(e.target.value)} />
              <p className="text-[11px] text-charcoal/55 -mt-1 px-1">{t("auth.orgNameHint")}</p>
              <input className={cls} placeholder={t("auth.parish") as string}
                value={parish} onChange={(e) => setParish(e.target.value)} />
              <input className={cls} required type="tel" placeholder={t("auth.phone") as string}
                value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className={cls} placeholder={t("auth.address") as string}
                value={address} onChange={(e) => setAddress(e.target.value)} />
              <DioceseMultiSelect
                value={dioceseSlugs}
                onChange={setDioceseSlugs}
                placeholder={t("auth.diocese") as string}
              />
              <p className="text-[11px] text-charcoal/55 -mt-1 px-1">{t("auth.dioceseHintMulti")}</p>
            </>
          )}
          <input className={cls} required type="email" placeholder={t("auth.email") as string}
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={cls} required type="password" placeholder={t("auth.password") as string} minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)} />

          {mode === "signup" && (
            <label className="flex items-start gap-2 text-xs text-charcoal/80 cursor-pointer rounded-md border border-gold/40 bg-gold/5 p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
              />
              <span>{t("auth.terms")}</span>
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}

          <button
            disabled={loading || (mode === "signup" && !agreedTerms)}
            className="w-full py-2.5 rounded-md bg-crimson text-ivory font-bold hover:bg-crimson-deep disabled:opacity-50"
          >
            {loading ? "…" : mode === "signup" ? t("auth.create") : t("auth.signIn")}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="w-full text-xs text-charcoal/60 hover:text-charcoal pt-2"
          >
          {mode === "signup" ? t("auth.toSignin") : t("auth.toSignup")}
          </button>
        </form>

        {mode === "signup" && (
          <p className="text-xs text-charcoal/50 text-center mt-4">{t("auth.reviewNote")}</p>
        )}
        {mode === "signup" && (
          <p className="text-xs text-charcoal/60 text-center mt-2 italic">{t("auth.detailsNote")}</p>
        )}
      </div>
    </CalendarLayout>
  );
}

const cls =
  "w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-crimson/40";
