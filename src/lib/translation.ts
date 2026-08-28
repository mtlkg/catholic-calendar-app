export type TranslationTarget = "en" | "fr" | "es";

export function currentTranslationTarget(language?: string): TranslationTarget {
  const l = language?.toLowerCase() ?? "";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("es")) return "es";
  return "en";
}

export function translationCacheKey(scope: string, lang: TranslationTarget, id: string, text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return `${scope}:${lang}:${id}:${text.length}:${(hash >>> 0).toString(36)}`;
}
