import { useState } from "react";
import { createPortal } from "react-dom";
import { Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import EventVideoDialog from "./EventVideoDialog";

/**
 * Small clickable video marker shown next to events that have a promo video.
 */
export default function EventVideoButton({
  title,
  video,
  variant = "icon",
  className = "",
}: {
  title: string;
  video?: string | null;
  variant?: "icon" | "chip";
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!video) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={t("video.watch") as string}
        title={t("video.watch") as string}
        className={
          variant === "chip"
            ? `relative z-10 inline-flex items-center gap-1.5 rounded-md border border-crimson/40 bg-crimson/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-crimson hover:bg-crimson hover:text-ivory transition-colors ${className}`
            : `relative z-10 inline-flex items-center justify-center w-6 h-6 rounded-full bg-crimson text-ivory shadow-sm hover:bg-crimson-deep transition-colors ${className}`
        }
      >
        <Video className={variant === "chip" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        {variant === "chip" && <span>{t("video.watch")}</span>}
      </button>
      {open &&
        createPortal(
          <EventVideoDialog title={title} video={video} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  );
}
