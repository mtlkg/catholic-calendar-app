export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admission_inventory: {
        Row: {
          id: number
          total_available: number
          total_sold: number
        }
        Insert: {
          id?: number
          total_available?: number
          total_sold?: number
        }
        Update: {
          id?: number
          total_available?: number
          total_sold?: number
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          address: string | null
          all_day: boolean
          audience_countries: string[]
          audience_diocese_slugs: string[]
          audience_scope: string
          category: Database["public"]["Enums"]["event_category"]
          category_other: string | null
          created_at: string
          description: string | null
          diocese_slug: string | null
          end_at: string | null
          event_language: string | null
          event_languages: string[] | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_featured: boolean
          is_free: boolean
          latitude: number | null
          longitude: number | null
          parish: string | null
          poster_url: string | null
          price_note: string | null
          recurrence_group_id: string | null
          registration_url: string | null
          rejection_reason: string | null
          start_at: string
          status: Database["public"]["Enums"]["event_status"]
          submitted_by_user_id: string | null
          title: string
          updated_at: string
          venue_name: string | null
          video_url: string | null
        }
        Insert: {
          address?: string | null
          all_day?: boolean
          audience_countries?: string[]
          audience_diocese_slugs?: string[]
          audience_scope?: string
          category?: Database["public"]["Enums"]["event_category"]
          category_other?: string | null
          created_at?: string
          description?: string | null
          diocese_slug?: string | null
          end_at?: string | null
          event_language?: string | null
          event_languages?: string[] | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_featured?: boolean
          is_free?: boolean
          latitude?: number | null
          longitude?: number | null
          parish?: string | null
          poster_url?: string | null
          price_note?: string | null
          recurrence_group_id?: string | null
          registration_url?: string | null
          rejection_reason?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["event_status"]
          submitted_by_user_id?: string | null
          title: string
          updated_at?: string
          venue_name?: string | null
          video_url?: string | null
        }
        Update: {
          address?: string | null
          all_day?: boolean
          audience_countries?: string[]
          audience_diocese_slugs?: string[]
          audience_scope?: string
          category?: Database["public"]["Enums"]["event_category"]
          category_other?: string | null
          created_at?: string
          description?: string | null
          diocese_slug?: string | null
          end_at?: string | null
          event_language?: string | null
          event_languages?: string[] | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_featured?: boolean
          is_free?: boolean
          latitude?: number | null
          longitude?: number | null
          parish?: string | null
          poster_url?: string | null
          price_note?: string | null
          recurrence_group_id?: string | null
          registration_url?: string | null
          rejection_reason?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          submitted_by_user_id?: string | null
          title?: string
          updated_at?: string
          venue_name?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_diocese_slug_fkey"
            columns: ["diocese_slug"]
            isOneToOne: false
            referencedRelation: "dioceses"
            referencedColumns: ["slug"]
          },
        ]
      }
      dinner_rsvps: {
        Row: {
          additional_guests: number
          additional_pizza_guests: number
          attendance: string
          created_at: string
          dietary_notes: string | null
          id: string
          name: string
          status: string
          stripe_session_id: string | null
          total_amount: number
        }
        Insert: {
          additional_guests?: number
          additional_pizza_guests?: number
          attendance: string
          created_at?: string
          dietary_notes?: string | null
          id?: string
          name: string
          status?: string
          stripe_session_id?: string | null
          total_amount?: number
        }
        Update: {
          additional_guests?: number
          additional_pizza_guests?: number
          attendance?: string
          created_at?: string
          dietary_notes?: string | null
          id?: string
          name?: string
          status?: string
          stripe_session_id?: string | null
          total_amount?: number
        }
        Relationships: []
      }
      dioceses: {
        Row: {
          lat: number
          lng: number
          national: boolean
          slug: string
        }
        Insert: {
          lat: number
          lng: number
          national?: boolean
          slug: string
        }
        Update: {
          lat?: number
          lng?: number
          national?: boolean
          slug?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          attachments: Json
          body: string | null
          created_at: string
          diocese_slug: string | null
          id: string
          read_at: string | null
          recipient_user_id: string
          reply_to_id: string | null
          sender_user_id: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          created_at?: string
          diocese_slug?: string | null
          id?: string
          read_at?: string | null
          recipient_user_id: string
          reply_to_id?: string | null
          sender_user_id: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          created_at?: string
          diocese_slug?: string | null
          id?: string
          read_at?: string | null
          recipient_user_id?: string
          reply_to_id?: string | null
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_diocese_slug_fkey"
            columns: ["diocese_slug"]
            isOneToOne: false
            referencedRelation: "dioceses"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "direct_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          attachments: Json
          author_user_id: string
          body: string | null
          created_at: string
          id: string
          reply_to_id: string | null
          thread_id: string
        }
        Insert: {
          attachments?: Json
          author_user_id: string
          body?: string | null
          created_at?: string
          id?: string
          reply_to_id?: string | null
          thread_id: string
        }
        Update: {
          attachments?: Json
          author_user_id?: string
          body?: string | null
          created_at?: string
          id?: string
          reply_to_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "discussion_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_replies_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "discussion_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_threads: {
        Row: {
          author_user_id: string
          body: string
          category: Database["public"]["Enums"]["thread_category"]
          created_at: string
          diocese_slug: string | null
          id: string
          last_activity_at: string
          locked: boolean
          pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body: string
          category?: Database["public"]["Enums"]["thread_category"]
          created_at?: string
          diocese_slug?: string | null
          id?: string
          last_activity_at?: string
          locked?: boolean
          pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          category?: Database["public"]["Enums"]["thread_category"]
          created_at?: string
          diocese_slug?: string | null
          id?: string
          last_activity_at?: string
          locked?: boolean
          pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_threads_diocese_slug_fkey"
            columns: ["diocese_slug"]
            isOneToOne: false
            referencedRelation: "dioceses"
            referencedColumns: ["slug"]
          },
        ]
      }
      dm_conversation_state: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          last_read_at: string
          peer_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_read_at?: string
          peer_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_read_at?: string
          peer_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dm_group_activity: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          detail: Json
          group_id: string
          group_name: string | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          group_id: string
          group_name?: string | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          group_id?: string
          group_name?: string | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      dm_group_members: {
        Row: {
          group_id: string
          joined_at: string
          last_read_at: string
          muted: boolean
          role: Database["public"]["Enums"]["dm_group_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["dm_group_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          last_read_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["dm_group_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "dm_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_group_messages: {
        Row: {
          attachments: Json
          body: string | null
          created_at: string
          group_id: string
          id: string
          sender_user_id: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          created_at?: string
          group_id: string
          id?: string
          sender_user_id: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          created_at?: string
          group_id?: string
          id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "dm_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_groups: {
        Row: {
          created_at: string
          created_by: string
          diocese_slug: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          diocese_slug?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          diocese_slug?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_groups_diocese_slug_fkey"
            columns: ["diocese_slug"]
            isOneToOne: false
            referencedRelation: "dioceses"
            referencedColumns: ["slug"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_interests: {
        Row: {
          created_at: string
          email: string
          event_id: string
          id: string
          locale: string
          organizer_notified_at: string | null
          phone_e164: string | null
          push_endpoint: string | null
          reminder_sent_at: string | null
          sms_opt_in: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          event_id: string
          id?: string
          locale?: string
          organizer_notified_at?: string | null
          phone_e164?: string | null
          push_endpoint?: string | null
          reminder_sent_at?: string | null
          sms_opt_in?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          locale?: string
          organizer_notified_at?: string | null
          phone_e164?: string | null
          push_endpoint?: string | null
          reminder_sent_at?: string | null
          sms_opt_in?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_interests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_interests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_slots: {
        Row: {
          amount_cents: number
          created_at: string | null
          event_id: string
          id: string
          rank: number
          refunded_at: string | null
          slot_date: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          event_id: string
          id?: string
          rank: number
          refunded_at?: string | null
          slot_date: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          event_id?: string
          id?: string
          rank?: number
          refunded_at?: string | null
          slot_date?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_raffle_items: {
        Row: {
          created_at: string
          description: string | null
          description_fr: string | null
          id: string
          image_url: string | null
          name: string
          name_fr: string | null
          website_url: string | null
          website_urls: string[] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_fr?: string | null
          id?: string
          image_url?: string | null
          name: string
          name_fr?: string | null
          website_url?: string | null
          website_urls?: string[] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          description_fr?: string | null
          id?: string
          image_url?: string | null
          name?: string
          name_fr?: string | null
          website_url?: string | null
          website_urls?: string[] | null
        }
        Relationships: []
      }
      grand_prize_inventory: {
        Row: {
          id: number
          total_available: number
          total_sold: number
        }
        Insert: {
          id?: number
          total_available?: number
          total_sold?: number
        }
        Update: {
          id?: number
          total_available?: number
          total_sold?: number
        }
        Relationships: []
      }
      merchandise: {
        Row: {
          created_at: string
          external_url: string
          id: string
          image_url: string | null
          name: string
          price: string
        }
        Insert: {
          created_at?: string
          external_url: string
          id?: string
          image_url?: string | null
          name: string
          price: string
        }
        Update: {
          created_at?: string
          external_url?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: string
        }
        Relationships: []
      }
      notification_digest_state: {
        Row: {
          channel: string
          created_at: string
          id: string
          kind: string
          last_emailed_at: string | null
          last_excerpt: string | null
          last_sender_name: string | null
          last_thread_title: string | null
          last_url: string | null
          pending_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          kind: string
          last_emailed_at?: string | null
          last_excerpt?: string | null
          last_sender_name?: string | null
          last_thread_title?: string | null
          last_url?: string | null
          pending_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          kind?: string
          last_emailed_at?: string | null
          last_excerpt?: string | null
          last_sender_name?: string | null
          last_thread_title?: string | null
          last_url?: string | null
          pending_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          created_at: string
          email_dm: boolean
          email_dm_frequency: string
          email_event_reminder: boolean
          email_follow_new_event: boolean
          email_thread_reply: boolean
          email_thread_reply_frequency: string
          locale: string
          phone_e164: string | null
          phone_verified_at: string | null
          push_dm: boolean
          push_event_reminder: boolean
          push_follow_new_event: boolean
          push_thread_reply: boolean
          sms_dm: boolean
          sms_event_reminder: boolean
          sms_follow_new_event: boolean
          sms_thread_reply: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_dm?: boolean
          email_dm_frequency?: string
          email_event_reminder?: boolean
          email_follow_new_event?: boolean
          email_thread_reply?: boolean
          email_thread_reply_frequency?: string
          locale?: string
          phone_e164?: string | null
          phone_verified_at?: string | null
          push_dm?: boolean
          push_event_reminder?: boolean
          push_follow_new_event?: boolean
          push_thread_reply?: boolean
          sms_dm?: boolean
          sms_event_reminder?: boolean
          sms_follow_new_event?: boolean
          sms_thread_reply?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_dm?: boolean
          email_dm_frequency?: string
          email_event_reminder?: boolean
          email_follow_new_event?: boolean
          email_thread_reply?: boolean
          email_thread_reply_frequency?: string
          locale?: string
          phone_e164?: string | null
          phone_verified_at?: string | null
          push_dm?: boolean
          push_event_reminder?: boolean
          push_follow_new_event?: boolean
          push_thread_reply?: boolean
          sms_dm?: boolean
          sms_event_reminder?: boolean
          sms_follow_new_event?: boolean
          sms_thread_reply?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          bucket_allocations: Json | null
          created_at: string
          customer_address: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          dropped_in_box: boolean
          id: string
          item_id: string | null
          order_type: string
          payment_method: string | null
          quantity: number
          status: string
          stripe_session_id: string | null
          total_amount: number
        }
        Insert: {
          bucket_allocations?: Json | null
          created_at?: string
          customer_address?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          dropped_in_box?: boolean
          id?: string
          item_id?: string | null
          order_type: string
          payment_method?: string | null
          quantity?: number
          status?: string
          stripe_session_id?: string | null
          total_amount: number
        }
        Update: {
          bucket_allocations?: Json | null
          created_at?: string
          customer_address?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          dropped_in_box?: boolean
          id?: string
          item_id?: string | null
          order_type?: string
          payment_method?: string | null
          quantity?: number
          status?: string
          stripe_session_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "gift_raffle_items"
            referencedColumns: ["id"]
          },
        ]
      }
      organizer_follows: {
        Row: {
          created_at: string
          follower_email: string
          follower_user_id: string | null
          id: string
          locale: string
          organizer_user_id: string
          phone_e164: string | null
          push_endpoint: string | null
          sms_opt_in: boolean
        }
        Insert: {
          created_at?: string
          follower_email: string
          follower_user_id?: string | null
          id?: string
          locale?: string
          organizer_user_id: string
          phone_e164?: string | null
          push_endpoint?: string | null
          sms_opt_in?: boolean
        }
        Update: {
          created_at?: string
          follower_email?: string
          follower_user_id?: string | null
          id?: string
          locale?: string
          organizer_user_id?: string
          phone_e164?: string | null
          push_endpoint?: string | null
          sms_opt_in?: boolean
        }
        Relationships: []
      }
      organizer_profiles: {
        Row: {
          address: string | null
          categories: string[]
          categories_other: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          diocese_slug: string | null
          diocese_slugs: string[]
          free_submissions_used: number
          id: string
          logo_url: string | null
          org_name: string | null
          paid_submissions_remaining: number
          parish: string | null
          representative_name: string | null
          status: Database["public"]["Enums"]["organizer_status"]
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          categories?: string[]
          categories_other?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          diocese_slug?: string | null
          diocese_slugs?: string[]
          free_submissions_used?: number
          id?: string
          logo_url?: string | null
          org_name?: string | null
          paid_submissions_remaining?: number
          parish?: string | null
          representative_name?: string | null
          status?: Database["public"]["Enums"]["organizer_status"]
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          categories?: string[]
          categories_other?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          diocese_slug?: string | null
          diocese_slugs?: string[]
          free_submissions_used?: number
          id?: string
          logo_url?: string | null
          org_name?: string | null
          paid_submissions_remaining?: number
          parish?: string | null
          representative_name?: string | null
          status?: Database["public"]["Enums"]["organizer_status"]
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizer_profiles_diocese_slug_fkey"
            columns: ["diocese_slug"]
            isOneToOne: false
            referencedRelation: "dioceses"
            referencedColumns: ["slug"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone_e164: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone_e164: string
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone_e164?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          locale: string
          p256dh: string
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          locale?: string
          p256dh: string
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          locale?: string
          p256dh?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sms_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_sid: string | null
          metadata: Json | null
          recipient_phone: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_sid?: string | null
          metadata?: Json | null
          recipient_phone: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_sid?: string | null
          metadata?: Json | null
          recipient_phone?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      sms_suppressions: {
        Row: {
          created_at: string
          id: string
          phone_e164: string
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          phone_e164: string
          reason?: string
        }
        Update: {
          created_at?: string
          id?: string
          phone_e164?: string
          reason?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          name_fr: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          name_fr?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          name_fr?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      thread_pins: {
        Row: {
          created_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_pins_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "discussion_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          order_id: string
          ticket_code: string
          ticket_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          order_id: string
          ticket_code: string
          ticket_type: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          order_id?: string
          ticket_code?: string
          ticket_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      calendar_events_public: {
        Row: {
          address: string | null
          all_day: boolean | null
          audience_countries: string[] | null
          audience_diocese_slugs: string[] | null
          audience_scope: string | null
          category: Database["public"]["Enums"]["event_category"] | null
          category_other: string | null
          created_at: string | null
          description: string | null
          diocese_slug: string | null
          end_at: string | null
          event_language: string | null
          event_languages: string[] | null
          id: string | null
          is_featured: boolean | null
          is_free: boolean | null
          latitude: number | null
          longitude: number | null
          parish: string | null
          poster_url: string | null
          price_note: string | null
          registration_url: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["event_status"] | null
          submitted_by_user_id: string | null
          title: string | null
          updated_at: string | null
          venue_name: string | null
          video_url: string | null
        }
        Insert: {
          address?: string | null
          all_day?: boolean | null
          audience_countries?: string[] | null
          audience_diocese_slugs?: string[] | null
          audience_scope?: string | null
          category?: Database["public"]["Enums"]["event_category"] | null
          category_other?: string | null
          created_at?: string | null
          description?: string | null
          diocese_slug?: string | null
          end_at?: string | null
          event_language?: string | null
          event_languages?: string[] | null
          id?: string | null
          is_featured?: boolean | null
          is_free?: boolean | null
          latitude?: number | null
          longitude?: number | null
          parish?: string | null
          poster_url?: string | null
          price_note?: string | null
          registration_url?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["event_status"] | null
          submitted_by_user_id?: string | null
          title?: string | null
          updated_at?: string | null
          venue_name?: string | null
          video_url?: string | null
        }
        Update: {
          address?: string | null
          all_day?: boolean | null
          audience_countries?: string[] | null
          audience_diocese_slugs?: string[] | null
          audience_scope?: string | null
          category?: Database["public"]["Enums"]["event_category"] | null
          category_other?: string | null
          created_at?: string | null
          description?: string | null
          diocese_slug?: string | null
          end_at?: string | null
          event_language?: string | null
          event_languages?: string[] | null
          id?: string | null
          is_featured?: boolean | null
          is_free?: boolean | null
          latitude?: number | null
          longitude?: number | null
          parish?: string | null
          poster_url?: string | null
          price_note?: string | null
          registration_url?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["event_status"] | null
          submitted_by_user_id?: string | null
          title?: string | null
          updated_at?: string | null
          venue_name?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_diocese_slug_fkey"
            columns: ["diocese_slug"]
            isOneToOne: false
            referencedRelation: "dioceses"
            referencedColumns: ["slug"]
          },
        ]
      }
      organizer_profiles_public: {
        Row: {
          categories: string[] | null
          created_at: string | null
          description: string | null
          diocese_slug: string | null
          diocese_slugs: string[] | null
          id: string | null
          logo_url: string | null
          org_name: string | null
          parish: string | null
          status: Database["public"]["Enums"]["organizer_status"] | null
          updated_at: string | null
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          diocese_slug?: string | null
          diocese_slugs?: string[] | null
          id?: string | null
          logo_url?: string | null
          org_name?: string | null
          parish?: string | null
          status?: Database["public"]["Enums"]["organizer_status"] | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          diocese_slug?: string | null
          diocese_slugs?: string[] | null
          id?: string | null
          logo_url?: string | null
          org_name?: string | null
          parish?: string | null
          status?: Database["public"]["Enums"]["organizer_status"] | null
          updated_at?: string | null
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizer_profiles_diocese_slug_fkey"
            columns: ["diocese_slug"]
            isOneToOne: false
            referencedRelation: "dioceses"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Functions: {
      admin_get_organizer_contacts: {
        Args: { _user_ids: string[] }
        Returns: {
          address: string
          contact_email: string
          contact_phone: string
          org_name: string
          user_id: string
        }[]
      }
      admin_list_events: {
        Args: { _status?: string }
        Returns: {
          address: string | null
          all_day: boolean
          audience_countries: string[]
          audience_diocese_slugs: string[]
          audience_scope: string
          category: Database["public"]["Enums"]["event_category"]
          category_other: string | null
          created_at: string
          description: string | null
          diocese_slug: string | null
          end_at: string | null
          event_language: string | null
          event_languages: string[] | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_featured: boolean
          is_free: boolean
          latitude: number | null
          longitude: number | null
          parish: string | null
          poster_url: string | null
          price_note: string | null
          recurrence_group_id: string | null
          registration_url: string | null
          rejection_reason: string | null
          start_at: string
          status: Database["public"]["Enums"]["event_status"]
          submitted_by_user_id: string | null
          title: string
          updated_at: string
          venue_name: string | null
          video_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_organizer_profiles: {
        Args: never
        Returns: {
          address: string | null
          categories: string[]
          categories_other: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          diocese_slug: string | null
          diocese_slugs: string[]
          free_submissions_used: number
          id: string
          logo_url: string | null
          org_name: string | null
          paid_submissions_remaining: number
          parish: string | null
          representative_name: string | null
          status: Database["public"]["Enums"]["organizer_status"]
          updated_at: string
          user_id: string
          website_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "organizer_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_stats: { Args: { _diocese_slugs?: string[] }; Returns: Json }
      admin_update_event: {
        Args: { _event_id: string; _patch: Json }
        Returns: {
          address: string | null
          all_day: boolean
          audience_countries: string[]
          audience_diocese_slugs: string[]
          audience_scope: string
          category: Database["public"]["Enums"]["event_category"]
          category_other: string | null
          created_at: string
          description: string | null
          diocese_slug: string | null
          end_at: string | null
          event_language: string | null
          event_languages: string[] | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_featured: boolean
          is_free: boolean
          latitude: number | null
          longitude: number | null
          parish: string | null
          poster_url: string | null
          price_note: string | null
          recurrence_group_id: string | null
          registration_url: string | null
          rejection_reason: string | null
          start_at: string
          status: Database["public"]["Enums"]["event_status"]
          submitted_by_user_id: string | null
          title: string
          updated_at: string
          venue_name: string | null
          video_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_organizer: {
        Args: { _patch: Json; _user_id: string }
        Returns: {
          address: string | null
          categories: string[]
          categories_other: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          diocese_slug: string | null
          diocese_slugs: string[]
          free_submissions_used: number
          id: string
          logo_url: string | null
          org_name: string | null
          paid_submissions_remaining: number
          parish: string | null
          representative_name: string | null
          status: Database["public"]["Enums"]["organizer_status"]
          updated_at: string
          user_id: string
          website_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizer_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_read_chat_file: { Args: { _name: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_my_event_series: {
        Args: { _recurrence_group_id: string }
        Returns: number
      }
      delete_push_subscription: {
        Args: { _endpoint: string }
        Returns: undefined
      }
      dispatch_event_reminders: { Args: never; Returns: undefined }
      dm_group_role_of: {
        Args: { _group_id: string; _user_id: string }
        Returns: string
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      free_submissions_used: {
        Args: { _email: string; _phone: string; _user_id: string }
        Returns: number
      }
      get_my_organizer_profile: {
        Args: never
        Returns: {
          address: string | null
          categories: string[]
          categories_other: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          diocese_slug: string | null
          diocese_slugs: string[]
          free_submissions_used: number
          id: string
          logo_url: string | null
          org_name: string | null
          paid_submissions_remaining: number
          parish: string | null
          representative_name: string | null
          status: Database["public"]["Enums"]["organizer_status"]
          updated_at: string
          user_id: string
          website_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "organizer_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_organizer: { Args: { _user_id: string }; Returns: boolean }
      is_dm_group_manager: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_dm_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_dm_group_owner: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_paying_verified: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_events: {
        Args: never
        Returns: {
          address: string | null
          all_day: boolean
          audience_countries: string[]
          audience_diocese_slugs: string[]
          audience_scope: string
          category: Database["public"]["Enums"]["event_category"]
          category_other: string | null
          created_at: string
          description: string | null
          diocese_slug: string | null
          end_at: string | null
          event_language: string | null
          event_languages: string[] | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_featured: boolean
          is_free: boolean
          latitude: number | null
          longitude: number | null
          parish: string | null
          poster_url: string | null
          price_note: string | null
          recurrence_group_id: string | null
          registration_url: string | null
          rejection_reason: string | null
          start_at: string
          status: Database["public"]["Enums"]["event_status"]
          submitted_by_user_id: string | null
          title: string
          updated_at: string
          venue_name: string | null
          video_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_free_submission_status: { Args: never; Returns: Json }
      nearest_diocese_slug: {
        Args: { _lat: number; _lng: number }
        Returns: string
      }
      normalize_contact_phone: { Args: { _phone: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      release_stale_featured_slots: { Args: never; Returns: undefined }
      save_push_subscription: {
        Args: {
          _auth: string
          _endpoint: string
          _locale?: string
          _p256dh: string
        }
        Returns: undefined
      }
      upsert_my_organizer_profile: {
        Args: { _patch: Json }
        Returns: {
          address: string | null
          categories: string[]
          categories_other: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          diocese_slug: string | null
          diocese_slugs: string[]
          free_submissions_used: number
          id: string
          logo_url: string | null
          org_name: string | null
          paid_submissions_remaining: number
          parish: string | null
          representative_name: string | null
          status: Database["public"]["Enums"]["organizer_status"]
          updated_at: string
          user_id: string
          website_url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "organizer_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      app_role: "admin" | "organizer"
      dm_group_role: "owner" | "admin" | "member"
      event_category:
        | "mass"
        | "adoration"
        | "bible_study"
        | "retreat"
        | "conference"
        | "youth"
        | "social"
        | "service"
        | "other"
        | "fundraiser"
        | "young_adults"
        | "youth_group"
      event_status: "pending" | "approved" | "rejected"
      organizer_status: "pending" | "approved" | "suspended"
      thread_category:
        | "collaboration"
        | "resources"
        | "questions"
        | "announcements"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "organizer"],
      dm_group_role: ["owner", "admin", "member"],
      event_category: [
        "mass",
        "adoration",
        "bible_study",
        "retreat",
        "conference",
        "youth",
        "social",
        "service",
        "other",
        "fundraiser",
        "young_adults",
        "youth_group",
      ],
      event_status: ["pending", "approved", "rejected"],
      organizer_status: ["pending", "approved", "suspended"],
      thread_category: [
        "collaboration",
        "resources",
        "questions",
        "announcements",
      ],
    },
  },
} as const
