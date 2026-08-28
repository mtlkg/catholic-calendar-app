import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  submitterName?: string
  title?: string
  startAt?: string
  venue?: string
  calendarUrl?: string
  locale?: string
  isVerified?: boolean
}

const Email = ({
  submitterName = 'there',
  title = 'your event',
  startAt = '',
  venue = '',
  calendarUrl = 'https://thecatholiccalendar.org/catholic-calendar',
  locale = 'en',
  isVerified = false,
}: Props) => {
  const lang = locale.toLowerCase().startsWith('fr') ? 'fr' : locale.toLowerCase().startsWith('es') ? 'es' : 'en'
  const isFr = lang === 'fr'
  const copy = lang === 'es'
    ? {
      preview: `Recibimos tu evento: ${title}`,
      heading: `¡Gracias, ${submitterName}!`,
      introVerified: `Gracias por enviar tu evento a The Catholic Calendar. Como organizador verificado, ya está publicado en el calendario.`,
      introGuest: `Recibimos tu propuesta de evento para The Catholic Calendar. Un moderador la revisará en breve y recibirás otro correo en cuanto sea aprobada.`,
      event: 'Evento',
      when: 'Cuándo',
      where: 'Dónde',
      calendar: 'Puedes consultar el calendario público en cualquier momento en',
    }
    : isFr
    ? {
      preview: `Nous avons reçu votre événement : ${title}`,
      heading: `Merci, ${submitterName} !`,
      introVerified: `Merci d'avoir soumis votre événement au Calendrier Catholique. En tant qu'organisateur vérifié, il est maintenant en ligne sur le calendrier.`,
      introGuest: `Nous avons bien reçu votre proposition d'événement pour le Calendrier Catholique. Un modérateur l'examinera sous peu, et vous recevrez un autre courriel dès qu'il sera approuvé.`,
      event: 'Événement',
      when: 'Quand',
      where: 'Où',
      calendar: 'Vous pouvez consulter le calendrier public à tout moment :',
    }
    : {
      preview: `We received your event submission: ${title}`,
      heading: `Thanks, ${submitterName}!`,
      introVerified: `Thank you for submitting your event to the Catholic Calendar. As a verified organizer, it's now live on the calendar.`,
      introGuest: `We received your event submission for the Catholic Calendar. A moderator will review it shortly, and you'll get another email as soon as it's approved.`,
      event: 'Event',
      when: 'When',
      where: 'Where',
      calendar: 'You can view the public calendar any time at',
    }

  const intro = isVerified ? copy.introVerified : copy.introGuest

  return (
  <Html lang={lang}>
    <Head />
    <Preview>{copy.preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={muted}>{intro}</Text>

        <Section style={card}>
          <Text style={label}>{copy.event}</Text>
          <Text style={value}>{title}</Text>

          {startAt && (<>
            <Text style={label}>{copy.when}</Text>
            <Text style={value}>{startAt}</Text>
          </>)}

          {venue && (<>
            <Text style={label}>{copy.where}</Text>
            <Text style={value}>{venue}</Text>
          </>)}
        </Section>

        <Hr style={hr} />
        <Text style={muted}>
          {copy.calendar}{' '}
          <a href={calendarUrl} style={link}>{calendarUrl}</a>.
        </Text>
      </Container>
    </Body>
  </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => d?.locale?.toLowerCase().startsWith('fr')
    ? `Nous avons reçu votre événement : ${d?.title ?? 'soumission'}`
    : d?.locale?.toLowerCase().startsWith('es')
    ? `Recibimos tu evento: ${d?.title ?? 'propuesta'}`
    : `We received your event: ${d?.title ?? 'submission'}`,
  displayName: 'Submitter · Event received',
  previewData: {
    submitterName: 'Jane',
    title: 'Parish BBQ Fundraiser',
    startAt: 'July 12, 2026 · 5:00 PM',
    venue: 'St. Monica Parish Hall',
    calendarUrl: 'https://thecatholiccalendar.org/catholic-calendar',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', color: '#8b0000', margin: '0 0 8px' }
const muted = { fontSize: '14px', color: '#666', margin: '0 0 16px', lineHeight: '1.5' }
const card = { border: '1px solid #e5e0d4', borderRadius: '8px', padding: '20px', backgroundColor: '#fbf8f1' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#8b0000', margin: '12px 0 2px', fontWeight: 700 }
const value = { fontSize: '15px', color: '#1a1a1a', margin: '0', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e5e0d4', margin: '20px 0' }
const link = { color: '#8b0000', textDecoration: 'underline' }