/** Main languages an event can be celebrated / held in. */
export const EVENT_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français (French)" },
  { value: "es", label: "Español (Spanish)" },
  { value: "pt", label: "Português (Portuguese)" },
  { value: "it", label: "Italiano (Italian)" },
  { value: "pl", label: "Polski (Polish)" },
  { value: "la", label: "Latin" },
  { value: "ar", label: "العربية (Arabic)" },
  { value: "tl", label: "Tagalog / Filipino" },
  { value: "vi", label: "Tiếng Việt (Vietnamese)" },
  { value: "zh", label: "中文 (Chinese)" },
  { value: "ko", label: "한국어 (Korean)" },
  { value: "uk", label: "Українська (Ukrainian)" },
  { value: "ro", label: "Română (Romanian)" },
  { value: "de", label: "Deutsch (German)" },
  { value: "cr", label: "Croatian" },
  { value: "sy", label: "Syriac / Aramaic" },
  { value: "gr", label: "Ελληνικά (Greek)" },
  { value: "ht", label: "Kreyòl ayisyen (Haitian Creole)" },
  { value: "other", label: "Other" },
] as const;

export function eventLanguageLabel(value?: string | null): string | null {
  if (!value) return null;
  return EVENT_LANGUAGES.find((l) => l.value === value)?.label ?? value;
}

export function eventLanguagesLabel(values?: string[] | null): string | null {
  if (!values || values.length === 0) return null;
  return values.map((v) => eventLanguageLabel(v) ?? v).join(" · ");
}
