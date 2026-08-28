// Localized web push copy for every notification type.

export type PushLocale = "en" | "fr" | "es";
export type PushTemplate =
  | "follower-new-event"
  | "event-reminder"
  | "dm"
  | "thread-reply";

export function normalizeLocale(v: unknown): PushLocale {
  const s = String(v ?? "en").slice(0, 2).toLowerCase();
  return s === "fr" ? "fr" : s === "es" ? "es" : "en";
}

type Data = Record<string, string>;
type Built = { title: string; body: string };

const BUILDERS: Record<PushTemplate, Record<PushLocale, (d: Data) => Built>> = {
  "follower-new-event": {
    en: (d) => ({
      title: `${d.orgName} posted a new event`,
      body: `${d.eventTitle}${d.startAt ? ` — ${d.startAt}` : ""}`,
    }),
    fr: (d) => ({
      title: `${d.orgName} a publié un nouvel événement`,
      body: `${d.eventTitle}${d.startAt ? ` — ${d.startAt}` : ""}`,
    }),
    es: (d) => ({
      title: `${d.orgName} publicó un nuevo evento`,
      body: `${d.eventTitle}${d.startAt ? ` — ${d.startAt}` : ""}`,
    }),
  },
  "event-reminder": {
    en: (d) => ({
      title: `Tomorrow: ${d.eventTitle}`,
      body: `${d.startAt}${d.venue ? ` — ${d.venue}` : ""}`,
    }),
    fr: (d) => ({
      title: `Demain : ${d.eventTitle}`,
      body: `${d.startAt}${d.venue ? ` — ${d.venue}` : ""}`,
    }),
    es: (d) => ({
      title: `Mañana: ${d.eventTitle}`,
      body: `${d.startAt}${d.venue ? ` — ${d.venue}` : ""}`,
    }),
  },
  dm: {
    en: (d) => ({ title: `New message from ${d.senderName}`, body: d.excerpt || "Open your messages" }),
    fr: (d) => ({ title: `Nouveau message de ${d.senderName}`, body: d.excerpt || "Ouvrez vos messages" }),
    es: (d) => ({ title: `Nuevo mensaje de ${d.senderName}`, body: d.excerpt || "Abre tus mensajes" }),
  },
  "thread-reply": {
    en: (d) => ({ title: `${d.senderName} replied to your thread`, body: d.threadTitle || "" }),
    fr: (d) => ({ title: `${d.senderName} a répondu à votre fil`, body: d.threadTitle || "" }),
    es: (d) => ({ title: `${d.senderName} respondió a tu hilo`, body: d.threadTitle || "" }),
  },
};

export function renderPush(
  template: PushTemplate,
  locale: PushLocale,
  data: Data,
): Built {
  const build = BUILDERS[template]?.[locale] ?? BUILDERS[template]?.en;
  if (!build) throw new Error(`unknown push template: ${template}`);
  return build(data);
}
