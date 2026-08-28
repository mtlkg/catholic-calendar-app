import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  title?: string
  category?: string
  startAt?: string
  venue?: string
  description?: string
  submittedBy?: string
  submitterEmail?: string
  isFeatured?: boolean
  isVerified?: boolean
  adminUrl?: string
}

const Email = ({
  title = 'Untitled event',
  category = 'other',
  startAt = '',
  venue = '',
  description = '',
  submittedBy = 'Unknown',
  submitterEmail = '',
  isFeatured = false,
  isVerified = false,
  adminUrl = 'https://thecatholiccalendar.org/catholic-calendar/admin',
}: Props) => (
  <Html lang="en">
    <Head />
    <Preview>
      {isVerified ? `New event auto-published: ${title}` : `New event awaiting approval: ${title}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {isVerified ? 'New event published' : 'New event submitted'}
        </Heading>
        <Text style={muted}>
          {isVerified
            ? 'A verified organizer posted a new event on the Catholic Calendar. No approval needed — this is a heads-up.'
            : "A new event is waiting for your approval on the Catholic Calendar."}
        </Text>

        {isFeatured && (
          <Text style={featured}>★ Flagged as Big / Important</Text>
        )}

        <Section style={card}>
          <Text style={label}>Title</Text>
          <Text style={value}>{title}</Text>

          <Text style={label}>Category</Text>
          <Text style={value}>{category}</Text>

          {startAt && (<>
            <Text style={label}>When</Text>
            <Text style={value}>{startAt}</Text>
          </>)}

          {venue && (<>
            <Text style={label}>Where</Text>
            <Text style={value}>{venue}</Text>
          </>)}

          {description && (<>
            <Text style={label}>Description</Text>
            <Text style={value}>{description}</Text>
          </>)}

          <Hr style={hr} />

          <Text style={label}>Submitted by</Text>
          <Text style={value}>
            {submittedBy}{submitterEmail ? ` — ${submitterEmail}` : ''}
            {isVerified ? ' (verified organizer)' : ''}
          </Text>
        </Section>

        <Button style={button} href={adminUrl}>
          {isVerified ? 'View in Admin →' : 'Review in Admin →'}
        </Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => d?.isVerified
    ? `New event published: ${d?.title ?? 'Untitled'}`
    : `New event submission: ${d?.title ?? 'Untitled'}`,
  displayName: 'Admin · New event submitted',
  previewData: {
    title: 'Parish BBQ Fundraiser',
    category: 'fundraiser',
    startAt: 'July 12, 2026 · 5:00 PM',
    venue: 'St. Monica Parish Hall',
    description: 'Annual outdoor BBQ to support the youth ministry.',
    submittedBy: 'Jane Doe',
    submitterEmail: 'jane@example.com',
    isFeatured: true,
    adminUrl: 'https://thecatholiccalendar.org/catholic-calendar/admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', color: '#8b0000', margin: '0 0 8px' }
const muted = { fontSize: '14px', color: '#666', margin: '0 0 20px' }
const featured = { display: 'inline-block', backgroundColor: '#d4a017', color: '#1a1a1a', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, margin: '0 0 16px' }
const card = { border: '1px solid #e5e0d4', borderRadius: '8px', padding: '20px', backgroundColor: '#fbf8f1' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#8b0000', margin: '12px 0 2px', fontWeight: 700 }
const value = { fontSize: '15px', color: '#1a1a1a', margin: '0', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e5e0d4', margin: '16px 0' }
const button = { backgroundColor: '#8b0000', color: '#fffaf0', padding: '12px 22px', borderRadius: '6px', textDecoration: 'none', fontWeight: 700, display: 'inline-block', marginTop: '20px' }