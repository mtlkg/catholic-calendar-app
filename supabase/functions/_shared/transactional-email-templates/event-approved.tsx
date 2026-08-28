import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  title?: string
  startAt?: string
  venue?: string
  eventUrl?: string
  recipientName?: string
}

const Email = ({ title = 'Your event', startAt = '', venue = '', eventUrl = 'https://thecatholiccalendar.org/catholic-calendar', recipientName = '' }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>Your event "{title}" has been approved</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your event is live! 🎉</Heading>
        <Text style={muted}>{recipientName ? `Hi ${recipientName}, ` : ''}Great news — your submission has been approved and is now published on the The Catholic Calendar Catholic Calendar.</Text>
        <Section style={card}>
          <Text style={label}>Event</Text>
          <Text style={value}>{title}</Text>
          {startAt && (<><Text style={label}>When</Text><Text style={value}>{startAt}</Text></>)}
          {venue && (<><Text style={label}>Where</Text><Text style={value}>{venue}</Text></>)}
          <Hr style={hr} />
          <Text style={muted}>Thank you for sharing your event with the community.</Text>
        </Section>
        <Button style={button} href={eventUrl}>View on the Calendar →</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Approved: ${d?.title ?? 'Your event'} is live on the Catholic Calendar`,
  displayName: 'Event approved',
  previewData: {
    title: 'Parish BBQ Fundraiser',
    startAt: 'July 12, 2026 · 5:00 PM',
    venue: 'St. Monica Parish Hall',
    eventUrl: 'https://thecatholiccalendar.org/catholic-calendar',
    recipientName: 'Jane',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', color: '#8b0000', margin: '0 0 8px' }
const muted = { fontSize: '14px', color: '#666', margin: '0 0 20px' }
const card = { border: '1px solid #e5e0d4', borderRadius: '8px', padding: '20px', backgroundColor: '#fbf8f1' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#8b0000', margin: '12px 0 2px', fontWeight: 700 }
const value = { fontSize: '15px', color: '#1a1a1a', margin: '0', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e5e0d4', margin: '16px 0' }
const button = { backgroundColor: '#8b0000', color: '#fffaf0', padding: '12px 22px', borderRadius: '6px', textDecoration: 'none', fontWeight: 700, display: 'inline-block', marginTop: '20px' }
