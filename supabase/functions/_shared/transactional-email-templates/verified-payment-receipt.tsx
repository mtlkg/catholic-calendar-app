import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orgName?: string
  plan?: 'monthly' | 'yearly'
  amount?: string
  nextBillingDate?: string
  manageUrl?: string
}

const Email = ({
  orgName = 'your organization',
  plan = 'monthly',
  amount,
  nextBillingDate,
  manageUrl = 'https://thecatholiccalendar.org/catholic-calendar/subscribe',
}: Props) => {
  const isYearly = plan === 'yearly'
  const shownAmount = amount || (isYearly ? '$100.00 USD' : '$10.00 USD')
  const cadence = isYearly ? 'per year' : 'per month'

  return (
    <Html lang="en">
      <Head />
      <Preview>Your verified organizer payment receipt</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Payment received — you're verified ✅</Heading>
          <Text style={text}>
            Thank you! <strong>{orgName}</strong> is now a verified organizer on The Catholic Calendar.
          </Text>

          <Section style={box}>
            <Text style={row}><strong>Plan:</strong> {isYearly ? 'Yearly — $100 USD per year' : 'Monthly — $10 USD per month'}</Text>
            <Text style={row}><strong>Amount charged:</strong> {shownAmount} ({cadence})</Text>
            <Text style={row}>
              <strong>Renews:</strong> {isYearly ? 'automatically every year' : 'automatically every month'}
              {nextBillingDate ? ` — next charge on ${nextBillingDate}` : ''}
            </Text>
          </Section>

          <Text style={text}>
            Your subscription renews automatically until you cancel. You can change plans, update your card,
            view invoices, or cancel any time from your verification page.
          </Text>
          <Section><Button style={button} href={manageUrl}>Manage your verification →</Button></Section>

          <Hr style={hr} />
          <Text style={small}>
            Pricing: $10 USD per month, or $100 USD per year (two months free). Questions? Just reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Your verified organizer receipt — The Catholic Calendar',
  displayName: 'Verified organizer payment receipt',
  previewData: {
    orgName: 'St. Monica Youth Group',
    plan: 'yearly',
    amount: '$100.00 USD',
    nextBillingDate: 'August 23, 2027',
    manageUrl: 'https://thecatholiccalendar.org/catholic-calendar/subscribe',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', color: '#8b0000', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#1a1a1a', margin: '0 0 14px', lineHeight: '1.55' }
const box = { border: '1px solid #e6d9c2', backgroundColor: '#fffaf0', borderRadius: '8px', padding: '14px 16px', margin: '0 0 16px' }
const row = { fontSize: '14px', color: '#1a1a1a', margin: '0 0 6px', lineHeight: '1.5' }
const button = { backgroundColor: '#8b0000', color: '#fffaf0', padding: '12px 22px', borderRadius: '6px', textDecoration: 'none', fontWeight: 700, display: 'inline-block', marginTop: '4px' }
const hr = { borderColor: '#e6d9c2', margin: '20px 0' }
const small = { fontSize: '12px', color: '#6b6b6b', lineHeight: '1.5', margin: 0 }
