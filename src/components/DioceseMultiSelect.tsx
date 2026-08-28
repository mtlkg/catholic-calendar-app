import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DIOCESES, isDioceseUnlocked, type Diocese } from "@/data/dioceses";
import { useDioceseName } from "@/context/DioceseContext";

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Searchable multi-select for dioceses. Used wherever an organizer can belong
 * to (or broadcast an event to) more than one jurisdiction.
 */
export default function DioceseMultiSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (slugs: string[]) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const nameOf = useDioceseName();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQ("");
  }, [open]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const selected = useMemo(
    () => value.map((s) => DIOCESES.find((d) => d.slug === s)).filter(Boolean) as Diocese[],
    [value],
  );

  const groups = useMemo(() => {
    const needle = norm(q.trim());
    const match = (d: Diocese) =>
      !needle ||
      norm(d.name).includes(needle) ||
      norm(d.nameFr ?? "").includes(needle) ||
      norm(d.city).includes(needle);
    const list = DIOCESES.filter((d) => isDioceseUnlocked(d.slug)).filter(match);
    return (["CA", "US"] as const)
      .map((key) => ({ key, items: list.filter((d) => d.country === key) }))
      .filter((g) => g.items.length > 0);
  }, [q]);

  const toggle = (slug: string) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-background text-sm text-left focus:outline-none focus:ring-2 focus:ring-crimson/40"
      >
        <span className={selected.length ? "truncate" : "truncate text-charcoal/45"}>
          {selected.length
            ? t("diocese.selectedCount", { count: selected.length })
            : placeholder ?? (t("diocese.selectMany") as string)}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-charcoal/50" />
      </button>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((d) => (
            <span
              key={d.slug}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-crimson/10 text-crimson text-[11px]"
            >
              {nameOf(d)}
              <button
                type="button"
                onClick={() => toggle(d.slug)}
                aria-label={t("common.close") as string}
                className="hover:text-crimson-deep"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-40 left-0 right-0 mt-1 rounded-md border border-border bg-card shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal/40" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("diocese.searchPlaceholder") as string}
                className="w-full pl-8 pr-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {groups.length === 0 && (
              <p className="px-3 py-4 text-sm text-charcoal/60 text-center">{t("diocese.noResults")}</p>
            )}
            {groups.map((g) => (
              <div key={g.key}>
                <div className="sticky top-0 px-3 py-1.5 text-[11px] uppercase tracking-widest text-charcoal/50 bg-muted/80 backdrop-blur">
                  {g.key === "CA" ? t("diocese.canada") : t("diocese.unitedStates")}
                </div>
                {g.items.map((d) => (
                  <button
                    key={d.slug}
                    type="button"
                    onClick={() => toggle(d.slug)}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-charcoal truncate">{nameOf(d)}</span>
                      <span className="block text-xs text-charcoal/55 truncate">{d.city}</span>
                    </span>
                    {value.includes(d.slug) && <Check className="w-4 h-4 text-crimson shrink-0" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
