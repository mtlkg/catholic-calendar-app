import type { ComponentType } from 'npm:react@18.3.1'
import { template as eventSubmitted } from './admin-event-submitted.tsx'
import { template as organizerApplied } from './admin-organizer-applied.tsx'
import { template as eventApproved } from './event-approved.tsx'
import { template as organizerApproved } from './organizer-approved.tsx'
import { template as eventSubmissionReceived } from './event-submission-received.tsx'
import { template as organizerApplicationReceived } from './organizer-application-received.tsx'
import { template as threadExpired } from './thread-expired.tsx'
import { template as eventReminder } from './event-reminder.tsx'
import { template as organizerNewInterest } from './organizer-new-interest.tsx'
import { template as organizerNewFollower } from './organizer-new-follower.tsx'
import { template as followerNewEvent } from './follower-new-event.tsx'
import { template as conversationNotification } from './conversation-notification.tsx'
import { template as verifiedPaymentReceipt } from './verified-payment-receipt.tsx'



export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'admin-event-submitted': eventSubmitted,
  'admin-organizer-applied': organizerApplied,
  'event-approved': eventApproved,
  'organizer-approved': organizerApproved,
  'event-submission-received': eventSubmissionReceived,
  'organizer-application-received': organizerApplicationReceived,
  'thread-expired': threadExpired,
  'event-reminder': eventReminder,
  'organizer-new-interest': organizerNewInterest,
  'organizer-new-follower': organizerNewFollower,
  'follower-new-event': followerNewEvent,
  'conversation-notification': conversationNotification,
  'verified-payment-receipt': verifiedPaymentReceipt,
}