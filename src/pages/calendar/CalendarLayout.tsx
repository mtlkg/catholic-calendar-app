import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import DiocesePicker from "@/components/DiocesePicker";
import { Menu, X, LogOut, LayoutDashboard, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/logo.png";
import LanguageSwitcher from "@/components/LanguageSwitcher";




const useNavItems = () => {
  const { t } = useTranslation();
  return [
    { to: "/catholic-calendar", label: t("nav.calendar"), end: true },
    { to: "/catholic-calendar/highlights", label: t("nav.highlights") },
    { to: "/catholic-calendar/organizers", label: t("nav.organizers") },
    { to: "/catholic-calendar/submit", label: t("nav.submit"), shortLabel: t("nav.submitShort") },
    { to: "/catholic-calendar/accounts", label: t("nav.accounts"), shortLabel: t("nav.accountsShort") },
  ];
};

export default function CalendarLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navItems = useNavItems();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The calendar page has its own diocese switcher, so only show one in the
  // header on every other page.
  const showDiocesePicker = !/^\/catholic-calendar(\/d\/[^/]+)?\/?$/.test(pathname);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/catholic-calendar");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-charcoal">
      <header className="sticky top-0 z-40 border-b border-gold/30 bg-ivory/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-2.5 sm:px-4 py-1.5 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Brand */}
          <Link to="/catholic-calendar" className="flex items-center gap-1.5 sm:gap-2 group min-w-0 flex-1 xl:flex-none">
            <img
              src={logo}
              alt="The Catholic Calendar logo"
              width={36}
              height={36}
              className="h-7 w-7 sm:h-9 sm:w-9 object-contain drop-shadow-sm shrink-0"
            />
            <span className="font-display text-[11px] leading-[1.15] sm:text-base xl:text-lg text-charcoal min-w-0 block break-words">
              {t("brand.name")}
              <span className="hidden sm:block text-[9px] tracking-[0.28em] text-gold uppercase mt-0.5 truncate">
                {t("brand.tagline")}
              </span>
            </span>
          </Link>


          {/* Desktop nav */}
          <nav className="hidden xl:flex items-center gap-0.5 flex-1 justify-center min-w-0">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 rounded-md text-[13px] font-body whitespace-nowrap transition-colors ${
                    isActive ? "text-crimson font-bold" : "text-charcoal/70 hover:text-charcoal"
                  }`
                }
              >
                {n.shortLabel ?? n.label}
              </NavLink>
            ))}
          </nav>

          {/* Right cluster: Diocese + Sign In + Lang */}
          <div className="hidden xl:flex items-center gap-1.5 shrink-0">
            {user ? (

              <>
                <NavLink
                  to="/catholic-calendar/dashboard"
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[13px] font-body bg-crimson text-ivory hover:bg-crimson-deep transition-colors ${
                      isActive ? "ring-2 ring-gold" : ""
                    }`
                  }
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> {t("nav.dashboard")}
                </NavLink>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[13px] text-charcoal/70 hover:text-charcoal"
                  aria-label={t("nav.signOut") as string}
                  title={t("nav.signOut") as string}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <Link
                to="/catholic-calendar/auth"
                className="px-2.5 py-1.5 rounded-md text-[13px] font-body bg-charcoal text-ivory hover:bg-charcoal/80 transition-colors whitespace-nowrap"
              >
                {t("nav.signInShort")}
              </Link>
            )}
            {showDiocesePicker && <DiocesePicker className="ml-1 shrink-0 max-w-[220px]" />}
            <LanguageSwitcher className="ml-1" />
          </div>

          {/* Mobile/tablet controls */}
          <div className="xl:hidden flex items-center gap-0.5 sm:gap-2 shrink-0">
            {showDiocesePicker && <DiocesePicker className="shrink-0 max-w-[130px]" />}
            <LanguageSwitcher />
            <button
              className="p-1.5 sm:p-2 shrink-0"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={t("nav.menu") as string}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>


        {mobileOpen && (
          <div className="xl:hidden border-t border-gold/20 bg-ivory">
            <div className="px-5 py-3 flex flex-col gap-1">
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm ${
                      isActive ? "text-crimson font-bold" : "text-charcoal/80"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              {user ? (
                <>
                  <NavLink
                    to="/catholic-calendar/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 rounded-md text-sm bg-crimson text-ivory"
                  >
                    {t("nav.dashboard")}
                  </NavLink>
                  <button
                    onClick={() => { setMobileOpen(false); handleSignOut(); }}
                    className="text-left px-3 py-2 rounded-md text-sm text-charcoal/70"
                  >
                    {t("nav.signOut")}
                  </button>
                </>
              ) : (
                <Link
                  to="/catholic-calendar/auth"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2 rounded-md text-sm bg-charcoal text-ivory"
                >
                  {t("nav.signIn")}
                </Link>
              )}

            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gold/30 bg-charcoal text-ivory/80 py-8 px-5 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <p className="font-display italic">
            © {new Date().getFullYear()} {t("brand.name")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <Link
              to="/catholic-calendar/about"
              className="text-ivory/80 hover:text-gold transition-colors"
            >
              {t("nav.about")}
            </Link>
            <Link
              to="/catholic-calendar/privacy"
              className="text-ivory/80 hover:text-gold transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/catholic-calendar/terms"
              className="text-ivory/80 hover:text-gold transition-colors"
            >
              Terms
            </Link>
            <a
              href="mailto:globalcatholiccalendar@gmail.com"
              className="inline-flex items-center gap-2 text-gold-light hover:text-gold transition-colors"
            >
              <Mail className="w-4 h-4" /> globalcatholiccalendar@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}


export const CATEGORIES = [
  { value: "mass", label: "Mass" },
  { value: "adoration", label: "Adoration" },
  { value: "bible_study", label: "Bible Study" },
  { value: "retreat", label: "Retreat" },
  { value: "conference", label: "Conference" },
  { value: "young_adults", label: "Young Adults (18-35)" },
  { value: "youth_group", label: "Youth Group (under 18)" },
  { value: "social", label: "Social" },
  { value: "fundraiser", label: "Fundraiser" },
  { value: "service", label: "Service" },
  { value: "other", label: "Other" },
] as const;

/**
 * Localized label for a category value. Falls back to the English label if the
 * translation is missing so we never render an empty chip.
 */
export function useCategoryLabel() {
  const { t } = useTranslation();
  return (value: string) => {
    const key = `categories.${value}`;
    const translated = t(key);
    if (translated !== key) return translated;
    const found = CATEGORIES.find((c) => c.value === value);
    return found?.label ?? value.replace(/_/g, " ");
  };
}

export const CATEGORY_COLORS: Record<string, string> = {
  mass: "bg-crimson/15 text-crimson border-crimson/30",
  adoration: "bg-amber-100 text-amber-900 border-amber-300",
  bible_study: "bg-emerald-100 text-emerald-900 border-emerald-300",
  retreat: "bg-violet-100 text-violet-900 border-violet-300",
  conference: "bg-blue-100 text-blue-900 border-blue-300",
  young_adults: "bg-pink-100 text-pink-900 border-pink-300",
  youth_group: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300",
  youth: "bg-pink-100 text-pink-900 border-pink-300",
  social: "bg-orange-100 text-orange-900 border-orange-300",
  fundraiser: "bg-yellow-100 text-yellow-900 border-yellow-400",
  service: "bg-teal-100 text-teal-900 border-teal-300",
  other: "bg-stone-100 text-stone-900 border-stone-300",
};
