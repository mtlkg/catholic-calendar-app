import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users, MessageCircle, MapPin, CalendarDays, Heart, ArrowRight } from "lucide-react";
import CalendarLayout from "./CalendarLayout";

export default function About() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Users,
      title: t("about.collaboration.title"),
      body: t("about.collaboration.description"),
    },
    {
      icon: MessageCircle,
      title: t("about.messaging.title"),
      body: t("about.messaging.description"),
    },
    {
      icon: MapPin,
      title: t("about.calendar.title"),
      body: t("about.calendar.description"),
    },
  ];

  return (
    <CalendarLayout>
      <Helmet>
        <title>{t("about.meta.title")} | {t("brand.name")}</title>
        <meta name="description" content={t("about.meta.description")} />
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero text-ivory">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-gold blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-crimson-deep blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-5 pt-16 pb-20 text-center">
          <span className="inline-block text-gold-light text-xs sm:text-sm tracking-[0.25em] uppercase font-body mb-4">
            {t("about.hero.eyebrow")}
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-bold leading-tight mb-6">
            {t("about.hero.title")}
          </h1>
          <p className="font-body text-base sm:text-lg leading-relaxed text-ivory/90 max-w-2xl mx-auto mb-8">
            {t("about.hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/catholic-calendar"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-gold text-charcoal font-body font-semibold hover:bg-gold-light transition-colors"
            >
              <CalendarDays className="w-4 h-4" /> {t("about.hero.ctaCalendar")}
            </Link>
            <Link
              to="/catholic-calendar/submit"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-ivory/40 text-ivory font-body hover:bg-ivory/10 transition-colors"
            >
              {t("about.hero.ctaSubmit")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="py-14 sm:py-20 px-5 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-gold/30 bg-card p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-full bg-crimson/10 text-crimson flex items-center justify-center mb-5 group-hover:bg-crimson group-hover:text-ivory transition-colors">
                  <f.icon className="w-6 h-6" />
                </div>
                <h2 className="font-display text-xl font-semibold text-charcoal mb-3">
                  {f.title}
                </h2>
                <p className="font-body text-sm sm:text-base text-charcoal/80 leading-relaxed">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-14 sm:py-20 px-5 bg-ivory-dark/30 border-y border-gold/20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="ornament-line text-gold mb-6">
            <Heart className="w-5 h-5 fill-gold text-gold" />
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold text-charcoal mb-5">
            {t("about.mission.title")}
          </h2>
          <p className="font-body text-base sm:text-lg text-charcoal/85 leading-relaxed italic">
            {t("about.mission.statement")}
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-14 sm:py-20 px-5 bg-background">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="font-display text-xl sm:text-2xl font-semibold text-charcoal mb-4">
            {t("about.cta.title")}
          </h3>
          <p className="font-body text-charcoal/80 mb-6">
            {t("about.cta.body")}
          </p>
          <Link
            to="/catholic-calendar/accounts"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-crimson text-ivory font-body font-semibold hover:bg-crimson-deep transition-colors"
          >
            {t("about.cta.button")}
          </Link>
        </div>
      </section>
    </CalendarLayout>
  );
}
