import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orgName?: string
  dashboardUrl?: string
  requiresPayment?: boolean
  subscribeUrl?: string
}

const Email = ({
  orgName = 'your organization',
  dashboardUrl = 'https://thecatholiccalendar.org/catholic-calendar/dashboard',
  requiresPayment = false,
  subscribeUrl = 'https://thecatholiccalendar.org/catholic-calendar/subscribe',
}: Props) => (
  <Html lang="en">
    <Head />
    <Preview>You're an approved organizer on The Catholic Calendar</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're approved! 🎉</Heading>
        <Text style={text}>Welcome aboard — <strong>{orgName}</strong> has been approved as an organizer on the The Catholic Calendar Catholic Calendar.</Text>
        <Text style={text}>You can now submit events directly from your dashboard. Submissions still get a quick review before going live.</Text>
        {requiresPayment ? (
          <>
            <Text style={text}>
              One last step: activate your verified status by choosing a plan — <strong>$10 USD per month</strong> or{' '}
              <strong>$100 USD per year</strong> (two months free). Billing renews automatically until you cancel.
            </Text>
            <Section><Button style={button} href={subscribeUrl}>Continue to payment →</Button></Section>
          </>
        ) : (
          <Section><Button style={button} href={dashboardUrl}>Go to your dashboard →</Button></Section>
        )}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `You're approved as an organizer on The Catholic Calendar`,
  displayName: 'Organizer approved',
  previewData: { orgName: 'St. Monica Youth Group', dashboardUrl: 'https://thecatholiccalendar.org/catholic-calendar/dashboard' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', color: '#8b0000', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#1a1a1a', margin: '0 0 14px', lineHeight: '1.55' }
const button = { backgroundColor: '#8b0000', color: '#fffaf0', padding: '12px 22px', borderRadius: '6px', textDecoration: 'none', fontWeight: 700, display: 'inline-block', marginTop: '12px' }
