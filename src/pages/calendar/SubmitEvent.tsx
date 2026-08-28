import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";
import { format } from "@/lib/dateLocale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import CalendarLayout, { CATEGORIES, useCategoryLabel } from "./CalendarLayout";
import type { User } from "@supabase/supabase-js";
import { geocodeAddress } from "@/lib/geocode";
import { uploadEventPoster } from "@/lib/posterUrl";
import { Users, ImagePlus, X, MapPin, Repeat, ChevronDown, Check, Video, Link2, Upload, Loader2 } from "lucide-react";
import { uploadEventVideo, isSupportedVideoLink, MAX_VIDEO_MB } from "@/lib/eventVideo";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { currentTranslationTarget } from "@/lib/translation";
import { EVENT_LANGUAGES } from "@/data/eventLanguages";
import DioceseSelect from "@/components/DioceseSelect";
import DioceseMultiSelect from "@/components/DioceseMultiSelect";
import LocationMapDialog from "@/components/LocationMapDialog";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";

import { useDiocese, useDioceseName, dioceseBySlug } from "@/context/DioceseContext";
import { cityGroupFor, dioceseRegionCode, regionalDioceseSlugs, DIOCESES, UNLOCKED_CITY } from "@/data/dioceses";
import { zoneForSlug, localInputToUtcISO, formatInZone, zoneAbbrev } from "@/lib/timezone";
import { generateRecurrenceOccurrences, type RecurrenceFrequency } from "@/lib/recurrence";
import { isBroadcastEvent, broadcastBadgeKey, broadcastBadgeClasses, broadcastPriority } from "@/lib/eventAudience";

// Unverified organizers get this many free submissions before paying per event.
const FREE_SUBMISSION_CAP = 2;
const SINGLE_SUBMISSION_PRICE_ID = "event_submission_single";

export default function SubmitEvent() {
  const { t, i18n } = useTranslation();
  const categoryLabel = useCategoryLabel();
  const { diocese, primarySlug } = useDiocese();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submittedEvent, setSubmittedEvent] = useState<{ id: string; start_at: string; end_at: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [videoMode, setVideoMode] = useState<"link" | "upload">("link");
  const [videoLink, setVideoLink] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [addrCoords, setAddrCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!langOpen) return;
    const onDown = (e: PointerEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLangOpen(false); };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [organizerDioceseSlug, setOrganizerDioceseSlug] = useState<string | null>(null);
  const [organizerCreatedAt, setOrganizerCreatedAt] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [freeUsed, setFreeUsed] = useState<number>(0);
  const [paidRemaining, setPaidRemaining] = useState<number>(0);
  const [freeResetsAt, setFreeResetsAt] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [agreedTerms, setAgreedTerms] = useState<boolean>(false);
  const [buyingSingle, setBuyingSingle] = useState<boolean>(false);
  const [continueAsGuest, setContinueAsGuest] = useState<boolean>(false);
  const [showFreeVerifiedPrompt, setShowFreeVerifiedPrompt] = useState<boolean>(false);
  const [sameDayEvents, setSameDayEvents] = useState<
    Array<{ id: string; title: string; start_at: string; end_at: string | null; venue_name: string | null; address: string | null; latitude: number | null; longitude: number | null; parish: string | null; category: string; guest_name: string | null; diocese_slug: string | null; audience_scope: string | null; audience_diocese_slugs: string[] | null; audience_countries: string[] | null }>
  >([]);
  const [mapPreview, setMapPreview] = useState<
    { title: string; label: string; lat: number | null; lng: number | null } | null
  >(null);
  const [recur, setRecur] = useState<{
    enabled: boolean;
    freq: RecurrenceFrequency;
    interval: number;
    count: number;
  }>({ enabled: false, freq: "weekly", interval: 1, count: 8 });
  const recurCount = Math.min(52, Math.max(1, Math.round(recur.count || 1)));
  // Where the event is published: its own diocese only, a hand-picked set of
  // dioceses, or nationwide (a "special event" every diocese is invited to).
  const [audienceMode, setAudienceMode] = useState<"diocese" | "multi" | "regional" | "national">("diocese");
  const [extraDioceses, setExtraDioceses] = useState<string[]>([]);
  const [countries, setCountries] = useState<Array<"CA" | "US">>(["CA"]);



  const [form, setForm] = useState({
    title: "",
    category: "mass",
    description: "",
    start_at: "",
    end_at: "",
    all_day: false,
    venue_name: "",
    address: "",
    parish: "",
    registration_url: "",
    is_free: true,
    price_note: "",
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    is_featured: false,
    category_other: "",
    event_languages: ["en"],
    diocese_slug: "" as string,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Pre-fill name/email AND load profile status + free-submission counter + subscription status.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profRows } = await (supabase as any).rpc("get_my_organizer_profile");
      const prof = Array.isArray(profRows) ? profRows[0] : profRows;
      setForm((f) => ({
        ...f,
        guest_name: f.guest_name || (prof as any)?.org_name || "",
        guest_email: f.guest_email || (prof as any)?.contact_email || user.email || "",
        guest_phone: f.guest_phone || (prof as any)?.contact_phone || "",
      }));
      setProfileStatus((prof as any)?.status ?? null);
      setOrganizerDioceseSlug((prof as any)?.diocese_slug ?? null);
      setOrganizerCreatedAt((prof as any)?.created_at ?? null);
      const { data: quota } = await (supabase as any).rpc("my_free_submission_status");
      setFreeUsed(Number((quota as any)?.used ?? (prof as any)?.free_submissions_used ?? 0));
      setFreeResetsAt(((quota as any)?.resets_at as string | null) ?? null);
      setPaidRemaining((prof as any)?.paid_submissions_remaining ?? 0);
      const { data: paying } = await (supabase as any).rpc("is_paying_verified", { _user_id: user.id });
      setIsPaying(!!paying);
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const emailIsAdmin = (user.email || "").toLowerCase() === "globalcatholiccalendar@gmail.com";
      setIsAdmin(emailIsAdmin || !!roles?.some((role: any) => role.role === "admin"));
      setProfileLoaded(true);
    })();
  }, [user]);

  // Look up other approved events happening the same day, in the SAME diocese,
  // using that diocese's local time zone for the day boundaries.
  useEffect(() => {
    if (!form.start_at || !form.diocese_slug) { setSameDayEvents([]); return; }
    // Show conflicts across every jurisdiction in the same city, not just the
    // selected diocese (e.g. all Montréal eparchies + the Latin archdiocese).
    const selected = dioceseBySlug(form.diocese_slug);
    const group = selected ? cityGroupFor(selected) : null;
    const conflictSlugs = group?.members ?? [form.diocese_slug];
    const tz = zoneForSlug(form.diocese_slug);
    const day = form.start_at.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { setSameDayEvents([]); return; }
    const dayStart = localInputToUtcISO(`${day}T00:00`, tz);
    const dayEnd = localInputToUtcISO(`${day}T23:59`, tz);
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("calendar_events_public")
        .select("id,title,start_at,end_at,venue_name,address,latitude,longitude,parish,category,diocese_slug,audience_scope,audience_diocese_slugs,audience_countries")
        .in("diocese_slug", conflictSlugs)
        // Include any event that overlaps the selected day:
        // it starts on/before end-of-day AND (has no end and starts within day, OR ends on/after start-of-day).
        .lte("start_at", dayEnd)
        .or(`end_at.gte.${dayStart},and(end_at.is.null,start_at.gte.${dayStart})`)
        .order("start_at", { ascending: true });
      if (!cancelled) setSameDayEvents((data ?? []) as any);
    })();
    return () => { cancelled = true; };
  }, [form.start_at, form.diocese_slug]);


  // Default the diocese picker to the one currently being viewed.
  useEffect(() => {
    setForm((f) => (f.diocese_slug ? f : { ...f, diocese_slug: primarySlug }));
  }, [primarySlug]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const hostDiocese = dioceseBySlug(form.diocese_slug);
  const regionCode = dioceseRegionCode(hostDiocese);
  const regionalSlugs = regionalDioceseSlugs(hostDiocese).filter((slug) => slug !== form.diocese_slug);
  const recurrencePreview = useMemo(
    () => generateRecurrenceOccurrences(form.start_at, form.end_at, recur.freq, recurCount),
    [form.start_at, form.end_at, recur.freq, recurCount],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title || !form.start_at) {
      setError(t("submit.titleErr"));
      return;
    }
    if (!form.guest_name || !form.guest_email) {
      setError(t("submit.contactErr"));
      return;
    }
    // Unverified submitters must leave a reachable phone number for moderation.
    if (!isVerified && (form.guest_phone.replace(/\D/g, "").length < 8)) {
      setError(t("submit.phoneErr"));
      return;
    }
    if (!form.diocese_slug) {
      setError(t("submit.dioceseErr"));
      return;
    }
    if (!agreedTerms) {
      setError(t("submit.termsErr"));
      return;
    }
    setSubmitting(true);
    // Times are entered as wall-clock time in the event's own diocese.
    const eventZone = zoneForSlug(form.diocese_slug);
    // Best-effort geocode so the event can show up in the radius filter.
    let lat: number | null = addrCoords?.lat ?? null;
    let lng: number | null = addrCoords?.lng ?? null;
    const geoQuery = [form.venue_name, form.address].filter(Boolean).join(", ");
    if (lat == null && geoQuery) {
      const pt = await geocodeAddress(geoQuery);
      if (pt) { lat = pt.lat; lng = pt.lng; }

    }
    // Upload poster if provided.
    let posterPath: string | null = null;
    if (posterFile) {
      try {
        posterPath = await uploadEventPoster(posterFile, user?.id ?? null);
      } catch (uploadErr: any) {
        setSubmitting(false);
        setError(uploadErr?.message ?? t("submit.posterUpload"));
        return;
      }
    }
    // Promo video: verified organizers may paste a link or upload a clip.
    let videoValue: string | null = null;
    if (isVerified) {
      if (videoMode === "link" && videoLink.trim()) {
        if (!isSupportedVideoLink(videoLink)) {
          setSubmitting(false);
          setError(t("submit.videoInvalid"));
          return;
        }
        videoValue = videoLink.trim();
      } else if (videoMode === "upload" && videoFile && user) {
        try {
          setVideoUploading(true);
          videoValue = await uploadEventVideo(videoFile, user.id);
        } catch (uploadErr: any) {
          setVideoUploading(false);
          setSubmitting(false);
          setError(uploadErr?.message ?? t("submit.videoUploadFailed"));
          return;
        }
        setVideoUploading(false);
      }
    }
    const eventId = crypto.randomUUID();
    const payload = {
      id: eventId,
      title: form.title,
      category: form.category as
        | "mass" | "adoration" | "bible_study" | "retreat" | "conference"
        | "young_adults" | "youth_group" | "social" | "service" | "fundraiser" | "other",
      category_other: form.category === "other" ? (form.category_other || null) : null,
      description: form.description || null,
      start_at: localInputToUtcISO(form.start_at, eventZone),
      end_at: form.end_at ? localInputToUtcISO(form.end_at, eventZone) : null,
      all_day: form.all_day,
      venue_name: form.venue_name || null,
      address: form.address || null,
      latitude: lat,
      longitude: lng,
      parish: form.parish || null,
      event_languages: form.event_languages.length ? form.event_languages : null,
      diocese_slug: form.diocese_slug,
      // Verified organizers can broadcast beyond their own diocese.
      audience_scope: isVerified ? audienceMode : "diocese",
      audience_diocese_slugs:
        isVerified && (audienceMode === "multi" || audienceMode === "regional")
          ? Array.from(new Set(
              (audienceMode === "regional" ? regionalSlugs : extraDioceses)
                .filter((s) => s !== form.diocese_slug),
            ))
          : [],
      audience_countries:
        isVerified && audienceMode === "national" ? (countries.length ? countries : ["CA"]) : [],
      registration_url: form.registration_url || null,
      is_free: form.is_free,
      price_note: form.price_note || null,
      // Always store the contact name/email captured on the form so moderators
      // can reach the person who submitted, even for verified organizers.
      guest_name: form.guest_name,
      guest_email: form.guest_email,
      guest_phone: form.guest_phone || null,
      submitted_by_user_id: user?.id ?? null,
      is_featured: form.is_featured,
      poster_url: posterPath,
      video_url: videoValue,
      // Tie every occurrence of a recurring series together so the dashboard can group them.
      recurrence_group_id: recur.enabled && recurCount > 1 ? crypto.randomUUID() : null,
      status: "pending" as const,
    } as any;
    const result = user
      ? await supabase
          .from("calendar_events")
          .insert(payload)
          .select("id, start_at, end_at")
          .single()
      : await supabase
          .from("calendar_events")
          .insert(payload);
    // Recurring series: insert the remaining occurrences with the same details,
    // shifted by the chosen frequency/interval.
    if (!result.error && recur.enabled && recurCount > 1) {
      const extras: any[] = [];
      for (const occurrence of recurrencePreview.slice(1)) {
        extras.push({
          ...payload,
          id: crypto.randomUUID(),
          start_at: localInputToUtcISO(occurrence.start, eventZone),
          end_at: occurrence.end ? localInputToUtcISO(occurrence.end, eventZone) : null,
        });
      }
      const { error: recurErr } = await supabase.from("calendar_events").insert(extras);
      if (recurErr) console.error("Recurring occurrences insert failed", recurErr);
    }
    const inserted = user ? result.data : { id: eventId, start_at: payload.start_at, end_at: payload.end_at };

    const err = result.error;
    setSubmitting(false);
    if (err) {
      if (/guest_submission_limit_reached/.test(err.message)) {
        setError(t("submit.guestLimitReached"));
      } else if (/free_submission_limit_reached/.test(err.message)) {
        setError(t("submit.freeLimitReached"));
      } else {
        setError(err.message);
      }
      return;
    }
    if (inserted) {
      setSubmittedEvent({ id: inserted.id, start_at: inserted.start_at, end_at: inserted.end_at });
    }
    // Optimistic local counter updates so the banner refreshes without a refetch.
    if (user && profileStatus !== "approved" && !isPaying) {
      if (paidRemaining > 0) {
        setPaidRemaining((n) => Math.max(0, n - 1));
      } else {
        setFreeUsed((n) => n + 1);
      }
    }
    const submitterEmail = form.guest_email || user?.email || "";
    const submitterName = form.guest_name || user?.email || "Organizer";
    const submissionLocale = currentTranslationTarget(i18n.language);
    const prettyStart = `${formatInZone(payload.start_at, "EEEE, MMMM d, yyyy · h:mm a", eventZone)} ${zoneAbbrev(payload.start_at, eventZone)}`;
    const venueStr = [payload.venue_name, payload.address].filter(Boolean).join(" — ");
    const stamp = Date.now();

    // Notify admin (non-blocking).
    try {
      const { error: adminErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "admin-event-submitted",
          recipientEmail: "globalcatholiccalendar@gmail.com",
          idempotencyKey: `event-submit-admin-${eventId}`,
          templateData: {
            eventId,
            title: payload.title,
            category: payload.category,
            startAt: prettyStart,
            venue: venueStr,
            description: payload.description ?? "",
            submittedBy: submitterName,
            submitterEmail,
            isFeatured: payload.is_featured,
            isVerified: profileStatus === "approved" || isPaying,
            adminUrl: `${window.location.origin}/catholic-calendar/admin`,
          },
        },
      });
      if (adminErr) console.error("Admin notification email error", adminErr);
    } catch (e) {
      console.error("Admin notification email failed", e);
    }

    // Confirmation to the submitter (non-blocking).
    if (submitterEmail) {
      try {
        const { error: subErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "event-submission-received",
            recipientEmail: submitterEmail,
            idempotencyKey: `event-submit-confirm-${eventId}`,
            templateData: {
              eventId,
              submitterName,
              title: payload.title,
              startAt: prettyStart,
              venue: venueStr,
              calendarUrl: `${window.location.origin}/catholic-calendar`,
              locale: submissionLocale,
            },
          },
        });
        if (subErr) console.error("Submitter confirmation email error", subErr);
      } catch (e) {
        console.error("Submitter confirmation email failed", e);
      }
    }
    // Guests: skip the thank-you screen and go straight back to the calendar
    // with a toast confirming their submission is under review.
    if (!user) {
      toast({
        title: t("submit.toastTitle"),
        description: t("submit.toastBody"),
      });
      navigate("/catholic-calendar");
      return;
    }
    setDone(true);
  };



  const organizerCity = DIOCESES.find((d) => d.slug === organizerDioceseSlug)?.city;
  const freeUntil = organizerCreatedAt
    ? new Date(new Date(organizerCreatedAt).setFullYear(new Date(organizerCreatedAt).getFullYear() + 1))
    : null;
  const hasMontrealFreeYear = organizerCity === UNLOCKED_CITY && !!freeUntil && freeUntil > new Date();
  const isVerified = isAdmin || isPaying || (profileStatus === "approved" && hasMontrealFreeYear);
  // The guest prompt follows the currently viewed diocese.
  const isMontreal = diocese.city === UNLOCKED_CITY;
  const freeLeft = Math.max(0, FREE_SUBMISSION_CAP - freeUsed);
  // Unverified organizers get 2 free submissions, then must buy $5 credits.
  const capped = !!user && !isVerified && freeLeft === 0 && paidRemaining === 0;

  // Payments disabled: skip the optional Boost/Featured-slot upsell after submitting.
  // Setting `done = true` in submit() takes the user straight to the thank-you screen.

  const nameOf = useDioceseName();
  const submittedDiocese = dioceseBySlug(form.diocese_slug);
  const submittedDioceseName = submittedDiocese ? nameOf(submittedDiocese) : "";

  if (done) {
    return (
      <CalendarLayout>
        <div className="max-w-xl mx-auto py-20 px-5 text-center">
          <h2 className="font-display text-3xl text-crimson mb-3">{t("submit.thankYou")}</h2>
          <p className="text-charcoal/70 mb-4">
            {isVerified
              ? t("submit.thankYouVerified", { diocese: submittedDioceseName })
              : t("submit.thankYouUnverified")}
          </p>
          <p className="text-charcoal/70 text-sm mb-6">
            <span dangerouslySetInnerHTML={{ __html: t("submit.confirmationSent") }} />{" "}
            <a href="mailto:globalcatholiccalendar@gmail.com" className="text-crimson underline">
              globalcatholiccalendar@gmail.com
            </a>.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/catholic-calendar"
              className="px-5 py-2.5 rounded-md bg-crimson text-ivory font-body font-bold hover:bg-crimson-deep transition-colors text-sm"
            >
              {t("submit.backCalendar")}
            </Link>
            <button
              onClick={() => {
                setDone(false);
                setForm((f) => ({ ...f, title: "", description: "", start_at: "", end_at: "" }));
                setAgreedTerms(false);
              }}
              className="px-5 py-2.5 rounded-md border border-border text-charcoal hover:bg-muted text-sm font-bold"
            >
              {t("submit.submitAnother")}
            </button>
          </div>
        </div>
      </CalendarLayout>
    );
  }

  if (user && !profileLoaded) {
    return <CalendarLayout><div className="py-20 text-center text-charcoal/50">{t("dashboard.loading")}</div></CalendarLayout>;
  }

  if (user && !isVerified) {
    return (
      <CalendarLayout>
        <div className="max-w-xl mx-auto py-16 px-5 text-center">
          <h1 className="font-display text-3xl text-charcoal mb-3">
            {profileStatus === "approved" ? t("verifiedPayment.title") : t("dashboard.awaitingTitle")}
          </h1>
          <p className="text-charcoal/70 mb-6">
            {profileStatus === "approved" ? t("verifiedPayment.body") : t("submit.verificationRequired")}
          </p>
          <Link
            to={profileStatus === "approved" ? "/catholic-calendar/subscribe" : "/catholic-calendar/dashboard"}
            className="inline-block px-5 py-2.5 rounded-md bg-crimson text-ivory font-bold hover:bg-crimson-deep"
          >
            {profileStatus === "approved" ? t("verifiedPayment.cta") : t("submit.goToDashboard")}
          </Link>
        </div>
      </CalendarLayout>
    );
  }

  // Guest chooser: signed-out visitors pick a path before seeing the form.
  if (!user && !continueAsGuest) {
    return (
      <CalendarLayout>
        <div className="max-w-xl mx-auto py-12 px-5">
          <h1 className="font-display text-3xl md:text-4xl text-charcoal mb-2 text-center">{t("submit.guestTitle")}</h1>
          <p className="text-charcoal/70 text-center mb-8">{t("submit.guestIntro")}</p>

          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <Link
              to="/catholic-calendar/auth"
              className="block w-full px-4 py-3 rounded-md bg-crimson text-ivory text-center font-bold hover:bg-crimson-deep"
            >
              {t("submit.guestSignIn")}
            </Link>
            <button
              type="button"
              onClick={() => {
                // Montréal organizers can be verified for free — nudge them
                // before they post as an unverified guest.
                if (isMontreal) setShowFreeVerifiedPrompt(true);
                else setContinueAsGuest(true);
              }}
              className="block w-full px-4 py-3 rounded-md border-2 border-crimson/40 bg-crimson/5 text-charcoal text-center font-bold hover:bg-crimson/10"
            >
              {t("submit.guestContinue")}
            </button>
            <Link
              to="/catholic-calendar/accounts"
              className="block w-full px-4 py-3 rounded-md border border-border text-charcoal text-center font-bold hover:bg-muted"
            >
              {t("submit.guestCompare")}
            </Link>
          </div>

          <p className="text-xs text-charcoal/55 text-center mt-4">{t("submit.guestNote")}</p>
          <p className="text-xs text-charcoal/55 text-center mt-1">
            {t("submit.guestQuotaNote", { cap: FREE_SUBMISSION_CAP })}
          </p>

          {showFreeVerifiedPrompt && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/60 backdrop-blur-sm px-4"
              onClick={() => setShowFreeVerifiedPrompt(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-gold/40 bg-ivory shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-crimson to-crimson-deep px-5 py-4 flex items-start justify-between gap-3">
                  <h2 className="font-display text-xl text-ivory">{t("submit.freeVerifiedTitle")}</h2>
                  <button
                    type="button"
                    onClick={() => setShowFreeVerifiedPrompt(false)}
                    aria-label={t("common.close") as string}
                    className="text-ivory/80 hover:text-ivory"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-sm text-charcoal/80 font-body">{t("submit.freeVerifiedBody")}</p>
                  <p className="text-xs text-charcoal/60 font-body">
                    {t("submit.guestQuotaNote", { cap: FREE_SUBMISSION_CAP })}
                  </p>
                  <div className="space-y-2">
                    <Link
                      to="/catholic-calendar/auth?mode=signup"
                      className="block w-full px-4 py-3 rounded-md bg-crimson text-ivory text-center font-bold hover:bg-crimson-deep"
                    >
                      {t("submit.freeVerifiedCta")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFreeVerifiedPrompt(false);
                        setContinueAsGuest(true);
                      }}
                      className="block w-full px-4 py-3 rounded-md border border-border text-charcoal text-center font-bold hover:bg-muted"
                    >
                      {t("submit.freeVerifiedDecline")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CalendarLayout>
    );
  }

  return (
    <CalendarLayout>
      <div className="max-w-2xl mx-auto py-10 px-5">
        <h1 className="font-display text-3xl md:text-4xl text-charcoal mb-2">{t("submit.mainTitle")}</h1>
        <p className="text-charcoal/70 mb-6">
          {isVerified
            ? t("submit.introVerified")
            : user
              ? t("submit.introUser")
              : t("submit.introGuest")}
        </p>

        {!isVerified && (
          <div className="mb-6 p-4 rounded-md border border-gold/40 bg-gold/5 text-sm text-charcoal/80">
            <p className="font-bold text-charcoal mb-1">{t("submit.favourTitle")}</p>
            <p>{t("submit.favourBody")}</p>
          </div>
        )}

        {!!user && !isVerified && (
          <div className="mb-6 rounded-md border border-crimson/30 bg-crimson/5 p-4 text-sm">
            <p className="font-bold text-charcoal mb-1">{t("submit.quotaTitle")}</p>
            <p className="text-charcoal/75">
              {paidRemaining > 0
                ? t("submit.quotaPaid", { count: paidRemaining })
                : capped
                  ? t("submit.quotaNone")
                  : t("submit.quotaFree", { count: freeLeft, cap: FREE_SUBMISSION_CAP })}
            </p>
            {capped && freeResetsAt && (
              <p className="mt-1 text-charcoal/60 text-[12.5px]">
                {t("submit.quotaResets", { date: format(parseISO(freeResetsAt), "PP") })}
              </p>
            )}
            {capped && !buyingSingle && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBuyingSingle(true)}
                  className="px-4 py-2 rounded-md bg-crimson text-ivory text-xs font-bold hover:bg-crimson-deep"
                >
                  {t("submit.buySingle")}
                </button>
                <Link
                  to="/catholic-calendar/accounts"
                  className="px-4 py-2 rounded-md border border-border text-xs font-bold"
                >
                  {t("submit.compareAccounts")}
                </Link>
              </div>
            )}
            {capped && buyingSingle && user && (
              <div className="mt-4">
                <StripeEmbeddedCheckout
                  priceId={SINGLE_SUBMISSION_PRICE_ID}
                  customerEmail={user.email ?? undefined}
                  userId={user.id}
                  returnUrl={`${window.location.origin}/catholic-calendar/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
                  metadata={{ kind: "event_submission_single" }}
                />
                <button
                  type="button"
                  onClick={() => setBuyingSingle(false)}
                  className="mt-3 text-xs underline text-charcoal/60"
                >
                  {t("submit.cancelPurchase")}
                </button>
              </div>
            )}
          </div>
        )}


        <form onSubmit={submit} className="space-y-4">
          <Field label={t("submit.fTitle")}>
            <input className={inputCls} required value={form.title} onChange={(e) => set("title", e.target.value)} />
          </Field>

          <Field label={t("submit.fCategory")}>
            <select className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{categoryLabel(c.value)}</option>)}
            </select>
          </Field>

          {form.category === "other" && (
            <Field label={t("submit.fOther")}>
              <input
                className={inputCls}
                placeholder={t("submit.fOtherPh") as string}
                value={form.category_other}
                onChange={(e) => set("category_other", e.target.value)}
              />
            </Field>
          )}

          {!isVerified && (
            <Field label={t("submit.fParish")}>
              <input className={inputCls} value={form.parish} onChange={(e) => set("parish", e.target.value)} />
            </Field>
          )}

          <Field label={t("submit.fLanguage")}>
            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => setLangOpen((o) => !o)}
                className={`w-full flex items-center justify-between rounded-md border bg-card px-3 py-2.5 text-left text-sm transition-colors ${
                  langOpen ? "border-crimson ring-1 ring-crimson/20" : "border-border hover:border-crimson/40"
                }`}
              >
                <span className="truncate">
                  {form.event_languages.length
                    ? form.event_languages
                        .map((v) => EVENT_LANGUAGES.find((l) => l.value === v)?.label ?? v)
                        .join(", ")
                    : t("submit.fLanguagePlaceholder")}
                </span>
                <ChevronDown className={`w-4 h-4 shrink-0 text-charcoal/60 transition-transform ${langOpen ? "rotate-180" : ""}`} />
              </button>

              {langOpen && (
                <>
                  <div className="absolute z-40 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-60 overflow-auto">
                    {EVENT_LANGUAGES.map((l) => {
                      const checked = form.event_languages.includes(l.value);
                      return (
                        <label
                          key={l.value}
                          className={`flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                            checked ? "bg-crimson/10 text-crimson" : "hover:bg-muted"
                          }`}
                        >
                          <div
                            className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 transition-colors ${
                              checked ? "bg-crimson border-crimson" : "border-charcoal/30 bg-card"
                            }`}
                          >
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.event_languages, l.value]
                                : form.event_languages.filter((v) => v !== l.value);
                              set("event_languages", next.length ? next : ["en"]);
                            }}
                          />
                          <span className="leading-tight">{l.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-charcoal/60">{t("submit.fLanguageHint")}</p>
          </Field>

          <Field label={t("submit.fDiocese")}>
            <DioceseSelect value={form.diocese_slug || null} onChange={(slug) => set("diocese_slug", slug)} />
            <p className="mt-1 text-xs text-charcoal/60">{t("submit.fDioceseHint")}</p>
          </Field>

          {isVerified && (
            <Field label={t("submit.audience.label")}>
              <div className="space-y-2 rounded-md border border-border bg-card p-3">
                {(["diocese", "multi", "regional", "national"] as const).map((mode) => (
                  <label key={mode} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="audience"
                      className="mt-1"
                      checked={audienceMode === mode}
                      onChange={() => setAudienceMode(mode)}
                    />
                    <span>
                      <span className="font-bold text-charcoal">
                        {mode === "regional"
                          ? t(hostDiocese?.country === "US" ? "submit.audience.state" : "submit.audience.province")
                          : t(`submit.audience.${mode}`)}
                      </span>
                      <span className="block text-xs text-charcoal/60">
                        {mode === "regional"
                          ? t(hostDiocese?.country === "US" ? "submit.audience.stateHint" : "submit.audience.provinceHint", { region: regionCode ?? "" })
                          : t(`submit.audience.${mode}Hint`)}
                      </span>
                    </span>
                  </label>
                ))}

                {audienceMode === "multi" && (
                  <div className="pt-1">
                    <DioceseMultiSelect
                      value={extraDioceses}
                      onChange={setExtraDioceses}
                      placeholder={t("submit.audience.pickDioceses") as string}
                    />
                  </div>
                )}

                {audienceMode === "regional" && (
                  <p className="pt-1 text-xs font-bold text-gold">
                    {t("submit.audience.regionalCount", { count: regionalSlugs.length + 1, region: regionCode ?? "" })}
                  </p>
                )}

                {audienceMode === "national" && (
                  <div className="pt-1 flex flex-wrap gap-2">
                    {(["CA", "US"] as const).map((c) => {
                      const on = countries.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setCountries((prev) =>
                              prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-xs border ${
                            on
                              ? "bg-crimson text-ivory border-crimson font-bold"
                              : "bg-background text-charcoal/70 border-border"
                          }`}
                        >
                          {c === "CA" ? t("diocese.canada") : t("diocese.unitedStates")}
                        </button>
                      );
                    })}
                    <p className="w-full text-xs text-charcoal/60">{t("submit.audience.nationalNote")}</p>
                  </div>
                )}
              </div>
            </Field>
          )}


          <Field label={t("submit.fDescription")}>
            <textarea
              rows={4}
              className={inputCls}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("submit.fStarts")}>
              <input type="datetime-local" required className={inputCls}
                value={form.start_at} onChange={(e) => set("start_at", e.target.value)} />
            </Field>
            <Field label={t("submit.fEnds")}>
              <input type="datetime-local" className={inputCls}
                value={form.end_at} onChange={(e) => set("end_at", e.target.value)} />
            </Field>
          </div>
          {form.diocese_slug && (
            <p className="-mt-2 text-xs text-charcoal/60">
              {t("submit.timeZoneHint", {
                zone: zoneAbbrev(form.start_at ? new Date(form.start_at) : new Date(), zoneForSlug(form.diocese_slug)),
                diocese: submittedDioceseName,
              })}
            </p>
          )}

          {isVerified && (
            <div className="p-3 rounded-md border border-gold/40 bg-gold/5">
              <label className="flex items-start gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={recur.enabled}
                  onChange={(e) => setRecur((r) => ({ ...r, enabled: e.target.checked }))}
                />
                <span>
                  <span className="flex items-center gap-1.5 font-bold text-charcoal">
                    <Repeat className="w-4 h-4 text-crimson" />
                    {t("submit.recurTitle")}
                  </span>
                  <span className="block text-xs text-charcoal/60 mt-0.5">{t("submit.recurBody")}</span>
                </span>
              </label>

              {recur.enabled && (
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <Field label={t("submit.recurFreq")}>
                    <select
                      className={inputCls}
                      value={recur.freq}
                      onChange={(e) => setRecur((r) => ({ ...r, freq: e.target.value as typeof r.freq }))}
                    >
                      <option value="daily">{t("submit.recurDaily")}</option>
                      <option value="weekly">{t("submit.recurWeekly")}</option>
                      <option value="biweekly">{t("submit.recurBiweekly")}</option>
                      <option value="monthly">{t("submit.recurMonthly")}</option>
                      <option value="yearly">{t("submit.recurYearly")}</option>
                    </select>
                  </Field>
                  <Field label={t("submit.recurCount")}>
                    <select
                      className={inputCls}
                      value={recur.count}
                      onChange={(e) => setRecur((r) => ({ ...r, count: Number(e.target.value) }))}
                    >
                      {Array.from({ length: 52 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </Field>
                  {form.start_at && recurrencePreview.length > 0 && (
                    <div className="sm:col-span-2 rounded-md border border-border bg-background p-3">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal/70">
                        {t("submit.recurPreviewTitle")}
                      </p>
                      <ol className="max-h-52 space-y-1 overflow-y-auto pr-1 text-xs text-charcoal/70">
                        {recurrencePreview.map((occurrence, index) => {
                          const zone = zoneForSlug(form.diocese_slug);
                          const startLabel = formatInZone(localInputToUtcISO(occurrence.start, zone), "EEEE, MMMM d, yyyy · h:mm a", zone);
                          const endLabel = occurrence.end
                            ? formatInZone(localInputToUtcISO(occurrence.end, zone), "EEEE, MMMM d, yyyy · h:mm a", zone)
                            : null;
                          return (
                            <li key={`${occurrence.start}-${index}`} className="grid grid-cols-[1.5rem_1fr] gap-1">
                              <span className="font-bold text-crimson">{index + 1}.</span>
                              <span>{startLabel}{endLabel ? ` — ${endLabel}` : ""}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}



          {form.start_at && sameDayEvents.length > 0 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-start gap-2 p-4 border-b border-border bg-ivory/50">
                <Users className="w-4 h-4 text-crimson mt-0.5 shrink-0" />
                <p className="text-xs text-charcoal/70 leading-relaxed">
                  {t("submit.sameDayIntro")}
                </p>
              </div>
              <ul className="divide-y divide-border">
                {[...sameDayEvents]
                  .sort((a, b) =>
                    broadcastPriority(a) - broadcastPriority(b) ||
                    a.start_at.localeCompare(b.start_at),
                  )
                  .map((e) => {
                  const broadcast = isBroadcastEvent(e);
                  const catLabel = categoryLabel(e.category ?? "other");
                  const zone = zoneForSlug(form.diocese_slug);
                  const when = `${formatInZone(e.start_at, "h:mm a", zone)}${
                    e.end_at ? ` – ${formatInZone(e.end_at, "h:mm a", zone)}` : ""
                  }`;
                  const locLabel = [e.venue_name, e.address].filter(Boolean).join(", ");
                  return (
                    <li
                      key={e.id}
                      className={`flex gap-3 p-3 sm:p-4 ${
                        broadcast ? "bg-gold/10 border-l-4 border-l-gold" : ""
                      }`}
                    >
                      <div className="w-20 sm:w-24 shrink-0 text-right">
                        <div className="text-sm font-bold text-charcoal leading-tight">
                          {formatInZone(e.start_at, "h:mm a", zone)}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-charcoal/45">
                          {zoneAbbrev(e.start_at, zone)}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <a
                            href={`/catholic-calendar/event/${e.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-bold text-crimson hover:underline break-words"
                          >
                            {e.title}
                          </a>
                          <span className="inline-flex items-center rounded-full bg-crimson/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-crimson">
                            {catLabel}
                          </span>
                          {broadcast && (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${broadcastBadgeClasses(e)}`}>
                              {t(broadcastBadgeKey(e))}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-charcoal/60">{when}</div>
                        {locLabel && (
                          <button
                            type="button"
                            onClick={() =>
                              setMapPreview({
                                title: e.title,
                                label: locLabel,
                                lat: e.latitude,
                                lng: e.longitude,
                              })
                            }
                            className="mt-1 inline-flex items-start gap-1 text-xs text-crimson hover:underline text-left"
                          >
                            <MapPin className="w-3.5 h-3.5 mt-[1px] shrink-0" />
                            <span className="break-words">{locLabel}</span>
                          </button>
                        )}
                        {(e.parish || e.guest_name) && (
                          <div className="mt-1 text-xs text-charcoal/55 break-words">
                            {[e.parish, e.guest_name ? `${t("submit.byOrg")} ${e.guest_name}` : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}


          {mapPreview && (
            <LocationMapDialog
              title={mapPreview.title}
              label={mapPreview.label}
              lat={mapPreview.lat}
              lng={mapPreview.lng}
              onClose={() => setMapPreview(null)}
            />
          )}


          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("submit.fVenue")}>
              <input className={inputCls} value={form.venue_name} onChange={(e) => set("venue_name", e.target.value)} />
            </Field>
            <Field label={t("submit.fAddress")}>
              <PlacesAutocomplete
                value={form.address}
                onChange={(v) => { set("address", v); setAddrCoords(null); }}
                onSelect={(s) => {
                  set("address", s.fullText || `${s.primaryText} ${s.secondaryText}`.trim());
                  if (typeof s.lat === "number" && typeof s.lng === "number") {
                    setAddrCoords({ lat: s.lat, lng: s.lng });
                  }
                }}
                placeholder={t("submit.fAddress")}
              />
            </Field>

          </div>

          <Field label={t("submit.fRegistration")}>
            <input type="url" placeholder="https://" className={inputCls}
              value={form.registration_url} onChange={(e) => set("registration_url", e.target.value)} />
          </Field>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_free} onChange={(e) => set("is_free", e.target.checked)} />
              {t("submit.fFree")}
            </label>
            {!form.is_free && (
              <input
                placeholder={t("submit.fPricePh") as string}
                className={inputCls + " flex-1"}
                value={form.price_note}
                onChange={(e) => set("price_note", e.target.value)}
              />
            )}
          </div>

          <Field label={t("submit.fPoster")}>
            <div className="flex items-start gap-3">
              {posterPreview ? (
                <div className="relative w-28 h-36 rounded-md overflow-hidden border border-border bg-muted shrink-0">
                  <img src={posterPreview} alt="Poster preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPosterFile(null); setPosterPreview(null); }}
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
                      if (!/^image\//.test(f.type)) { setError(t("submit.posterImage")); return; }
                      if (f.size > 8 * 1024 * 1024) { setError(t("submit.posterSize")); return; }
                      setPosterFile(f);
                      setPosterPreview(URL.createObjectURL(f));
                      setError(null);
                    }}
                  />
                </label>
              )}
              <p className="text-xs text-charcoal/60 leading-relaxed">
                {t("submit.posterHint")}
                <br />{t("submit.posterFormat")}
              </p>
            </div>
          </Field>

          {isVerified && (
            <div className="rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/10 via-ivory to-ivory p-4 sm:p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-10 h-10 rounded-full bg-crimson text-ivory flex items-center justify-center shadow-sm">
                  <Video className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg text-charcoal leading-tight">{t("submit.videoTitle")}</p>
                  <p className="text-xs text-charcoal/65 leading-relaxed mt-0.5">{t("submit.videoHint")}</p>

                  <div className="mt-3 inline-flex rounded-full border border-gold/50 bg-ivory p-1">
                    {(["link", "upload"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setVideoMode(mode)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-body font-bold transition-colors ${
                          videoMode === mode ? "bg-crimson text-ivory" : "text-charcoal/70 hover:text-crimson"
                        }`}
                      >
                        {mode === "link" ? <Link2 className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                        {mode === "link" ? t("submit.videoModeLink") : t("submit.videoModeUpload")}
                      </button>
                    ))}
                  </div>

                  {videoMode === "link" ? (
                    <div className="mt-3">
                      <input
                        className={inputCls}
                        placeholder={t("submit.videoLinkPh") as string}
                        value={videoLink}
                        onChange={(e) => setVideoLink(e.target.value)}
                      />
                      {videoLink.trim() && !isSupportedVideoLink(videoLink) && (
                        <p className="mt-1.5 text-[12px] text-crimson">{t("submit.videoInvalid")}</p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3">
                      {videoPreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-border bg-charcoal">
                          <video src={videoPreview} controls className="w-full max-h-56 bg-charcoal" />
                          <button
                            type="button"
                            onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-charcoal/80 text-ivory hover:bg-charcoal"
                            aria-label={t("submit.videoRemove") as string}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-1.5 w-full py-7 rounded-xl border-2 border-dashed border-gold/60 bg-gold/5 text-charcoal/65 cursor-pointer hover:border-crimson hover:text-crimson transition-colors">
                          <Upload className="w-6 h-6" />
                          <span className="text-[12.5px] font-body font-bold">{t("submit.videoDrop")}</span>
                          <span className="text-[11px]">{t("submit.videoFormat", { mb: MAX_VIDEO_MB })}</span>
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              if (!/^video\//.test(f.type)) { setError(t("submit.videoInvalidFile")); return; }
                              if (f.size > MAX_VIDEO_MB * 1024 * 1024) { setError(t("submit.videoTooBig", { mb: MAX_VIDEO_MB })); return; }
                              setVideoFile(f);
                              setVideoPreview(URL.createObjectURL(f));
                              setError(null);
                            }}
                          />
                        </label>
                      )}
                      {videoUploading && (
                        <p className="mt-2 flex items-center gap-2 text-[12px] text-charcoal/70">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("submit.videoUploading")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}



          <div className="pt-4 border-t border-border">
            <p className="text-xs text-charcoal/60 mb-3">
              {user ? t("submit.contactUserHint") : t("submit.contactGuestHint")}
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t("submit.fYourName")}>
                <input className={inputCls} required value={form.guest_name} onChange={(e) => set("guest_name", e.target.value)} />
              </Field>
              <Field label={t("submit.fYourEmail")}>
                <input type="email" className={inputCls} required value={form.guest_email} onChange={(e) => set("guest_email", e.target.value)} />
              </Field>
              <Field label={isVerified ? t("submit.fYourPhoneOptional") : t("submit.fYourPhone")}>
                <input
                  type="tel"
                  className={inputCls}
                  required={!isVerified}
                  maxLength={30}
                  placeholder="+1 514 555 0123"
                  value={form.guest_phone}
                  onChange={(e) => set("guest_phone", e.target.value)}
                />
                {!isVerified && (
                  <p className="text-[11px] text-charcoal/55 mt-1">{t("submit.phoneHint")}</p>
                )}
              </Field>
            </div>
          </div>

          <div className="pt-4 border-t border-border rounded-md bg-ivory/40 p-3">
            <label className="flex items-start gap-2 text-xs text-charcoal/80 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
              />
              <span>
                {t("submit.terms")}
              </span>
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            disabled={submitting || !agreedTerms || capped}
            className="w-full sm:w-auto px-6 py-3 rounded-md bg-crimson text-ivory font-body font-bold hover:bg-crimson-deep transition-colors disabled:opacity-50"
          >
            {submitting ? t("submit.submitting") : isVerified ? t("submit.publish") : t("submit.submitReview")}
          </button>
        </form>
      </div>
    </CalendarLayout>
  );
}

const inputCls =

  "w-full px-3 py-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-crimson/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wide text-charcoal/60 mb-1">{label}</span>
      {children}
    </label>
  );
}

/* ---------------- Boost / Featured-slot picker ---------------- */
const SLOT_PRICES: Record<number, { cents: number; priceId: string; label: string }> = {
  1: { cents: 1000, priceId: "featured_slot_1_day", label: "#1 — Top + highlight" },
  2: { cents: 700,  priceId: "featured_slot_2_day", label: "#2" },
  3: { cents: 500,  priceId: "featured_slot_3_day", label: "#3" },
  4: { cents: 200,  priceId: "featured_slot_4_day", label: "#4" },
};

function dateRange(start: string, end: string | null): string[] {
  const out: string[] = [];
  const s = new Date(start);
  const e = end ? new Date(end) : new Date(start);
  const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  while (cur <= last && out.length < 31) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function BoostStep({ event, onDone }: { event: { id: string; start_at: string; end_at: string | null }; onDone: () => void }) {
  const days = useMemo(() => dateRange(event.start_at, event.end_at), [event]);
  const [taken, setTaken] = useState<Record<string, Set<number>>>({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [activeSlot, setActiveSlot] = useState<{ slotId: string; priceId: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("featured_slots")
        .select("slot_date, rank, status")
        .in("slot_date", days)
        .in("status", ["pending", "paid"]);
      const map: Record<string, Set<number>> = {};
      (data ?? []).forEach((r: any) => {
        const k = r.slot_date;
        if (!map[k]) map[k] = new Set();
        map[k].add(r.rank);
      });
      setTaken(map);
      setLoading(false);
    })();
  }, [days.join(",")]);

  const claim = async (day: string, rank: number) => {
    setErr(null);
    const cfg = SLOT_PRICES[rank];
    const { data, error } = await supabase
      .from("featured_slots")
      .insert({
        event_id: event.id,
        slot_date: day,
        rank,
        amount_cents: cfg.cents,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !data) {
      setErr(/duplicate|unique/i.test(error?.message || "") ? "That spot was just taken — please pick another." : (error?.message || "Could not reserve slot."));
      // Refresh taken state so UI reflects reality.
      const { data: refresh } = await supabase
        .from("featured_slots").select("slot_date, rank")
        .in("slot_date", days).in("status", ["pending", "paid"]);
      const map: Record<string, Set<number>> = {};
      (refresh ?? []).forEach((r: any) => { if (!map[r.slot_date]) map[r.slot_date] = new Set(); map[r.slot_date].add(r.rank); });
      setTaken(map);
      return;
    }
    setActiveSlot({ slotId: data.id, priceId: cfg.priceId });
  };

  if (activeSlot && user) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-5">
        <h2 className="font-display text-2xl text-crimson mb-3">Complete payment to lock your spot</h2>
        <p className="text-sm text-charcoal/70 mb-4">
          Your reservation is held while you finish checkout. If you close this page, your spot is released.
        </p>
        <StripeEmbeddedCheckout
          priceId={activeSlot.priceId}
          customerEmail={user.email ?? undefined}
          userId={user.id}
          returnUrl={`${window.location.origin}/catholic-calendar/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
          metadata={{ kind: "featured_slot", slotId: activeSlot.slotId, eventId: event.id }}
        />
        <button onClick={onDone} className="mt-4 text-sm underline text-charcoal/70">Skip and finish</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-5">
      <h2 className="font-display text-2xl md:text-3xl text-crimson mb-2">Boost your event (optional)</h2>
      <p className="text-charcoal/70 mb-6 text-sm">
        Your submission is in! Want it pinned to the top of the day? Pick a spot below — first come, first served.
        <br /><span className="text-xs text-charcoal/55">#1 $10 (highlighted) · #2 $7 · #3 $5 · #4 $2 · per day.</span>
      </p>
      {err && <p className="mb-3 text-sm text-crimson">{err}</p>}
      {loading ? (
        <p className="text-sm text-charcoal/55">Loading availability…</p>
      ) : (
        <div className="space-y-3">
          {days.map((d) => (
            <div key={d} className="border border-border rounded-md p-3 bg-card">
              <div className="font-bold mb-2 text-sm">
                {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((rank) => {
                  const isTaken = taken[d]?.has(rank);
                  const cfg = SLOT_PRICES[rank];
                  return (
                    <button
                      key={rank}
                      disabled={isTaken}
                      onClick={() => claim(d, rank)}
                      className={`text-xs p-2 rounded border transition-colors ${
                        isTaken
                          ? "bg-muted text-charcoal/40 border-border cursor-not-allowed"
                          : "bg-ivory border-crimson/40 hover:bg-crimson hover:text-ivory"
                      }`}
                    >
                      <div className="font-bold">{cfg.label}</div>
                      <div>${(cfg.cents / 100).toFixed(2)}</div>
                      {isTaken && <div className="text-[10px] mt-1">Taken</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={onDone} className="px-5 py-2.5 rounded-md border border-border text-charcoal hover:bg-muted text-sm font-bold">
          No thanks — finish
        </button>
      </div>
    </div>
  );
}