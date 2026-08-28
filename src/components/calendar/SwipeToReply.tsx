import { useRef, useState, ReactNode } from "react";
import { CornerUpLeft } from "lucide-react";

/**
 * Wrap a chat message bubble. Swipe right past the threshold to trigger onReply.
 * Works with mouse + touch via Pointer Events.
 */
export function SwipeToReply({
  children,
  onReply,
  align = "left",
}: {
  children: ReactNode;
  onReply: () => void;
  /** "right" aligns the bubble to the right (your own messages). */
  align?: "left" | "right";
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const THRESHOLD = 60;
  const MAX = 90;

  const onPointerDown = (e: React.PointerEvent) => {
    // Ignore non-primary buttons
    if (e.button !== undefined && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    active.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null || startY.current === null) return;
    const d = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!active.current) {
      // Only engage on a clearly horizontal rightward swipe
      if (d > 8 && Math.abs(d) > Math.abs(dy) * 1.4) {
        active.current = true;
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
      } else if (Math.abs(dy) > 8) {
        startX.current = null;
        startY.current = null;
        return;
      } else return;
    }
    setDx(Math.max(0, Math.min(MAX, d)));
  };
  const finish = () => {
    const d = dx;
    setDx(0);
    startX.current = null;
    startY.current = null;
    const wasActive = active.current;
    active.current = false;
    if (wasActive && d >= THRESHOLD) onReply();
  };

  return (
    <div className={`relative ${align === "right" ? "ml-auto" : ""}`} style={{ touchAction: "pan-y" }}>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-crimson"
        style={{ opacity: Math.min(1, dx / THRESHOLD) }}
        aria-hidden
      >
        <CornerUpLeft className="w-4 h-4" />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform 160ms ease" : "none" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Compact bar shown above the composer when a reply target is selected. */
export function ReplyingToBar({
  name,
  snippet,
  onCancel,
}: {
  name: string;
  snippet: string;
  onCancel: () => void;
}) {
  // Strip any leading [[REPLY:...]] sentinel so the preview shows the actual
  // typed text of the message being replied to, not the encoded marker.
  const stripped = (snippet || "").replace(REPLY_SENTINEL_RE, "");
  const raw = stripped.replace(/\s+/g, " ").trim();
  const preview = raw.length > 40 ? raw.slice(0, 40) + "…" : raw;
  return (
    <div className="flex items-start gap-2 text-xs bg-muted border-l-2 border-crimson rounded px-2 py-1.5 w-full max-w-full min-w-0 overflow-hidden">
      <CornerUpLeft className="w-3.5 h-3.5 text-crimson mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="font-bold text-crimson truncate">Replying to {name}</div>
        <div className="text-charcoal/65 truncate [overflow-wrap:anywhere]">{preview || "(attachment)"}</div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="text-charcoal/50 hover:text-destructive shrink-0"
        aria-label="Cancel reply"
      >
        ×
      </button>
    </div>
  );
}

/** Format a quote block to prepend to the outgoing message body. */
/**
 * Encode a structured reply reference as an opaque sentinel at the start of
 * the message body. Rendered as a small "tap to view" chip by MessageBody,
 * not as inline quoted text.
 */
export function buildQuotedReply(name: string, snippet: string, newBody: string): string {
  const raw = (snippet || "").replace(REPLY_SENTINEL_RE, "").trim();
  const payload = { n: name || "", t: raw.slice(0, 2000) };
  const json = JSON.stringify(payload);
  // UTF-8 safe base64
  const b64 = btoa(unescape(encodeURIComponent(json)));
  const prefix = `[[REPLY:${b64}]]\n`;
  return prefix + (newBody || "");
}

export const REPLY_SENTINEL_RE = /^\[\[REPLY:([A-Za-z0-9+/=]+)\]\]\n?/;

export function parseReplyRef(body?: string | null): {
  ref: { name: string; text: string } | null;
  rest: string;
} {
  if (!body) return { ref: null, rest: body || "" };
  const m = body.match(REPLY_SENTINEL_RE);
  if (!m) return { ref: null, rest: body };
  try {
    const json = decodeURIComponent(escape(atob(m[1])));
    const obj = JSON.parse(json) as { n?: string; t?: string };
    return {
      ref: { name: obj.n || "", text: obj.t || "" },
      rest: body.slice(m[0].length),
    };
  } catch {
    return { ref: null, rest: body };
  }
}
