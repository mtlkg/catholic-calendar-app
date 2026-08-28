import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orgName?: string
  parish?: string
  contactEmail?: string
  adminUrl?: string
}

const Email = ({
  orgName = 'Unnamed organization',
  parish = '',
  contactEmail = '',
  adminUrl = 'https://thecatholiccalendar.org/catholic-calendar/admin',
}: Props) => (
  <Html lang="en">
    <Head />
    <Preview>New organizer application: {orgName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New organizer application</Heading>
        <Text style={muted}>Someone signed up to become a verified organizer on the Catholic Calendar.</Text>

        <Section style={card}>
          <Text style={label}>Organization / Ministry</Text>
          <Text style={value}>{orgName}</Text>

          {parish && (<>
            <Text style={label}>Parish</Text>
            <Text style={value}>{parish}</Text>
          </>)}

          <Hr style={hr} />

          <Text style={label}>Contact email</Text>
          <Text style={value}>{contactEmail}</Text>
        </Section>

        <Button style={button} href={adminUrl}>Review in Admin →</Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `New organizer application: ${d?.orgName ?? 'Unnamed'}`,
  displayName: 'Admin · New organizer applied',
  previewData: {
    orgName: 'St. Joseph Young Adults',
    parish: 'St. Joseph Parish',
    contactEmail: 'leader@example.com',
    adminUrl: 'https://thecatholiccalendar.org/catholic-calendar/admin',
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