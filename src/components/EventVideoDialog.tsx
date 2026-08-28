import { useEffect, useState } from "react";
import { X, Loader2, PlayCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveEventVideo, type VideoSource } from "@/lib/eventVideo";

export default function EventVideoDialog({
  title,
  video,
  onClose,
}: {
  title: string;
  video: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [source, setSource] = useState<VideoSource | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveEventVideo(video).then((s) => {
      if (cancelled) return;
      if (s) setSource(s);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [video]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-charcoal/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-3xl rounded-[22px] bg-ivory border border-gold/50 shadow-[0_30px_80px_-20px_hsl(var(--charcoal)/0.75)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-crimson-deep via-crimson to-crimson-deep text-ivory px-5 py-3.5 pr-14">
          <p className="text-[10px] uppercase tracking-[0.26em] text-gold-light font-body">
            {t("video.promo")}
          </p>
          <h2 className="font-display text-xl leading-tight mt-0.5 truncate">{title}</h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            aria-label={t("common.close") as string}
            className="absolute top-3 right-3 rounded-full p-2 bg-ivory/15 hover:bg-ivory/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
        </div>

        <div className="bg-charcoal aspect-video flex items-center justify-center">
          {failed ? (
            <p className="text-ivory/70 font-body text-sm px-6 text-center">{t("video.unavailable")}</p>
          ) : !source ? (
            <Loader2 className="w-7 h-7 text-ivory/70 animate-spin" />
          ) : source.kind === "embed" ? (
            <iframe
              src={`${source.src}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <video src={source.src} controls autoPlay playsInline className="w-full h-full bg-charcoal" />
          )}
        </div>

        {source && (
          <div className="px-5 py-3 bg-ivory flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-crimson shrink-0" />
            <a
              href={source.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12.5px] font-body text-crimson hover:underline truncate"
            >
              {t("video.openNewTab")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
