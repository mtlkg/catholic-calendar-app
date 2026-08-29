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

export default function Privacy() {
  return (
    <CalendarLayout>
      <Helmet>
        <title>Privacy Policy | The Catholic Calendar</title>
        <meta
          name="description"
          content="How The Catholic Calendar collects, uses, and protects your information."
        />
      </Helmet>

      <div className="max-w-3xl mx-auto px-5 py-14 sm:py-20">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-charcoal/60 mb-10">Last updated: {UPDATED}</p>

        <Section title="Overview">
          <p>
            The Catholic Calendar ("we", "us") operates thecatholiccalendar.org and its
            companion iOS and Android apps (together, the "Service"). This policy explains
            what information we collect, why, and the choices you have. We built the
            Service to help people find and share Catholic events, and we try to collect
            no more than that requires.
          </p>
        </Section>

        <Section title="Information we collect">
          <p><strong className="text-charcoal">Account information.</strong> If you create
            an account, we collect your email address (via Supabase Authentication) and any
            profile details you choose to add, such as an organizer name, bio, or profile
            photo.</p>
          <p><strong className="text-charcoal">Location.</strong> If you allow it, we use
            your device's approximate location — or a diocese/city you select manually — to
            show events near you. You can decline this and browse by diocese instead.</p>
          <p><strong className="text-charcoal">Content you submit.</strong> Events you post,
            RSVPs and "interested" marks, follows, and messages you send through the
            calendar's discussion threads or direct messages are stored so we can display
            them to the people they're intended for.</p>
          <p><strong className="text-charcoal">Payment information.</strong> If you purchase
            tickets, merchandise, or a subscription, payment is processed by Stripe. We
            receive and store order/ticket records (what was purchased, amount, status) but
            never your full card number — Stripe handles that directly.</p>
          <p><strong className="text-charcoal">Push notifications.</strong> If you enable
            notifications, we store a device token or web push subscription (an opaque
            identifier, not readable by us) so we can deliver the notifications you've opted
            into — new events from organizers you follow, event reminders, and messages.</p>
          <p><strong className="text-charcoal">Phone number.</strong> Only if you opt into
            SMS notifications, we store your phone number to send and verify that
            subscription. This is optional and separate from push notifications.</p>
          <p><strong className="text-charcoal">Usage data.</strong> Like most web services,
            our infrastructure providers log basic technical data (IP address, device/browser
            type, pages visited) for security and reliability. We don't use third-party
            advertising trackers.</p>
        </Section>

        <Section title="How we use this information">
          <ul className="list-disc pl-5 space-y-1">
            <li>To show you relevant events, near you or from organizers you follow</li>
            <li>To let you post events, message other users, and manage your organizer profile</li>
            <li>To send the notifications and emails you've opted into, and process transactions</li>
            <li>To keep the Service secure and prevent abuse</li>
          </ul>
          <p>We do not sell your personal information.</p>
        </Section>

        <Section title="Who we share it with">
          <p>We share information only with the service providers that run the Service on
            our behalf, and only what each needs to do its job:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-charcoal">Supabase</strong> — database, authentication, and file storage</li>
            <li><strong className="text-charcoal">Stripe</strong> — payment processing for tickets, merchandise, and subscriptions</li>
            <li><strong className="text-charcoal">Google Maps</strong> — location search and address autocomplete</li>
            <li><strong className="text-charcoal">Firebase Cloud Messaging</strong> — delivering push notifications on Android</li>
            <li><strong className="text-charcoal">Apple Push Notification service</strong> — delivering push notifications on iOS</li>
            <li>Our email delivery provider — sending account and notification emails</li>
          </ul>
          <p>Other organizers can see your organizer profile, the events you post, and messages
            you send them directly — that's the point of the feature. We don't share your
            information with unrelated third parties or advertisers.</p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc pl-5 space-y-1">
            <li>Edit or delete your profile, and delete events you've posted, from your dashboard</li>
            <li>Turn off push, email, or SMS notifications at any time in Notification Settings</li>
            <li>Deny or revoke location permission in your browser or device settings — the calendar still works, browsed by diocese</li>
            <li>Request deletion of your account and associated data by emailing us (below)</li>
          </ul>
        </Section>

        <Section title="Data retention">
          <p>We keep your information for as long as your account is active, or as needed to
            provide the Service (for example, order records are kept as required for
            accounting and dispute handling). If you delete your account, we delete or
            anonymize personal data within a reasonable time, except where we're required to
            keep records for legal or tax purposes.</p>
        </Section>

        <Section title="Children">
          <p>The Service is not directed at children under 13, and we do not knowingly
            collect personal information from them.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>If we make material changes to this policy, we'll update the date above and,
            where appropriate, let you know in the app.</p>
        </Section>

        <Section title="Contact us">
          <p>
            Questions, or want your data deleted? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-crimson underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </Section>
      </div>
    </CalendarLayout>
  );
}
