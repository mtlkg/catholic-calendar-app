import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  title?: string
  recipientName?: string
  discussionsUrl?: string
}

const Email = ({ title = 'Your discussion', recipientName = '', discussionsUrl = 'https://thecatholiccalendar.org/catholic-calendar/dashboard' }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>Your discussion thread was removed due to inactivity</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Discussion removed due to inactivity</Heading>
        <Text style={muted}>{recipientName ? `Hi ${recipientName}, ` : ''}your discussion thread had no activity for 60 days and has been automatically removed from the Catholic Calendar community board.</Text>
        <Section style={card}>
          <Text style={label}>Thread</Text>
          <Text style={value}>{title}</Text>
        </Section>
        <Text style={muted}>You're welcome to start a new thread anytime.</Text>
        <Button style={button} href={discussionsUrl}>Start a new discussion →</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Your discussion "${d?.title ?? 'thread'}" was removed due to inactivity`,
  displayName: 'Thread expired (inactivity)',
  previewData: {
    title: 'Looking for collaborators for Lent retreat',
    recipientName: 'Jane',
    discussionsUrl: 'https://thecatholiccalendar.org/catholic-calendar/dashboard',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', color: '#8b0000', margin: '0 0 8px' }
const muted = { fontSize: '14px', color: '#666', margin: '0 0 20px' }
const card = { border: '1px solid #e5e0d4', borderRadius: '8px', padding: '20px', backgroundColor: '#fbf8f1' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#8b0000', margin: '0 0 2px', fontWeight: 700 }
const value = { fontSize: '15px', color: '#1a1a1a', margin: '0', whiteSpace: 'pre-wrap' as const }
const button = { backgroundColor: '#8b0000', color: '#fffaf0', padding: '12px 22px', borderRadius: '6px', textDecoration: 'none', fontWeight: 700, display: 'inline-block', marginTop: '20px' }
