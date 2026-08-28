import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  kind?: 'dm' | 'thread_reply'
  senderName?: string
  threadTitle?: string
  excerpt?: string
  url?: string
  /** Number of messages/replies bundled into this notice (1 = single). */
  count?: number
  locale?: string
}

const langOf = (locale?: string): 'en' | 'fr' | 'es' => {
  const l = (locale ?? 'en').toLowerCase()
  if (l.startsWith('fr')) return 'fr'
  if (l.startsWith('es')) return 'es'
  return 'en'
}

const isFr = (locale?: string) => langOf(locale) === 'fr'
const isEs = (locale?: string) => langOf(locale) === 'es'

const COPY = {
  fr: {
    dmHeading: (n: number, who: string) => n > 1 ? `${n} nouveaux messages de ${who}` : `Nouveau message de ${who}`,
    thHeading: (n: number, who: string) => n > 1 ? `${n} nouvelles réponses à votre discussion` : `${who} a répondu à votre discussion`,
    dmIntro: (n: number) => n > 1
      ? "Voici un résumé de vos nouveaux messages sur The Catholic Calendar."
      : "Vous avez un nouveau message privé sur The Catholic Calendar.",
    thIntro: (n: number) => n > 1
      ? "Voici un résumé des nouvelles réponses à votre fil de discussion."
      : "Quelqu'un a répondu à votre fil sur The Catholic Calendar.",
    thread: 'Fil',
    from: 'De',
    latest: 'Dernier message',
    cta: (dm: boolean) => dm ? 'Ouvrir la conversation' : 'Voir les réponses',
    footer: "Nous regroupons ces avis pour éviter de vous envoyer trop de courriels. Vous pouvez changer la fréquence ou les désactiver dans votre tableau de bord, section Notifications.",
  },
  es: {
    dmHeading: (n: number, who: string) => n > 1 ? `${n} mensajes nuevos de ${who}` : `Nuevo mensaje de ${who}`,
    thHeading: (n: number, who: string) => n > 1 ? `${n} respuestas nuevas en tu conversación` : `${who} respondió a tu conversación`,
    dmIntro: (n: number) => n > 1
      ? 'Este es un resumen de tus nuevos mensajes directos en The Catholic Calendar.'
      : 'Tienes un nuevo mensaje directo en The Catholic Calendar.',
    thIntro: (n: number) => n > 1
      ? 'Este es un resumen de las nuevas respuestas en tu hilo.'
      : 'Alguien respondió a tu hilo en The Catholic Calendar.',
    thread: 'Hilo',
    from: 'De',
    latest: 'Último mensaje',
    cta: (dm: boolean) => dm ? 'Abrir la conversación' : 'Ver las respuestas',
    footer: 'Agrupamos estos avisos para no llenar tu bandeja de entrada. Puedes cambiar la frecuencia o desactivarlos en tu panel, en la sección Notificaciones.',
  },
  en: {
    dmHeading: (n: number, who: string) => n > 1 ? `${n} new messages from ${who}` : `New message from ${who}`,
    thHeading: (n: number, who: string) => n > 1 ? `${n} new replies on your discussion` : `${who} replied to your discussion`,
    dmIntro: (n: number) => n > 1
      ? 'Here is a summary of your new direct messages on The Catholic Calendar.'
      : 'You have a new direct message on The Catholic Calendar.',
    thIntro: (n: number) => n > 1
      ? 'Here is a summary of the new replies on your thread.'
      : 'Someone replied to your thread on The Catholic Calendar.',
    thread: 'Thread',
    from: 'From',
    latest: 'Latest message',
    cta: (dm: boolean) => dm ? 'Open the conversation' : 'View the replies',
    footer: 'We group these notices together so your inbox stays quiet. You can change the frequency or turn them off in your dashboard under Notifications.',
  },
}

const copy = (locale?: string) => COPY[langOf(locale)]


const Email = ({
  kind = 'dm',
  senderName = 'An organizer',
  threadTitle = '',
  excerpt = '',
  url = 'https://thecatholiccalendar.org/catholic-calendar/dashboard',
  count = 1,
  locale = 'en',
}: Props) => {
  const isDm = kind === 'dm'
  const n = Math.max(1, Number(count) || 1)
  const c = copy(locale)
  const heading = isDm ? c.dmHeading(n, senderName) : c.thHeading(n, senderName)
  return (
    <Html lang={langOf(locale)}>
      <Head />
      <Preview>{heading}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={muted}>{isDm ? c.dmIntro(n) : c.thIntro(n)}</Text>
          <Section style={card}>
            {!isDm && threadTitle && (
              <>
                <Text style={label}>{c.thread}</Text>
                <Text style={value}>{threadTitle}</Text>
              </>
            )}
            <Text style={label}>{c.from}</Text>
            <Text style={value}>{senderName}</Text>
            {excerpt && (
              <>
                <Text style={label}>{c.latest}</Text>
                <Text style={value}>{excerpt}</Text>
              </>
            )}
          </Section>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={url} style={btn}>{c.cta(isDm)}</Button>
          </Section>
          <Hr style={hr} />
          <Text style={muted}>{c.footer}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Props) => {
    const n = Math.max(1, Number(d?.count) || 1)
    const who = d?.senderName ?? 'an organizer'
    if (isFr(d?.locale)) {
      return d?.kind === 'thread_reply'
        ? (n > 1 ? `${n} nouvelles réponses à « ${d?.threadTitle ?? 'votre fil'} »` : `${who} a répondu à « ${d?.threadTitle ?? 'votre fil'} »`)
        : (n > 1 ? `${n} nouveaux messages de ${who}` : `Nouveau message de ${who}`)
    }
    if (isEs(d?.locale)) {
      return d?.kind === 'thread_reply'
        ? (n > 1 ? `${n} respuestas nuevas en «${d?.threadTitle ?? 'tu hilo'}»` : `${who} respondió a «${d?.threadTitle ?? 'tu hilo'}»`)
        : (n > 1 ? `${n} mensajes nuevos de ${who}` : `Nuevo mensaje de ${who}`)
    }

    return d?.kind === 'thread_reply'
      ? (n > 1 ? `${n} new replies on "${d?.threadTitle ?? 'your thread'}"` : `${who} replied to "${d?.threadTitle ?? 'your thread'}"`)
      : (n > 1 ? `${n} new messages from ${who}` : `New message from ${who}`)
  },
  displayName: 'New message or thread reply',
  previewData: {
    kind: 'dm',
    senderName: 'St. Mary Parish',
    excerpt: 'Would you be open to co-hosting the youth retreat?',
    count: 3,
    url: 'https://thecatholiccalendar.org/catholic-calendar/dashboard?tab=messages',
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
