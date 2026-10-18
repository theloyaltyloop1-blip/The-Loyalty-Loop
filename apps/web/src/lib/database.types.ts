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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_laptop_backups: {
        Row: {
          archive_bytes: number
          created_at: string
          created_by: string
          download_confirmed_at: string | null
          format_version: number
          id: string
          record_count: number
          status: string
          table_count: number
        }
        Insert: {
          archive_bytes: number
          created_at?: string
          created_by: string
          download_confirmed_at?: string | null
          format_version?: number
          id?: string
          record_count: number
          status?: string
          table_count: number
        }
        Update: {
          archive_bytes?: number
          created_at?: string
          created_by?: string
          download_confirmed_at?: string | null
          format_version?: number
          id?: string
          record_count?: number
          status?: string
          table_count?: number
        }
        Relationships: []
      }
      ai_review_reply_usage: {
        Row: {
          author_id: string | null
          business_id: string
          created_at: string
          id: number
          review_id: string | null
        }
        Insert: {
          author_id?: string | null
          business_id: string
          created_at?: string
          id?: number
          review_id?: string | null
        }
        Update: {
          author_id?: string | null
          business_id?: string
          created_at?: string
          id?: number
          review_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_review_reply_usage_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string | null
          business_id: string | null
          created_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_handoffs: {
        Row: {
          accepted_at: string | null
          brand_id: string
          business_id: string
          created_at: string
          from_owner_id: string
          id: string
          status: string
          to_owner_email: string
          to_owner_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          brand_id: string
          business_id: string
          created_at?: string
          from_owner_id: string
          id?: string
          status?: string
          to_owner_email: string
          to_owner_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          brand_id?: string
          business_id?: string
          created_at?: string
          from_owner_id?: string
          id?: string
          status?: string
          to_owner_email?: string
          to_owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_handoffs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_handoffs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_members: {
        Row: {
          brand_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      business_feature_settings: {
        Row: {
          analytics_enabled: boolean
          business_id: string
          disabled_message: string | null
          promotions_enabled: boolean
          reviews_enabled: boolean
          updated_at: string
        }
        Insert: {
          analytics_enabled?: boolean
          business_id: string
          disabled_message?: string | null
          promotions_enabled?: boolean
          reviews_enabled?: boolean
          updated_at?: string
        }
        Update: {
          analytics_enabled?: boolean
          business_id?: string
          disabled_message?: string | null
          promotions_enabled?: boolean
          reviews_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_feature_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_fidel_locations: {
        Row: {
          business_id: string
          created_at: string
          fidel_location_id: string
          fidel_mid: string | null
          fidel_program_id: string
          fidel_status: string | null
          fidel_status_checked_at: string | null
          id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          fidel_location_id: string
          fidel_mid?: string | null
          fidel_program_id: string
          fidel_status?: string | null
          fidel_status_checked_at?: string | null
          id?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          fidel_location_id?: string
          fidel_mid?: string | null
          fidel_program_id?: string
          fidel_status?: string | null
          fidel_status_checked_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_fidel_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_photos: {
        Row: {
          business_id: string
          created_at: string
          id: string
          sort_order: number
          url: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          sort_order?: number
          url: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_promotions: {
        Row: {
          audience: string
          body: string
          business_id: string
          created_at: string
          id: string
          sent_at: string | null
          status: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          business_id: string
          created_at?: string
          id?: string
          sent_at?: string | null
          status?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          sent_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_promotions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_review_ai_settings: {
        Row: {
          auto_post_positive: boolean
          business_id: string
          enabled: boolean
          sign_off: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_post_positive?: boolean
          business_id: string
          enabled?: boolean
          sign_off?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_post_positive?: boolean
          business_id?: string
          enabled?: boolean
          sign_off?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_review_ai_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_web_research: {
        Row: {
          business_id: string
          created_at: string
          id: string
          report: string
          sources: Json
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          report: string
          sources?: Json
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          report?: string
          sources?: Json
        }
        Relationships: [
          {
            foreignKeyName: "business_web_research_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          approval_status: Database["public"]["Enums"]["business_approval_status"]
          approved_at: string | null
          approved_by: string | null
          brand_color: string
          brand_id: string | null
          category: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          features: string[]
          google_place_id: string | null
          halal_certifier: string | null
          id: string
          instagram: string | null
          is_active: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          loyalty_config: Json
          loyalty_type: Database["public"]["Enums"]["loyalty_type"]
          manual_spend_max_pence: number
          name: string
          opening_hours: Json | null
          owner_id: string
          pending_owner_email: string | null
          pending_owner_name: string | null
          phone: string | null
          postcode: string | null
          rejection_reason: string | null
          reward_model: string
          reward_threshold_pence: number | null
          slug: string
          submitted_at: string
          tiktok: string | null
          trending: boolean
          trending_position: number | null
          updated_at: string
          verification_document_label: string | null
          verification_document_path: string | null
          verification_rejection_reason: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_status: string
          verification_submitted_at: string | null
          website: string | null
          whatsapp_onboarding_enabled: boolean
          youtube: string | null
        }
        Insert: {
          address?: string | null
          approval_status?: Database["public"]["Enums"]["business_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          brand_color?: string
          brand_id?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          google_place_id?: string | null
          halal_certifier?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          loyalty_config?: Json
          loyalty_type?: Database["public"]["Enums"]["loyalty_type"]
          manual_spend_max_pence?: number
          name: string
          opening_hours?: Json | null
          owner_id: string
          pending_owner_email?: string | null
          pending_owner_name?: string | null
          phone?: string | null
          postcode?: string | null
          rejection_reason?: string | null
          reward_model?: string
          reward_threshold_pence?: number | null
          slug: string
          submitted_at?: string
          tiktok?: string | null
          trending?: boolean
          trending_position?: number | null
          updated_at?: string
          verification_document_label?: string | null
          verification_document_path?: string | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          website?: string | null
          whatsapp_onboarding_enabled?: boolean
          youtube?: string | null
        }
        Update: {
          address?: string | null
          approval_status?: Database["public"]["Enums"]["business_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          brand_color?: string
          brand_id?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          features?: string[]
          google_place_id?: string | null
          halal_certifier?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          loyalty_config?: Json
          loyalty_type?: Database["public"]["Enums"]["loyalty_type"]
          manual_spend_max_pence?: number
          name?: string
          opening_hours?: Json | null
          owner_id?: string
          pending_owner_email?: string | null
          pending_owner_name?: string | null
          phone?: string | null
          postcode?: string | null
          rejection_reason?: string | null
          reward_model?: string
          reward_threshold_pence?: number | null
          slug?: string
          submitted_at?: string
          tiktok?: string | null
          trending?: boolean
          trending_position?: number | null
          updated_at?: string
          verification_document_label?: string | null
          verification_document_path?: string | null
          verification_rejection_reason?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          website?: string | null
          whatsapp_onboarding_enabled?: boolean
          youtube?: string | null
        }
        Relationships: []
      }
      favourites: {
        Row: {
          business_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      fidel_deferred_awards: {
        Row: {
          amount_pence: number
          business_id: string
          cleared: boolean
          fidel_card_id: string
          fidel_location_id: string
          fidel_transaction_id: string
          id: string
          program_id: string
          received_at: string
          refunded_pence: number
          resolved_at: string | null
          status: string
          status_reason: string | null
        }
        Insert: {
          amount_pence: number
          business_id: string
          cleared?: boolean
          fidel_card_id: string
          fidel_location_id: string
          fidel_transaction_id: string
          id?: string
          program_id: string
          received_at?: string
          refunded_pence?: number
          resolved_at?: string | null
          status?: string
          status_reason?: string | null
        }
        Update: {
          amount_pence?: number
          business_id?: string
          cleared?: boolean
          fidel_card_id?: string
          fidel_location_id?: string
          fidel_transaction_id?: string
          id?: string
          program_id?: string
          received_at?: string
          refunded_pence?: number
          resolved_at?: string | null
          status?: string
          status_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fidel_deferred_awards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      fidel_link_identities: {
        Row: {
          created_at: string
          deleting_at: string | null
          metadata_id: string
          rotated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          deleting_at?: string | null
          metadata_id: string
          rotated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          deleting_at?: string | null
          metadata_id?: string
          rotated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fidel_orphan_delete_leases: {
        Row: {
          attempt: number
          fidel_card_id: string
          lease_until: string
        }
        Insert: {
          attempt?: number
          fidel_card_id: string
          lease_until: string
        }
        Update: {
          attempt?: number
          fidel_card_id?: string
          lease_until?: string
        }
        Relationships: []
      }
      fidel_retired_metadata_ids: {
        Row: {
          metadata_id: string
          retired_at: string
        }
        Insert: {
          metadata_id: string
          retired_at?: string
        }
        Update: {
          metadata_id?: string
          retired_at?: string
        }
        Relationships: []
      }
      fidel_transactions: {
        Row: {
          business_id: string
          created_at: string
          fidel_transaction_id: string
          id: string
          linked_card_id: string
          original_amount_pence: number
          progress_credited_pence: number
          status: string
          total_refunded_pence: number
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          fidel_transaction_id: string
          id?: string
          linked_card_id: string
          original_amount_pence: number
          progress_credited_pence?: number
          status?: string
          total_refunded_pence?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          fidel_transaction_id?: string
          id?: string
          linked_card_id?: string
          original_amount_pence?: number
          progress_credited_pence?: number
          status?: string
          total_refunded_pence?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fidel_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidel_transactions_linked_card_id_fkey"
            columns: ["linked_card_id"]
            isOneToOne: false
            referencedRelation: "linked_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      fidel_webhook_events: {
        Row: {
          event_type: string
          fidel_message_id: string
          fidel_transaction_id: string
          id: string
          outcome: string | null
          received_at: string
        }
        Insert: {
          event_type: string
          fidel_message_id: string
          fidel_transaction_id: string
          id?: string
          outcome?: string | null
          received_at?: string
        }
        Update: {
          event_type?: string
          fidel_message_id?: string
          fidel_transaction_id?: string
          id?: string
          outcome?: string | null
          received_at?: string
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          document_key: string
          document_version: string
          id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          document_key: string
          document_version: string
          id?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          document_key?: string
          document_version?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      linked_cards: {
        Row: {
          card_scheme: string | null
          created_at: string
          fidel_account_id: string | null
          fidel_card_id: string
          fidel_delete_attempts: number
          fidel_delete_error: string | null
          fidel_delete_lease_until: string | null
          fidel_delete_state: string | null
          fidel_deleted_at: string | null
          id: string
          last_numbers: string | null
          linked_at: string
          unlink_reason: string | null
          unlinked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_scheme?: string | null
          created_at?: string
          fidel_account_id?: string | null
          fidel_card_id: string
          fidel_delete_attempts?: number
          fidel_delete_error?: string | null
          fidel_delete_lease_until?: string | null
          fidel_delete_state?: string | null
          fidel_deleted_at?: string | null
          id?: string
          last_numbers?: string | null
          linked_at?: string
          unlink_reason?: string | null
          unlinked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_scheme?: string | null
          created_at?: string
          fidel_account_id?: string | null
          fidel_card_id?: string
          fidel_delete_attempts?: number
          fidel_delete_error?: string | null
          fidel_delete_lease_until?: string | null
          fidel_delete_state?: string | null
          fidel_deleted_at?: string | null
          id?: string
          last_numbers?: string | null
          linked_at?: string
          unlink_reason?: string | null
          unlinked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          business_id: string
          current_streak: number
          current_tier: string | null
          id: string
          joined_at: string
          last_activity_at: string | null
          last_visit_date: string | null
          longest_streak: number
          points_balance: number
          promos_opted_out: boolean
          redemption_blocked_reason: string | null
          reward_progress_pence: number
          stamp_count: number
          updated_at: string
          user_id: string
          visit_count: number
        }
        Insert: {
          business_id: string
          current_streak?: number
          current_tier?: string | null
          id?: string
          joined_at?: string
          last_activity_at?: string | null
          last_visit_date?: string | null
          longest_streak?: number
          points_balance?: number
          promos_opted_out?: boolean
          redemption_blocked_reason?: string | null
          reward_progress_pence?: number
          stamp_count?: number
          updated_at?: string
          user_id: string
          visit_count?: number
        }
        Update: {
          business_id?: string
          current_streak?: number
          current_tier?: string | null
          id?: string
          joined_at?: string
          last_activity_at?: string | null
          last_visit_date?: string | null
          longest_streak?: number
          points_balance?: number
          promos_opted_out?: boolean
          redemption_blocked_reason?: string | null
          reward_progress_pence?: number
          stamp_count?: number
          updated_at?: string
          user_id?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          announcement_id: string | null
          body: string | null
          business_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          push_error: string | null
          push_sent_at: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          announcement_id?: string | null
          body?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          push_error?: string | null
          push_sent_at?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          announcement_id?: string | null
          body?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          push_error?: string | null
          push_sent_at?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_legal_document_emails: {
        Row: {
          email: string
          sent_at: string
          user_id: string
        }
        Insert: {
          email: string
          sent_at?: string
          user_id: string
        }
        Update: {
          email?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_announcements: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          target_retailer_android: boolean
          target_retailer_ios: boolean
          target_shopper_android: boolean
          target_shopper_ios: boolean
          target_website: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          target_retailer_android?: boolean
          target_retailer_ios?: boolean
          target_shopper_android?: boolean
          target_shopper_ios?: boolean
          target_website?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          target_retailer_android?: boolean
          target_retailer_ios?: boolean
          target_shopper_android?: boolean
          target_shopper_ios?: boolean
          target_website?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          address_lat: number | null
          address_lng: number | null
          address_postcode: string | null
          avatar_url: string | null
          birthday: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          postcode: string | null
          referred_by: string | null
          stamp_code: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          address_postcode?: string | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          postcode?: string | null
          referred_by?: string | null
          stamp_code?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          address_postcode?: string | null
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          postcode?: string | null
          referred_by?: string | null
          stamp_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      requested_shops: {
        Row: {
          contacted_at: string | null
          created_at: string
          email_attempted_at: string | null
          email_sent_at: string | null
          joined_at: string | null
          joined_business_id: string | null
          next_attempt_at: string | null
          notify_attempts: number
          notify_error: string | null
          notify_lease: string | null
          notify_lease_until: string | null
          place_id: string
          ready_at: string | null
          request_count: number
          status: string
          updated_at: string
        }
        Insert: {
          contacted_at?: string | null
          created_at?: string
          email_attempted_at?: string | null
          email_sent_at?: string | null
          joined_at?: string | null
          joined_business_id?: string | null
          next_attempt_at?: string | null
          notify_attempts?: number
          notify_error?: string | null
          notify_lease?: string | null
          notify_lease_until?: string | null
          place_id: string
          ready_at?: string | null
          request_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          contacted_at?: string | null
          created_at?: string
          email_attempted_at?: string | null
          email_sent_at?: string | null
          joined_at?: string | null
          joined_business_id?: string | null
          next_attempt_at?: string | null
          notify_attempts?: number
          notify_error?: string | null
          notify_lease?: string | null
          notify_lease_until?: string | null
          place_id?: string
          ready_at?: string | null
          request_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requested_shops_joined_business_id_fkey"
            columns: ["joined_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      review_replies: {
        Row: {
          ai_generated: boolean
          body: string
          business_id: string
          created_at: string
          id: string
          owner_id: string
          review_id: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          body: string
          business_id: string
          created_at?: string
          id?: string
          owner_id: string
          review_id: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reply_drafts: {
        Row: {
          attempts: number
          auto_count: number
          auto_window_start: string | null
          body: string | null
          business_id: string
          created_at: string
          error: string | null
          lease_until: string | null
          requested_version: string | null
          review_id: string
          review_version: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          auto_count?: number
          auto_window_start?: string | null
          body?: string | null
          business_id: string
          created_at?: string
          error?: string | null
          lease_until?: string | null
          requested_version?: string | null
          review_id: string
          review_version: string
          status: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          auto_count?: number
          auto_window_start?: string | null
          body?: string | null
          business_id?: string
          created_at?: string
          error?: string | null
          lease_until?: string | null
          requested_version?: string | null
          review_id?: string
          review_version?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reply_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_reply_drafts_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          review_id: string
          status: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_id: string
          status?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          business_id: string
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          business_id: string
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          business_id?: string
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_catalog: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          discount_pence: number | null
          id: string
          sort_order: number
          spend_threshold_pence: number | null
          stamp_threshold: number
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          discount_pence?: number | null
          id?: string
          sort_order?: number
          spend_threshold_pence?: number | null
          stamp_threshold?: number
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          discount_pence?: number | null
          id?: string
          sort_order?: number
          spend_threshold_pence?: number | null
          stamp_threshold?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_catalog_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          business_id: string
          catalog_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          qr_token: string
          redeemed_at: string | null
          short_code: string
          title: string
          user_id: string
        }
        Insert: {
          business_id: string
          catalog_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          qr_token?: string
          redeemed_at?: string | null
          short_code?: string
          title?: string
          user_id: string
        }
        Update: {
          business_id?: string
          catalog_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          qr_token?: string
          redeemed_at?: string | null
          short_code?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "reward_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      rpc_rate_limits: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      shop_request_settings: {
        Row: {
          global_details_cap: number
          global_search_cap: number
          id: boolean
          threshold: number
        }
        Insert: {
          global_details_cap?: number
          global_search_cap?: number
          id?: boolean
          threshold?: number
        }
        Update: {
          global_details_cap?: number
          global_search_cap?: number
          id?: boolean
          threshold?: number
        }
        Relationships: []
      }
      shop_request_usage: {
        Row: {
          day: string
          details: number
          requests: number
          searches: number
          user_id: string
        }
        Insert: {
          day: string
          details?: number
          requests?: number
          searches?: number
          user_id: string
        }
        Update: {
          day?: string
          details?: number
          requests?: number
          searches?: number
          user_id?: string
        }
        Relationships: []
      }
      shop_requests: {
        Row: {
          created_at: string
          joined_notification_id: string | null
          joined_push_claimed_at: string | null
          place_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          joined_notification_id?: string | null
          joined_push_claimed_at?: string | null
          place_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          joined_notification_id?: string | null
          joined_push_claimed_at?: string | null
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_requests_joined_notification_id_fkey"
            columns: ["joined_notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_requests_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "requested_shops"
            referencedColumns: ["place_id"]
          },
        ]
      }
      shop_search_global_usage: {
        Row: {
          day: string
          details: number
          searches: number
        }
        Insert: {
          day: string
          details?: number
          searches?: number
        }
        Update: {
          day?: string
          details?: number
          searches?: number
        }
        Relationships: []
      }
      shopper_external_cards: {
        Row: {
          barcode_format: string
          brand_key: string
          card_number: string
          created_at: string
          id: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode_format: string
          brand_key: string
          card_number: string
          created_at?: string
          id?: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode_format?: string
          brand_key?: string
          card_number?: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          activated_at: string | null
          business_id: string
          can_redeem_rewards: boolean
          can_respond_reviews: boolean
          can_scan_stamps: boolean
          created_at: string
          id: string
          invited_by: string
          invited_email: string
          name: string
          pin_hash: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          business_id: string
          can_redeem_rewards?: boolean
          can_respond_reviews?: boolean
          can_scan_stamps?: boolean
          created_at?: string
          id?: string
          invited_by: string
          invited_email: string
          name: string
          pin_hash?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          business_id?: string
          can_redeem_rewards?: boolean
          can_respond_reviews?: boolean
          can_scan_stamps?: boolean
          created_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          name?: string
          pin_hash?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          admin_response: string | null
          body: string
          business_id: string
          created_at: string
          id: string
          priority: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          body: string
          business_id: string
          created_at?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          business_id: string
          client_ref: string | null
          created_at: string
          id: string
          manual_payment_method: string | null
          membership_id: string | null
          note: string | null
          recorded_by: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          value: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          business_id: string
          client_ref?: string | null
          created_at?: string
          id?: string
          manual_payment_method?: string | null
          membership_id?: string | null
          note?: string | null
          recorded_by?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          value?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          business_id?: string
          client_ref?: string | null
          created_at?: string
          id?: string
          manual_payment_method?: string | null
          membership_id?: string | null
          note?: string | null
          recorded_by?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          value?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          context: string | null
          event_name: string
          id: number
          occurred_at: string
          surface: string
          user_id: string
        }
        Insert: {
          context?: string | null
          event_name: string
          id?: never
          occurred_at?: string
          surface: string
          user_id: string
        }
        Update: {
          context?: string | null
          event_name?: string
          id?: never
          occurred_at?: string
          surface?: string
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
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
      user_settings: {
        Row: {
          created_at: string
          language: string
          notify_offers: boolean
          notify_rewards: boolean
          notify_stamps: boolean
          onboarded: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          language?: string
          notify_offers?: boolean
          notify_rewards?: boolean
          notify_stamps?: boolean
          onboarded?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          language?: string
          notify_offers?: boolean
          notify_rewards?: boolean
          notify_stamps?: boolean
          onboarded?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_suspensions: {
        Row: {
          reason: string | null
          suspended_at: string
          suspended_by: string | null
          user_id: string
        }
        Insert: {
          reason?: string | null
          suspended_at?: string
          suspended_by?: string | null
          user_id: string
        }
        Update: {
          reason?: string | null
          suspended_at?: string
          suspended_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      visit_thank_you_log: {
        Row: {
          business_id: string
          last_sent_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          last_sent_at: string
          user_id: string
        }
        Update: {
          business_id?: string
          last_sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_thank_you_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          created_at: string
          id: string
          last_inbound_at: string | null
          logged_out_at: string | null
          opted_in_at: string
          opted_out_at: string | null
          phone_e164: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          logged_out_at?: string | null
          opted_in_at?: string
          opted_out_at?: string | null
          phone_e164: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_inbound_at?: string | null
          logged_out_at?: string | null
          opted_in_at?: string
          opted_out_at?: string | null
          phone_e164?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          business_id: string | null
          pending_email: string | null
          pending_first_name: string | null
          phone_e164: string
          state: string
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          pending_email?: string | null
          pending_first_name?: string | null
          phone_e164: string
          state?: string
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          pending_email?: string | null
          pending_first_name?: string | null
          phone_e164?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_phone_e164_fkey"
            columns: ["phone_e164"]
            isOneToOne: true
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["phone_e164"]
          },
        ]
      }
      whatsapp_dispatch_settings: {
        Row: {
          daily_cap: number
          id: boolean
        }
        Insert: {
          daily_cap?: number
          id?: boolean
        }
        Update: {
          daily_cap?: number
          id?: boolean
        }
        Relationships: []
      }
      whatsapp_dispatch_usage: {
        Row: {
          attempts: number
          day: string
        }
        Insert: {
          attempts?: number
          day: string
        }
        Update: {
          attempts?: number
          day?: string
        }
        Relationships: []
      }
      whatsapp_handoff_links: {
        Row: {
          business_id: string | null
          claimed_at: string | null
          created_at: string
          expected_email: string | null
          expires_at: string
          first_name: string | null
          id: string
          link_type: string
          phone_e164: string
          token_hash: string
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          claimed_at?: string | null
          created_at?: string
          expected_email?: string | null
          expires_at: string
          first_name?: string | null
          id?: string
          link_type: string
          phone_e164: string
          token_hash: string
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          claimed_at?: string | null
          created_at?: string
          expected_email?: string | null
          expires_at?: string
          first_name?: string | null
          id?: string
          link_type?: string
          phone_e164?: string
          token_hash?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_handoff_links_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_handoff_links_phone_e164_fkey"
            columns: ["phone_e164"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["phone_e164"]
          },
        ]
      }
      whatsapp_message_log: {
        Row: {
          business_id: string | null
          created_at: string
          direction: string
          id: string
          message_kind: string
          phone_e164: string
          provider_message_id: string | null
          provider_payload: Json | null
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          direction: string
          id?: string
          message_kind?: string
          phone_e164: string
          provider_message_id?: string | null
          provider_payload?: Json | null
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          message_kind?: string
          phone_e164?: string
          provider_message_id?: string | null
          provider_payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_log_phone_e164_fkey"
            columns: ["phone_e164"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["phone_e164"]
          },
        ]
      }
      whatsapp_outbox: {
        Row: {
          attempts: number
          available_at: string
          body: string
          business_id: string | null
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          lease_id: string | null
          lease_until: string | null
          parameters: Json
          phone_e164: string
          provider_message_id: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          body?: string
          business_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          lease_id?: string | null
          lease_until?: string | null
          parameters?: Json
          phone_e164: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          available_at?: string
          body?: string
          business_id?: string | null
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          lease_id?: string | null
          lease_until?: string | null
          parameters?: Json
          phone_e164?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_outbox_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_outbox_phone_e164_fkey"
            columns: ["phone_e164"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["phone_e164"]
          },
        ]
      }
      winback_email_log: {
        Row: {
          body_preview: string | null
          business_id: string
          coupon_code: string
          days_inactive: number
          error: string | null
          id: string
          recipient_email: string
          sent_at: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          body_preview?: string | null
          business_id: string
          coupon_code: string
          days_inactive: number
          error?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          body_preview?: string | null
          business_id?: string
          coupon_code?: string
          days_inactive?: number
          error?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "winback_email_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abort_fidel_account_deletion: {
        Args: { _user_id: string }
        Returns: undefined
      }
      accept_brand_handoff: { Args: { _handoff: string }; Returns: undefined }
      admin_assert: { Args: never; Returns: undefined }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_delete_review: {
        Args: { _reason?: string; _review_id: string }
        Returns: undefined
      }
      admin_list_businesses: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _status?: Database["public"]["Enums"]["business_approval_status"]
        }
        Returns: {
          approval_status: Database["public"]["Enums"]["business_approval_status"]
          category: string
          created_at: string
          id: string
          is_active: boolean
          loyalty_type: Database["public"]["Enums"]["loyalty_type"]
          members: number
          name: string
          owner_email: string
          owner_id: string
          slug: string
          total: number
          verification_status: string
        }[]
      }
      admin_list_reviews: {
        Args: { _limit?: number; _max_rating?: number; _offset?: number }
        Returns: {
          body: string
          business_id: string
          business_name: string
          created_at: string
          id: string
          rating: number
          total: number
          user_email: string
          user_id: string
        }[]
      }
      admin_list_rewards: {
        Args: { _limit?: number; _offset?: number; _status?: string }
        Returns: {
          business_id: string
          business_name: string
          created_at: string
          expires_at: string
          id: string
          redeemed_at: string
          short_code: string
          title: string
          total: number
          user_email: string
          user_id: string
        }[]
      }
      admin_list_transactions: {
        Args: { _business_id?: string; _limit?: number; _offset?: number }
        Returns: {
          business_id: string
          business_name: string
          created_at: string
          id: string
          note: string
          total: number
          type: Database["public"]["Enums"]["transaction_type"]
          user_email: string
          user_id: string
          value: number
          voided_at: string
        }[]
      }
      admin_list_users: {
        Args: {
          _limit?: number
          _offset?: number
          _role?: Database["public"]["Enums"]["app_role"]
          _search?: string
        }
        Returns: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          last_sign_in_at: string
          roles: Database["public"]["Enums"]["app_role"][]
          suspended: boolean
          total: number
        }[]
      }
      admin_override_loyalty_threshold: {
        Args: { _business_id: string; _threshold: number }
        Returns: undefined
      }
      admin_pending_business_verifications: {
        Args: never
        Returns: {
          category: string
          id: string
          name: string
          owner_email: string
          owner_id: string
          slug: string
          verification_document_label: string
          verification_document_path: string
          verification_submitted_at: string
        }[]
      }
      admin_respond_support_request: {
        Args: { _id: string; _resolve?: boolean; _response: string }
        Returns: undefined
      }
      admin_retry_shop_request: {
        Args: { p_place_id: string }
        Returns: undefined
      }
      admin_review_business_verification: {
        Args: { _approve: boolean; _business_id: string; _reason?: string }
        Returns: {
          address: string | null
          approval_status: Database["public"]["Enums"]["business_approval_status"]
          approved_at: string | null
          approved_by: string | null
          brand_color: string
          brand_id: string | null
          category: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          features: string[]
          google_place_id: string | null
          halal_certifier: string | null
          id: string
          instagram: string | null
          is_active: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          loyalty_config: Json
          loyalty_type: Database["public"]["Enums"]["loyalty_type"]
          manual_spend_max_pence: number
          name: string
          opening_hours: Json | null
          owner_id: string
          pending_owner_email: string | null
          pending_owner_name: string | null
          phone: string | null
          postcode: string | null
          rejection_reason: string | null
          reward_model: string
          reward_threshold_pence: number | null
          slug: string
          submitted_at: string
          tiktok: string | null
          trending: boolean
          trending_position: number | null
          updated_at: string
          verification_document_label: string | null
          verification_document_path: string | null
          verification_rejection_reason: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_status: string
          verification_submitted_at: string | null
          website: string | null
          whatsapp_onboarding_enabled: boolean
          youtube: string | null
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_business_status: {
        Args: {
          _business_id: string
          _reason?: string
          _status: Database["public"]["Enums"]["business_approval_status"]
        }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _email: string
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      admin_set_shop_request: {
        Args: { p_business_id?: string; p_place_id: string; p_status: string }
        Returns: undefined
      }
      admin_set_shop_request_threshold: {
        Args: { p_threshold: number }
        Returns: undefined
      }
      admin_set_trending: {
        Args: { p_business_ids: string[] }
        Returns: undefined
      }
      admin_set_user_suspended: {
        Args: { _reason?: string; _suspended: boolean; _user_id: string }
        Returns: undefined
      }
      admin_shop_requests: { Args: never; Returns: Json }
      admin_transfer_business_ownership: {
        Args: { _business_id: string; _new_owner_email: string }
        Returns: undefined
      }
      admin_usage_analytics: {
        Args: { _days?: number }
        Returns: {
          event_name: string
          events: number
          last_seen: string
          people: number
          surface: string
        }[]
      }
      apply_referral_code: { Args: { _code: string }; Returns: boolean }
      apply_spend_clawback: {
        Args: { _delta: number; _membership_id: string; _reason: string }
        Returns: undefined
      }
      begin_fidel_account_deletion: {
        Args: { _user_id: string }
        Returns: Json
      }
      begin_fidel_card_delete: {
        Args: { _linked_card_id: string }
        Returns: Json
      }
      begin_shop_request_notify: { Args: { p_place_id: string }; Returns: Json }
      brand_create_shop: {
        Args: {
          _brand: string
          _name: string
          _owner_email: string
          _slug: string
        }
        Returns: string
      }
      brand_rollup: {
        Args: { _brand: string }
        Returns: {
          member_count: number
          rewards_redeemed_30d: number
          shop_count: number
          stamps_30d: number
        }[]
      }
      business_has_active_fidel_location: {
        Args: { _business_id: string }
        Returns: boolean
      }
      can_delete_current_account: {
        Args: never
        Returns: {
          can_delete: boolean
          reason: string
        }[]
      }
      can_manage_review_replies: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      can_record_manual_spend: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      card_linked_business_ids: { Args: never; Returns: string[] }
      check_daily_limit: {
        Args: { _action: string; _limit: number }
        Returns: boolean
      }
      check_rate_limit: {
        Args: { _action: string; _limit: number; _window_seconds?: number }
        Returns: boolean
      }
      claim_linked_card: {
        Args: {
          _card_scheme: string
          _fidel_account_id: string
          _fidel_card_id: string
          _last_numbers: string
          _user_id: string
        }
        Returns: Json
      }
      claim_linked_card_v2: {
        Args: {
          _card_scheme: string
          _explicit: boolean
          _fidel_account_id: string
          _fidel_card_id: string
          _last_numbers: string
          _user_id: string
        }
        Returns: Json
      }
      claim_review_reply_generation: {
        Args: { _force: boolean; _review_id: string }
        Returns: Json
      }
      claim_shop_request_notify: { Args: { p_place_id: string }; Returns: Json }
      claim_shop_request_push: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      claim_visit_thank_you: {
        Args: { _business_id: string; _min_interval?: string; _user_id: string }
        Returns: boolean
      }
      claim_whatsapp_outbox: { Args: never; Returns: Json }
      complete_fidel_account_deletion: {
        Args: { _user_id: string }
        Returns: undefined
      }
      complete_review_reply_generation: {
        Args: {
          _allow_auto_post: boolean
          _attempt: number
          _body: string
          _error: string
          _review_id: string
          _safe_to_post: boolean
        }
        Returns: Json
      }
      complete_whatsapp_signup: { Args: { _token: string }; Returns: Json }
      consume_shop_details: {
        Args: { p_admin?: boolean; p_count: number; p_user_id: string }
        Returns: boolean
      }
      consume_shop_search: { Args: { p_user_id: string }; Returns: boolean }
      create_brand: { Args: { _name: string; _slug: string }; Returns: string }
      customer_card_link_status: {
        Args: { _business_id: string; _customer_id: string }
        Returns: Json
      }
      deactivate_my_business: {
        Args: { _business_id: string }
        Returns: {
          address: string | null
          approval_status: Database["public"]["Enums"]["business_approval_status"]
          approved_at: string | null
          approved_by: string | null
          brand_color: string
          brand_id: string | null
          category: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          features: string[]
          google_place_id: string | null
          halal_certifier: string | null
          id: string
          instagram: string | null
          is_active: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          loyalty_config: Json
          loyalty_type: Database["public"]["Enums"]["loyalty_type"]
          manual_spend_max_pence: number
          name: string
          opening_hours: Json | null
          owner_id: string
          pending_owner_email: string | null
          pending_owner_name: string | null
          phone: string | null
          postcode: string | null
          rejection_reason: string | null
          reward_model: string
          reward_threshold_pence: number | null
          slug: string
          submitted_at: string
          tiktok: string | null
          trending: boolean
          trending_position: number | null
          updated_at: string
          verification_document_label: string | null
          verification_document_path: string | null
          verification_rejection_reason: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_status: string
          verification_submitted_at: string | null
          website: string | null
          whatsapp_onboarding_enabled: boolean
          youtube: string | null
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_owned_business: {
        Args: { _business_id: string; _confirmation_name: string }
        Returns: undefined
      }
      dismiss_review_reply_draft: {
        Args: { _review_id: string }
        Returns: undefined
      }
      ensure_current_user_bootstrap: { Args: never; Returns: undefined }
      fidel_cards_pending_delete: {
        Args: { _max_rows: number }
        Returns: {
          fidel_card_id: string
          linked_card_id: string
          unlinked_at: string
        }[]
      }
      fidel_link_identity: { Args: { _user_id: string }; Returns: string }
      fidel_location_accepts_new_awards: {
        Args: {
          _location_row: Database["public"]["Tables"]["business_fidel_locations"]["Row"]
        }
        Returns: boolean
      }
      fidel_orphan_card_action: {
        Args: { _fidel_card_id: string; _metadata_id: string }
        Returns: Json
      }
      find_whatsapp_user_by_phone: { Args: { _phone: string }; Returns: string }
      finish_fidel_card_delete: {
        Args: { _attempt?: number; _error: string; _linked_card_id: string }
        Returns: undefined
      }
      finish_fidel_orphan_delete: {
        Args: { _attempt: number; _fidel_card_id: string }
        Returns: undefined
      }
      finish_shop_request_notify: {
        Args: { p_lease: string; p_place_id: string; p_sent: boolean }
        Returns: undefined
      }
      finish_whatsapp_outbox: {
        Args: {
          p_id: string
          p_lease: string
          p_message?: string
          p_outcome: string
        }
        Returns: undefined
      }
      gen_short_code: { Args: never; Returns: string }
      get_business_members: {
        Args: { _business_id: string }
        Returns: {
          first_name: string
          joined_at: string
          last_activity_at: string
          last_name: string
          points_balance: number
          reward_progress_pence: number
          stamp_count: number
          user_id: string
          visit_count: number
        }[]
      }
      get_scanned_member_details: {
        Args: { _business_id: string; _user_id: string }
        Returns: {
          email: string
          first_name: string
          id: string
          joined_at: string
          last_activity_at: string
          last_name: string
          points_balance: number
          stamp_count: number
          visit_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_staff_of: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_brand_member: {
        Args: { _brand: string; _user: string }
        Returns: boolean
      }
      join_requested_shop: {
        Args: { p_business_id: string; p_place_id: string }
        Returns: undefined
      }
      list_storage_objects_by_owner: {
        Args: { p_owner: string }
        Returns: {
          bucket_id: string
          name: string
        }[]
      }
      london_day_start: { Args: { _at: string }; Returns: string }
      lookup_user_by_stamp_code: {
        Args: { _code: string }
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
      mark_fidel_card_deleted: {
        Args: { _error: string; _linked_card_id: string }
        Returns: undefined
      }
      my_shop_requests: { Args: never; Returns: Json }
      post_review_reply_draft: {
        Args: { _body: string; _review_id: string }
        Returns: Json
      }
      prepare_fidel_account_card_delete: {
        Args: { _fidel_card_id: string; _user_id: string }
        Returns: string
      }
      process_fidel_webhook_event: {
        Args: {
          _amount_pence: number
          _auth: boolean
          _cleared: boolean
          _event_type: string
          _fidel_card_id: string
          _fidel_location_id: string
          _fidel_message_id: string
          _fidel_transaction_id: string
          _original_transaction_id: string
          _program_id: string
        }
        Returns: Json
      }
      reactivate_my_business: {
        Args: { _business_id: string }
        Returns: {
          address: string | null
          approval_status: Database["public"]["Enums"]["business_approval_status"]
          approved_at: string | null
          approved_by: string | null
          brand_color: string
          brand_id: string | null
          category: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          features: string[]
          google_place_id: string | null
          halal_certifier: string | null
          id: string
          instagram: string | null
          is_active: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          loyalty_config: Json
          loyalty_type: Database["public"]["Enums"]["loyalty_type"]
          manual_spend_max_pence: number
          name: string
          opening_hours: Json | null
          owner_id: string
          pending_owner_email: string | null
          pending_owner_name: string | null
          phone: string | null
          postcode: string | null
          rejection_reason: string | null
          reward_model: string
          reward_threshold_pence: number | null
          slug: string
          submitted_at: string
          tiktok: string | null
          trending: boolean
          trending_position: number | null
          updated_at: string
          verification_document_label: string | null
          verification_document_path: string | null
          verification_rejection_reason: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_status: string
          verification_submitted_at: string | null
          website: string | null
          whatsapp_onboarding_enabled: boolean
          youtube: string | null
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_manual_spend: {
        Args: {
          _amount_pence: number
          _business_id: string
          _client_ref: string
          _customer_id: string
          _payment_method: string
        }
        Returns: Json
      }
      recount_shop_requests: {
        Args: { p_place_id?: string }
        Returns: undefined
      }
      release_visit_thank_you: {
        Args: { _business_id: string; _user_id: string }
        Returns: undefined
      }
      replay_deferred_fidel_awards: {
        Args: { _business_id: string }
        Returns: number
      }
      request_announcement_push: {
        Args: { _announcement_id: string }
        Returns: undefined
      }
      request_shop: { Args: { p_place: Json }; Returns: Json }
      reserve_whatsapp_inbound: {
        Args: { p_id: string; p_kind: string; p_phone: string }
        Returns: boolean
      }
      scanned_member_spend_summary: {
        Args: { _business_id: string; _customer_id: string }
        Returns: Json
      }
      scheduled_jobs_health: { Args: never; Returns: Json }
      set_my_staff_pin: {
        Args: { _business_id: string; _pin: string }
        Returns: undefined
      }
      set_review_ai_settings: {
        Args: {
          _auto_post_positive: boolean
          _business_id: string
          _enabled: boolean
          _sign_off: string
        }
        Returns: undefined
      }
      shop_request_listed: { Args: { p_place: Json }; Returns: string }
      spend_next_tier: {
        Args: { _business_id: string; _progress_pence: number }
        Returns: {
          amount_pence: number
          title: string
        }[]
      }
      staff_has_permission: {
        Args: { _business_id: string; _perm: string; _user_id: string }
        Returns: boolean
      }
      start_brand_handoff: {
        Args: { _business: string; _new_owner_email: string }
        Returns: string
      }
      submit_business_verification: {
        Args: { _business_id: string; _doc_label: string; _doc_path: string }
        Returns: {
          address: string | null
          approval_status: Database["public"]["Enums"]["business_approval_status"]
          approved_at: string | null
          approved_by: string | null
          brand_color: string
          brand_id: string | null
          category: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          features: string[]
          google_place_id: string | null
          halal_certifier: string | null
          id: string
          instagram: string | null
          is_active: boolean
          lat: number | null
          lng: number | null
          logo_url: string | null
          loyalty_config: Json
          loyalty_type: Database["public"]["Enums"]["loyalty_type"]
          manual_spend_max_pence: number
          name: string
          opening_hours: Json | null
          owner_id: string
          pending_owner_email: string | null
          pending_owner_name: string | null
          phone: string | null
          postcode: string | null
          rejection_reason: string | null
          reward_model: string
          reward_threshold_pence: number | null
          slug: string
          submitted_at: string
          tiktok: string | null
          trending: boolean
          trending_position: number | null
          updated_at: string
          verification_document_label: string | null
          verification_document_path: string | null
          verification_rejection_reason: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_status: string
          verification_submitted_at: string | null
          website: string | null
          whatsapp_onboarding_enabled: boolean
          youtube: string | null
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sweep_shop_request_notifications: { Args: never; Returns: number }
      transfer_owned_business_ownership: {
        Args: { _business_id: string; _new_owner_email: string }
        Returns: undefined
      }
      undo_manual_spend: {
        Args: { _reason: string; _transaction_id: string }
        Returns: Json
      }
      unlink_linked_card: {
        Args: { _linked_card_id: string; _reason: string; _user_id: string }
        Returns: Json
      }
      user_has_active_linked_card: {
        Args: { _user_id: string }
        Returns: boolean
      }
      verify_staff_pin: {
        Args: { _business_id: string; _pin: string }
        Returns: boolean
      }
      wake_shop_request_notify: {
        Args: { p_mode?: string; p_place_id: string }
        Returns: undefined
      }
      withdraw_shop_request: { Args: { p_place_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "consumer" | "business_owner" | "admin" | "staff" | "brand_head"
      business_approval_status: "pending" | "approved" | "rejected"
      loyalty_type: "stamp_card" | "points" | "tiered"
      notification_kind: "system" | "stamp" | "reward" | "promo"
      promo_type: "broadcast" | "targeted"
      transaction_type:
        | "stamp"
        | "redeem"
        | "points_earn"
        | "points_spend"
        | "spend"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["consumer", "business_owner", "admin", "staff", "brand_head"],
      business_approval_status: ["pending", "approved", "rejected"],
      loyalty_type: ["stamp_card", "points", "tiered"],
      notification_kind: ["system", "stamp", "reward", "promo"],
      promo_type: ["broadcast", "targeted"],
      transaction_type: [
        "stamp",
        "redeem",
        "points_earn",
        "points_spend",
        "spend",
      ],
    },
  },
} as const
