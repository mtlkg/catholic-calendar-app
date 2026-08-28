import { createContext, useContext, ReactNode, useSyncExternalStore } from "react";
import { parseReplyRef } from "@/components/calendar/SwipeToReply";

export type ChainMessage = {
  id: string;
  authorName: string;
  body: string | null;
  attachments?: any;
  mine: boolean;
  createdAt: string;
};

type Ctx = {
  messages: ChainMessage[];
  /** Send a new message that quotes the given parent. */
  sendReply: (parent: { name: string; text: string }, text: string) => Promise<void> | void;
};

const ReplyChainCtx = createContext<Ctx | null>(null);

export function ReplyChainProvider({
  messages,
  sendReply,
  children,
}: Ctx & { children: ReactNode }) {
  return (
    <ReplyChainCtx.Provider value={{ messages, sendReply }}>
      {children}
    </ReplyChainCtx.Provider>
  );
}

export function useReplyChain() {
  return useContext(ReplyChainCtx);
}

/* -------- Global "focus modal open" flag --------
 * When the reply focus modal is open, parent chat views should freeze:
 * no auto-scroll, no jump to bottom. Underlying messages still update in
 * state (so they appear once the modal closes) but the view stays put.
 */
let focusOpenCount = 0;
const focusListeners = new Set<() => void>();
function emitFocus() { focusListeners.forEach((l) => l()); }
export function pushFocusOpen() { focusOpenCount += 1; emitFocus(); }
export function popFocusOpen() { focusOpenCount = Math.max(0, focusOpenCount - 1); emitFocus(); }
export function isFocusOpen() { return focusOpenCount > 0; }
export function useIsFocusOpen() {
  return useSyncExternalStore(
    (cb) => { focusListeners.add(cb); return () => focusListeners.delete(cb); },
    () => focusOpenCount > 0,
    () => false,
  );
}

/** Normalize text for chain matching. */
function norm(s: string | null | undefined) {
  return (s || "").replace(/\s+/g, " ").trim();
}

/**
 * Given a parent ref (name + text), find every message in the chain:
 *  - the parent message itself (a message whose body matches parent.text and
 *    whose authorName matches parent.name, with no reply ref of its own), and
 *  - every reply whose parsed reply ref points at the same parent.
 * Returned in chronological order.
 */
export function collectChain(
  messages: ChainMessage[],
  parent: { name: string; text: string },
): ChainMessage[] {
  const pText = norm(parent.text);
  const pName = norm(parent.name);
  const out: ChainMessage[] = [];
  for (const m of messages) {
    const { ref, rest } = parseReplyRef(m.body);
    if (ref) {
      if (norm(ref.text) === pText && norm(ref.name) === pName) {
        out.push(m);
      }
    } else {
      if (norm(rest) === pText && norm(m.authorName) === pName) {
        // parent itself – prepend later
        out.unshift(m);
      }
    }
  }
  // Ensure chronological after the unshift trick
  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return out;
}
