export type AudienceScope = "diocese" | "multi" | "regional" | "national";

export type AudienceEvent = {
  diocese_slug?: string | null;
  audience_scope?: string | null;
  audience_diocese_slugs?: string[] | null;
  audience_countries?: string[] | null;
};

export function isBroadcastEvent(event: AudienceEvent): boolean {
  return event.audience_scope === "multi" || event.audience_scope === "regional" || event.audience_scope === "national";
}

export function broadcastBadgeKey(event: AudienceEvent): string {
  if (event.audience_scope === "national") return "home.national.badge";
  if (event.audience_scope === "regional") return "home.national.regionalBadge";
  return "home.national.multiBadge";
}

export function broadcastPriority(event: AudienceEvent): number {
  return isBroadcastEvent(event) ? 0 : 1;
}

export function isHostedInScope(event: AudienceEvent, scopeSlugs: string[]): boolean {
  return !!event.diocese_slug && scopeSlugs.includes(event.diocese_slug);
}

export function isInvitedToScope(event: AudienceEvent, scopeSlugs: string[], country: string): boolean {
  if (isHostedInScope(event, scopeSlugs)) return true;
  if (event.audience_scope === "national") return !!event.audience_countries?.includes(country);
  if (event.audience_scope === "multi" || event.audience_scope === "regional") {
    return scopeSlugs.some((slug) => event.audience_diocese_slugs?.includes(slug));
  }
  return false;
}

export function shouldPinOnMap(event: AudienceEvent, scopeSlugs: string[]): boolean {
  return !isBroadcastEvent(event) || isHostedInScope(event, scopeSlugs);
}

export function broadcastBadgeClasses(event: AudienceEvent): string {
  if (event.audience_scope === "national") return "bg-crimson text-ivory border-crimson";
  if (event.audience_scope === "regional") return "bg-gold text-charcoal border-gold";
  return "bg-charcoal text-ivory border-charcoal";
}