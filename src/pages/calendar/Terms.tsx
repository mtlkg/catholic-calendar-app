import { Helmet } from "react-helmet-async";
import CalendarLayout from "./CalendarLayout";

const UPDATED = "August 29, 2026";
const CONTACT_EMAIL = "globalcatholiccalendar@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-xl text-charcoal mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-charcoal/80">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <CalendarLayout>
      <Helmet>
        <title>Terms of Use | The Catholic Calendar</title>
        <meta name="description" content="The terms that govern your use of The Catholic Calendar." />
      </Helmet>

      <div className="max-w-3xl mx-auto px-5 py-14 sm:py-20">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal mb-2">
          Terms of Use
        </h1>
        <p className="text-sm text-charcoal/60 mb-10">Last updated: {UPDATED}</p>

        <Section title="Using the Service">
          <p>The Catholic Calendar helps you discover and share Catholic events, feast
            days, and parish activities. By using our website or apps, you agree to these
            terms. If you don't agree, please don't use the Service.</p>
        </Section>

        <Section title="Accounts">
          <p>You're responsible for the accuracy of the information you provide and for
            keeping your account secure. You must be at least 13 years old to create an
            account.</p>
        </Section>

        <Section title="Content you submit">
          <p>You're responsible for the events, messages, and other content you post. Don't
            post anything false, unlawful, or infringing on someone else's rights. We may
            remove content or suspend accounts that violate these terms or that we
            reasonably believe are harmful to the community.</p>
          <p>By posting content, you grant us a license to display it as part of the
            Service — for example, showing your event to people searching the calendar.
            You keep ownership of what you post.</p>
        </Section>

        <Section title="Purchases">
          <p>Some features — event promotion, tickets, merchandise, or an organizer
            subscription — involve payment, processed by Stripe. Prices and what's included
            are shown before you pay. Purchases are generally non-refundable except where
            required by law or stated otherwise at checkout.</p>
        </Section>

        <Section title="Disclaimer">
          <p>The Catholic Calendar is an independent, community-driven listing. We don't
            control or vouch for the accuracy of events submitted by organizers, and we
            aren't affiliated with any diocese, parish, or the Catholic Church's official
            structures unless explicitly stated. The Service is provided "as is," without
            warranties of any kind.</p>
        </Section>

        <Section title="Changes">
          <p>We may update these terms from time to time; we'll update the date above when
            we do. Continuing to use the Service after a change means you accept the
            updated terms.</p>
        </Section>

        <Section title="Contact us">
          <p>
            Questions about these terms? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-crimson underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </Section>
      </div>
    </CalendarLayout>
  );
}
