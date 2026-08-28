import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orgName?: string
  followerEmail?: string
}

const Email = ({ orgName = 'your organization', followerEmail = '' }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>You have a new follower on The Catholic Calendar</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You have a new follower! 🔔</Heading>
        <Text style={muted}>
          Someone just clicked <strong>Follow</strong> on <strong>{orgName}</strong>. From now on,
          every time you publish a new approved event, we'll email them automatically so they never
          miss what you're doing.
        </Text>
        <Section style={card}>
          <Text style={label}>Follower email</Text>
          <Text style={value}>{followerEmail}</Text>
          <Hr style={hr} />
          <Text style={label}>What happens next</Text>
          <Text style={value}>
            Publish an event as usual. When it's approved, we send an email to all of your followers
            with a link to the event page.
          </Text>
        </Section>
        <Text style={muted}>
          You're receiving this because someone chose to follow your organization on The Catholic
          Calendar.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `New follower for ${d?.orgName ?? 'your organization'}`,
  displayName: 'New organizer follower',
  previewData: {
    orgName: 'St. Mary Parish',
    followerEmail: 'visitor@example.com',
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
