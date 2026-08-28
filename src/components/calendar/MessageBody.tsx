import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Paperclip, FileText, CornerUpLeft, X, Send } from "lucide-react";
import { Attachment, isImage, linkifyParts, signAttachmentUrls } from "@/lib/chatAttachments";
import { parseReplyRef } from "@/components/calendar/SwipeToReply";
import { collectChain, useReplyChain, ChainMessage, pushFocusOpen, popFocusOpen } from "@/components/calendar/ReplyChainContext";

export function MessageBody({
  body,
  attachments,
  tone = "dark",
}: {
  body?: string | null;
  attachments?: Attachment[] | null;
  tone?: "dark" | "light";
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [focusOpen, setFocusOpen] = useState(false);
  const list = Array.isArray(attachments) ? attachments : [];
  const { ref: replyRef, rest } = parseReplyRef(body);

  useEffect(() => {
    if (!list.length) return;
    const missing = list.map((a) => a.path).filter((p) => p && !urls[p]);
    if (!missing.length) return;
    signAttachmentUrls(missing).then((m) => setUrls((cur) => ({ ...cur, ...m })));
  }, [list.map((a) => a.path).join("|")]);

  const linkClass =
    tone === "light"
      ? "underline text-ivory hover:text-ivory/80 break-all"
      : "underline text-crimson hover:text-crimson/80 break-all";

  const chipBase =
    tone === "light"
      ? "border-ivory/40 text-ivory/85 hover:text-ivory"
      : "border-crimson/40 text-charcoal/65 hover:text-charcoal";
  const previewName = replyRef?.name || "";
  const previewText = (replyRef?.text || "").replace(/\s+/g, " ").trim();
  const previewShort = previewText.length > 40 ? previewText.slice(0, 40) + "…" : previewText;

  return (
    <div className="space-y-1.5 min-w-0">
      {replyRef && (
        <button
          type="button"
          onClick={() => setFocusOpen(true)}
          className={`flex items-center gap-1 text-[11px] italic opacity-70 hover:opacity-100 border-l-2 pl-2 pr-1 py-0.5 max-w-full min-w-0 ${chipBase}`}
          title="View full reply"
        >
          <CornerUpLeft className="w-3 h-3 shrink-0" />
          <span className="truncate">
            <span className="font-bold not-italic">{previewName}</span>
            {previewShort ? <>: {previewShort}</> : null}
          </span>
        </button>
      )}
      {rest ? (
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {linkifyParts(rest).map((p, i) =>
            p.type === "link" ? (
              <a key={i} href={p.value} target="_blank" rel="noopener noreferrer" className={linkClass}>{p.value}</a>
            ) : (
              <span key={i}>{p.value}</span>
            ),
          )}
        </p>
      ) : null}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {list.map((a, i) => {
            const url = urls[a.path];
            if (isImage(a)) {
              return (
                <a key={i} href={url || "#"} target="_blank" rel="noopener noreferrer" className="block">
                  {url ? (
                    <img src={url} alt={a.name} className="max-h-48 rounded border border-border object-cover" />
                  ) : (
                    <div className="h-24 w-32 rounded border border-border bg-muted animate-pulse" />
                  )}
                </a>
              );
            }
            return (
              <a
                key={i}
                href={url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border ${tone === "light" ? "border-ivory/40 text-ivory" : "border-border bg-card"}`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="truncate max-w-[12rem]">{a.name}</span>
              </a>
            );
          })}
        </div>
      )}
      {focusOpen && replyRef && (
        <ReplyFocusModal
          parent={{ name: replyRef.name, text: replyRef.text }}
          onClose={() => setFocusOpen(false)}
        />
      )}
    </div>
  );
}

function ReplyFocusModal({
  parent,
  onClose,
}: {
  parent: { name: string; text: string };
  onClose: () => void;
}) {
  const ctx = useReplyChain();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pushFocusOpen();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { popFocusOpen(); window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  const chain: ChainMessage[] = ctx ? collectChain(ctx.messages, parent) : [];

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [chain.length]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t || !ctx || sending) return;
    setSending(true);
    try {
      await ctx.sendReply(parent, t);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-stretch sm:items-center justify-center sm:p-4 bg-ivory sm:bg-black/70 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-w-md sm:max-h-[85vh] flex flex-col bg-ivory sm:rounded-lg sm:shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <div className="text-[11px] uppercase tracking-wide text-charcoal/55 font-bold inline-flex items-center gap-1">
            <CornerUpLeft className="w-3 h-3" /> Reply thread
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-charcoal/60 hover:text-destructive"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          <div className="bg-muted rounded-md p-3 text-sm border-l-2 border-crimson">
            <div className="font-bold text-crimson text-xs mb-1">{parent.name || "Message"}</div>
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {parent.text || "(no text)"}
            </p>
          </div>
          {chain.length === 0 && (
            <p className="text-xs text-charcoal/40 text-center py-2">No replies in this chain yet.</p>
          )}
          {chain.map((m) => {
            const parsed = parseReplyRef(m.body);
            const isParent = !parsed.ref && parsed.rest.replace(/\s+/g, " ").trim() === (parent.text || "").replace(/\s+/g, " ").trim() && (m.authorName || "").trim() === (parent.name || "").trim();
            if (isParent) return null;
            return (
              <div
                key={m.id}
                className={`p-2.5 rounded-md text-sm ${
                  m.mine ? "bg-crimson/10 ml-6" : "bg-muted mr-6"
                }`}
              >
                <div className="text-[11px] font-bold text-charcoal/75">
                  {m.authorName}{m.mine ? " (you)" : ""}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                  {parsed.rest}
                </p>
              </div>
            );
          })}
        </div>

        {ctx && (
          <form onSubmit={submit} className="p-3 border-t border-border flex gap-2">
            <AutoGrowTextarea
              className="flex-1 px-3 py-2 rounded border border-border bg-card text-sm"
              value={text}
              onChange={setText}
              onSubmit={() => submit()}
              placeholder={`Reply to ${parent.name || "this message"}…`}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="px-3 rounded bg-crimson text-ivory disabled:opacity-60 self-end"
              aria-label="Send reply"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function AttachButton({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`inline-flex items-center justify-center px-2.5 rounded border border-border bg-card cursor-pointer hover:bg-muted ${disabled ? "opacity-50 pointer-events-none" : ""}`} title="Attach files">
      <Paperclip className="w-4 h-4 text-charcoal/70" />
      <input
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}

export function PendingAttachments({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-1 pb-1">
      {files.map((f, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted border border-border">
          <span className="truncate max-w-[10rem]">{f.name}</span>
          <button type="button" onClick={() => onRemove(i)} className="text-charcoal/50 hover:text-destructive" aria-label="Remove">×</button>
        </span>
      ))}
    </div>
  );
}

export function AutoGrowTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = "",
  maxHeight = 160,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  maxHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, [value, maxHeight]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // Enter inserts a newline (native textarea behavior).
        // Cmd/Ctrl+Enter submits, for users who want a keyboard shortcut.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit) {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      className={`resize-none overflow-y-auto leading-snug ${className}`}
      style={{ maxHeight }}
    />
  );
}