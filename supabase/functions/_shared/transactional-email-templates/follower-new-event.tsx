import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orgName?: string
  eventTitle?: string
  startAt?: string
  venue?: string
  eventUrl?: string
}

const Email = ({
  orgName = 'An organizer you follow',
  eventTitle = 'A new event',
  startAt = '',
  venue = '',
  eventUrl = 'https://thecatholiccalendar.org/catholic-calendar',
}: Props) => (
  <Html lang="en">
    <Head />
    <Preview>{orgName} just published: {eventTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{orgName} just added a new event</Heading>
        <Text style={muted}>
          You're following <strong>{orgName}</strong> on The Catholic Calendar, so we're letting
          you know they just published something new.
        </Text>
        <Section style={card}>
          <Text style={label}>Event</Text>
          <Text style={value}>{eventTitle}</Text>
          {startAt && (<><Text style={label}>When</Text><Text style={value}>{startAt}</Text></>)}
          {venue && (<><Text style={label}>Where</Text><Text style={value}>{venue}</Text></>)}
        </Section>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={eventUrl} style={btn}>View event details</Button>
        </Section>
        <Hr style={hr} />
        <Text style={muted}>
          You're receiving this because you followed {orgName} on The Catholic Calendar. You can
          unsubscribe using the link below to stop these updates.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `${d?.orgName ?? 'An organizer you follow'} added: ${d?.eventTitle ?? 'a new event'}`,
  displayName: 'New event from a followed organizer',
  previewData: {
    orgName: 'St. Mary Parish',
    eventTitle: 'Advent Adoration Night',
    startAt: 'Friday, December 5 · 7:00 PM',
    venue: 'St. Mary Church',
    eventUrl: 'https://thecatholiccalendar.org/catholic-calendar/event/example',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', color: '#8b0000', margin: '0 0 8px' }
const muted = { fontSize: '14px', color: '#666', margin: '0 0 20px' }
const card = { border: '1px solid #e5e0d4', borderRadius: '8px', padding: '20px', backgroundColor: '#fbf8f1' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#8b0000', margin: '12px 0 2px', fontWeight: 700 }
const value = { fontSize: '15px', color: '#1a1a1a', margin: '0', whiteSpace: 'pre-wrap' as const }
const btn = { backgroundColor: '#8b0000', color: '#fbf8f1', padding: '12px 28px', borderRadius: '6px', textDecoration: 'none', fontWeight: 700, fontSize: '14px' }
const hr = { borderColor: '#e5e0d4', margin: '16px 0' }
