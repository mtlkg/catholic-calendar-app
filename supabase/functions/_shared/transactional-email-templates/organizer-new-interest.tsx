import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  eventTitle?: string
  interestedEmail?: string
  startAt?: string
}

const Email = ({ eventTitle = 'your event', interestedEmail = '', startAt = '' }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>Someone is interested in {eventTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Someone's interested! 🎉</Heading>
        <Text style={muted}>
          A visitor on The Catholic Calendar marked themselves interested in your event.
          We'll send them an automatic reminder before it starts — you can also follow up directly using the email below.
        </Text>
        <Section style={card}>
          <Text style={label}>Event</Text>
          <Text style={value}>{eventTitle}</Text>
          {startAt && (<><Text style={label}>When</Text><Text style={value}>{startAt}</Text></>)}
          <Hr style={hr} />
          <Text style={label}>Interested guest's email</Text>
          <Text style={value}>{interestedEmail}</Text>
        </Section>
        <Text style={muted}>
          You're receiving this because you submitted this event. The guest agreed to share their email when they tapped "Interested".
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `New interest in ${d?.eventTitle ?? 'your event'}`,
  displayName: 'New event interest',
  previewData: {
    eventTitle: 'Parish BBQ Fundraiser',
    interestedEmail: 'visitor@example.com',
    startAt: 'Saturday · 5:00 PM',
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
