import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  orgName?: string
  representativeName?: string
  locale?: string
}

const Email = ({ orgName = 'your organization', representativeName = '', locale = 'en' }: Props) => {
  const lang = locale.toLowerCase().startsWith('fr') ? 'fr' : locale.toLowerCase().startsWith('es') ? 'es' : 'en'
  const isFr = lang === 'fr'
  const copy = lang === 'es'
    ? {
      preview: `Recibimos tu solicitud de organizador — en revisión`,
      heading: `¡Gracias por tu solicitud!`,
      intro: representativeName
        ? `Hola ${representativeName}, recibimos la solicitud de ${orgName} para convertirse en organizador verificado en The Catholic Calendar.`
        : `Recibimos la solicitud de ${orgName} para convertirse en organizador verificado en The Catholic Calendar.`,
      review: `Un moderador revisará tu perfil en breve. Recibirás otro correo en cuanto tu cuenta de organizador sea aprobada — entonces podrás comenzar a publicar eventos.`,
      meantime: `Mientras tanto, puedes iniciar sesión y terminar de completar tu perfil de organizador.`,
    }
    : isFr
    ? {
      preview: `Nous avons reçu votre demande d'organisateur — examen en cours`,
      heading: `Merci pour votre demande !`,
      intro: representativeName
        ? `Bonjour ${representativeName}, nous avons reçu votre demande pour que ${orgName} devienne un organisateur vérifié sur Le Calendrier Catholique.`
        : `Nous avons reçu votre demande pour que ${orgName} devienne un organisateur vérifié sur Le Calendrier Catholique.`,
      review: `Un modérateur examinera votre profil sous peu. Vous recevrez un autre courriel dès que votre compte organisateur sera approuvé — vous pourrez alors commencer à proposer des événements.`,
      meantime: `En attendant, vous pouvez vous connecter et compléter votre profil d'organisateur.`,
    }
    : {
      preview: `We received your organizer application — review in progress`,
      heading: `Thanks for applying!`,
      intro: representativeName
        ? `Hi ${representativeName}, we received your application for ${orgName} to become a verified organizer on The Catholic Calendar.`
        : `We received your application for ${orgName} to become a verified organizer on The Catholic Calendar.`,
      review: `A moderator will review your profile shortly. You'll get another email as soon as your organizer account is approved — then you can start submitting events.`,
      meantime: `In the meantime, you can sign in and finish filling out your organizer profile.`,
    }

  return (
  <Html lang={lang}>
    <Head />
    <Preview>{copy.preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{copy.heading}</Heading>
        <Text style={text}>{copy.intro}</Text>
        <Section style={card}>
          <Text style={text}>{copy.review}</Text>
        </Section>
        <Hr style={hr} />
        <Text style={muted}>{copy.meantime}</Text>
      </Container>
    </Body>
  </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => d?.locale?.toLowerCase().startsWith('fr')
    ? `Nous avons reçu votre demande d'organisateur — Le Calendrier Catholique`
    : d?.locale?.toLowerCase().startsWith('es')
    ? `Recibimos tu solicitud de organizador — The Catholic Calendar`
    : `We received your organizer application — The Catholic Calendar`,
  displayName: 'Organizer · Application received',
  previewData: { orgName: 'St. Monica Youth Group', representativeName: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, serif', color: '#1a1a1a' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', color: '#8b0000', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#1a1a1a', margin: '0 0 14px', lineHeight: '1.55' }
const muted = { fontSize: '14px', color: '#666', margin: '0', lineHeight: '1.5' }
const card = { border: '1px solid #e5e0d4', borderRadius: '8px', padding: '20px', backgroundColor: '#fbf8f1' }
const hr = { borderColor: '#e5e0d4', margin: '20px 0' }
