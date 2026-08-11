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
      accommodations: {
        Row: {
          best_provider: string | null
          booking_url: string | null
          capacity: number
          description: string | null
          destination_id: string
          distance_center_km: number
          external_id: string | null
          id: string
          image_url: string | null
          latitude: number | null
          longitude: number | null
          name: string
          price_offers: Json
          price_per_night_per_person: number
          rating: number
          source: string
          type: string
        }
        Insert: {
          best_provider?: string | null
          booking_url?: string | null
          capacity?: number
          description?: string | null
          destination_id: string
          distance_center_km?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          price_offers?: Json
          price_per_night_per_person?: number
          rating?: number
          source?: string
          type?: string
        }
        Update: {
          best_provider?: string | null
          booking_url?: string | null
          capacity?: number
          description?: string | null
          destination_id?: string
          distance_center_km?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          price_offers?: Json
          price_per_night_per_person?: number
          rating?: number
          source?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          booking_url: string | null
          category: string
          description: string | null
          destination_id: string
          duration_hours: number
          external_id: string | null
          id: string
          image_url: string | null
          latitude: number | null
          longitude: number | null
          name: string
          price_per_person: number
          rating: number
          source: string
        }
        Insert: {
          booking_url?: string | null
          category: string
          description?: string | null
          destination_id: string
          duration_hours?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          price_per_person?: number
          rating?: number
          source?: string
        }
        Update: {
          booking_url?: string | null
          category?: string
          description?: string | null
          destination_id?: string
          duration_hours?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          price_per_person?: number
          rating?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_votes: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          trip_id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          trip_id: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_votes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_votes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          affiliate_url: string
          created_at: string
          id: string
          offer_id: string | null
          original_url: string
          provider: string
          tracking_id: string | null
        }
        Insert: {
          affiliate_url: string
          created_at?: string
          id?: string
          offer_id?: string | null
          original_url: string
          provider: string
          tracking_id?: string | null
        }
        Update: {
          affiliate_url?: string
          created_at?: string
          id?: string
          offer_id?: string | null
          original_url?: string
          provider?: string
          tracking_id?: string | null
        }
        Relationships: []
      }
      destination_feedback: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          reaction: string
          recommendation_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          reaction: string
          recommendation_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          reaction?: string
          recommendation_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destination_feedback_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "trip_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destination_feedback_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destination_feedback_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          avg_daily_cost: number
          best_months: number[]
          climate: Json
          country: string
          description: string | null
          distance_from_paris_km: number
          env_tags: string[]
          external_id: string | null
          id: string
          image_url: string | null
          latitude: number | null
          longitude: number | null
          name: string
          popularity: number
          rating: number
          score_aventure: number
          score_culturel: number
          score_detente: number
          score_fete: number
          score_insolite: number
          score_luxe: number
          score_sportif: number
          slug: string
          source: string
          synced_at: string
        }
        Insert: {
          avg_daily_cost?: number
          best_months?: number[]
          climate?: Json
          country: string
          description?: string | null
          distance_from_paris_km?: number
          env_tags?: string[]
          external_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          popularity?: number
          rating?: number
          score_aventure?: number
          score_culturel?: number
          score_detente?: number
          score_fete?: number
          score_insolite?: number
          score_luxe?: number
          score_sportif?: number
          slug: string
          source?: string
          synced_at?: string
        }
        Update: {
          avg_daily_cost?: number
          best_months?: number[]
          climate?: Json
          country?: string
          description?: string | null
          distance_from_paris_km?: number
          env_tags?: string[]
          external_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          popularity?: number
          rating?: number
          score_aventure?: number
          score_culturel?: number
          score_detente?: number
          score_fete?: number
          score_insolite?: number
          score_luxe?: number
          score_sportif?: number
          slug?: string
          source?: string
          synced_at?: string
        }
        Relationships: []
      }
      price_watch: {
        Row: {
          created_at: string
          created_by: string
          destination_name: string | null
          id: string
          last_checked_at: string
          recommendation_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          destination_name?: string | null
          id?: string
          last_checked_at?: string
          recommendation_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          destination_name?: string | null
          id?: string
          last_checked_at?: string
          recommendation_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_watch_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_watch_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendation_votes: {
        Row: {
          created_at: string
          id: string
          recommendation_id: string
          trip_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          recommendation_id: string
          trip_id: string
          user_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          recommendation_id?: string
          trip_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_votes_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_votes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          accommodation_id: string | null
          activity_ids: string[]
          budget: Json
          created_at: string
          destination_id: string | null
          id: string
          is_selected: boolean
          itinerary: Json
          match_reasons: string[]
          rationale: string | null
          score: number
          trip_id: string
        }
        Insert: {
          accommodation_id?: string | null
          activity_ids?: string[]
          budget?: Json
          created_at?: string
          destination_id?: string | null
          id?: string
          is_selected?: boolean
          itinerary?: Json
          match_reasons?: string[]
          rationale?: string | null
          score?: number
          trip_id: string
        }
        Update: {
          accommodation_id?: string | null
          activity_ids?: string[]
          budget?: Json
          created_at?: string
          destination_id?: string | null
          id?: string
          is_selected?: boolean
          itinerary?: Json
          match_reasons?: string[]
          rationale?: string | null
          score?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_feedback: {
        Row: {
          created_at: string
          destination_id: string | null
          event_type: string
          final_score: number | null
          id: string
          rank_in_top: number | null
          recommendation_id: string | null
          s_activities: number | null
          s_ambiance: number | null
          s_budget: number | null
          s_consensus: number | null
          s_distance: number | null
          s_min_satisfaction: number | null
          s_quality: number | null
          s_season: number | null
          trip_id: string
          was_selected: boolean
        }
        Insert: {
          created_at?: string
          destination_id?: string | null
          event_type?: string
          final_score?: number | null
          id?: string
          rank_in_top?: number | null
          recommendation_id?: string | null
          s_activities?: number | null
          s_ambiance?: number | null
          s_budget?: number | null
          s_consensus?: number | null
          s_distance?: number | null
          s_min_satisfaction?: number | null
          s_quality?: number | null
          s_season?: number | null
          trip_id: string
          was_selected?: boolean
        }
        Update: {
          created_at?: string
          destination_id?: string | null
          event_type?: string
          final_score?: number | null
          id?: string
          rank_in_top?: number | null
          recommendation_id?: string | null
          s_activities?: number | null
          s_ambiance?: number | null
          s_budget?: number | null
          s_consensus?: number | null
          s_distance?: number | null
          s_min_satisfaction?: number | null
          s_quality?: number | null
          s_season?: number | null
          trip_id?: string
          was_selected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "scoring_feedback_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_feedback_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_weights: {
        Row: {
          activities_weight: number
          ambiance_weight: number
          budget_weight: number
          consensus_weight: number
          distance_weight: number
          environment_weight: number
          event_type: string
          min_satisfaction_weight: number
          quality_weight: number
          season_weight: number
          updated_at: string
        }
        Insert: {
          activities_weight?: number
          ambiance_weight?: number
          budget_weight?: number
          consensus_weight?: number
          distance_weight?: number
          environment_weight?: number
          event_type: string
          min_satisfaction_weight?: number
          quality_weight?: number
          season_weight?: number
          updated_at?: string
        }
        Update: {
          activities_weight?: number
          ambiance_weight?: number
          budget_weight?: number
          consensus_weight?: number
          distance_weight?: number
          environment_weight?: number
          event_type?: string
          min_satisfaction_weight?: number
          quality_weight?: number
          season_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      trip_availability: {
        Row: {
          available_dates: string[]
          blocked_dates: string[]
          created_at: string
          duration_nights: number | null
          flex_days: number
          id: string
          notes: string | null
          submitted_at: string | null
          trip_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_dates?: string[]
          blocked_dates?: string[]
          created_at?: string
          duration_nights?: number | null
          flex_days?: number
          id?: string
          notes?: string | null
          submitted_at?: string | null
          trip_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_dates?: string[]
          blocked_dates?: string[]
          created_at?: string
          duration_nights?: number | null
          flex_days?: number
          id?: string
          notes?: string | null
          submitted_at?: string | null
          trip_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_availability_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_participant_preferences: {
        Row: {
          accepts_shared_room: boolean
          accessibility_needs: boolean | null
          activity_categories: string[]
          ambiances: string[]
          blackout_dates: string[] | null
          budget_max: number | null
          budget_priority: string
          created_at: string
          date_flex_days: number | null
          deal_breaker_ambiances: string[] | null
          departure_airport_or_station: string | null
          departure_city: string | null
          departure_flex_km: number | null
          desired_destination: string | null
          dietary_constraints: string[]
          duration_nights_max: number | null
          duration_nights_min: number | null
          excluded_destinations: string[]
          free_text: string | null
          group_age_range: string | null
          id: string
          max_travel_duration_hours: number | null
          min_accommodation_rating: number | null
          mobility_notes: string | null
          preferred_time_slots: string[]
          required_amenities: string[]
          room_type_preference: string | null
          submitted_at: string | null
          transport_mode_accepted: string[] | null
          travel_pace: string | null
          trip_id: string
          updated_at: string | null
          user_id: string
          wanted_env_type: string | null
        }
        Insert: {
          accepts_shared_room?: boolean
          accessibility_needs?: boolean | null
          activity_categories?: string[]
          ambiances?: string[]
          blackout_dates?: string[] | null
          budget_max?: number | null
          budget_priority?: string
          created_at?: string
          date_flex_days?: number | null
          deal_breaker_ambiances?: string[] | null
          departure_airport_or_station?: string | null
          departure_city?: string | null
          departure_flex_km?: number | null
          desired_destination?: string | null
          dietary_constraints?: string[]
          duration_nights_max?: number | null
          duration_nights_min?: number | null
          excluded_destinations?: string[]
          free_text?: string | null
          group_age_range?: string | null
          id?: string
          max_travel_duration_hours?: number | null
          min_accommodation_rating?: number | null
          mobility_notes?: string | null
          preferred_time_slots?: string[]
          required_amenities?: string[]
          room_type_preference?: string | null
          submitted_at?: string | null
          transport_mode_accepted?: string[] | null
          travel_pace?: string | null
          trip_id: string
          updated_at?: string | null
          user_id: string
          wanted_env_type?: string | null
        }
        Update: {
          accepts_shared_room?: boolean
          accessibility_needs?: boolean | null
          activity_categories?: string[]
          ambiances?: string[]
          blackout_dates?: string[] | null
          budget_max?: number | null
          budget_priority?: string
          created_at?: string
          date_flex_days?: number | null
          deal_breaker_ambiances?: string[] | null
          departure_airport_or_station?: string | null
          departure_city?: string | null
          departure_flex_km?: number | null
          desired_destination?: string | null
          dietary_constraints?: string[]
          duration_nights_max?: number | null
          duration_nights_min?: number | null
          excluded_destinations?: string[]
          free_text?: string | null
          group_age_range?: string | null
          id?: string
          max_travel_duration_hours?: number | null
          min_accommodation_rating?: number | null
          mobility_notes?: string | null
          preferred_time_slots?: string[]
          required_amenities?: string[]
          room_type_preference?: string | null
          submitted_at?: string | null
          transport_mode_accepted?: string[] | null
          travel_pace?: string | null
          trip_id?: string
          updated_at?: string | null
          user_id?: string
          wanted_env_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_participant_preferences_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_participants: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          role: string
          status: Database["public"]["Enums"]["participant_status"]
          trip_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          role?: string
          status?: Database["public"]["Enums"]["participant_status"]
          trip_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          role?: string
          status?: Database["public"]["Enums"]["participant_status"]
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_participants_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          participant_id: string
          platform_fee_cents: number
          status: string
          stripe_session_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          participant_id: string
          platform_fee_cents?: number
          status?: string
          stripe_session_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          participant_id?: string
          platform_fee_cents?: number
          status?: string
          stripe_session_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_payments_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "trip_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_preferences: {
        Row: {
          activity_categories: string[]
          ambiances: string[]
          availability_notes: string | null
          average_age: number | null
          created_at: string
          desired_destination: string | null
          dietary_constraints: string[]
          duration_nights: number
          excluded_countries: string[]
          let_krew_decide: boolean
          max_budget: number | null
          max_distance_km: number
          mobility_notes: string | null
          needs_city_center: boolean
          relation: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          activity_categories?: string[]
          ambiances?: string[]
          availability_notes?: string | null
          average_age?: number | null
          created_at?: string
          desired_destination?: string | null
          dietary_constraints?: string[]
          duration_nights?: number
          excluded_countries?: string[]
          let_krew_decide?: boolean
          max_budget?: number | null
          max_distance_km?: number
          mobility_notes?: string | null
          needs_city_center?: boolean
          relation?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          activity_categories?: string[]
          ambiances?: string[]
          availability_notes?: string | null
          average_age?: number | null
          created_at?: string
          desired_destination?: string | null
          dietary_constraints?: string[]
          duration_nights?: number
          excluded_countries?: string[]
          let_krew_decide?: boolean
          max_budget?: number | null
          max_distance_km?: number
          mobility_notes?: string | null
          needs_city_center?: boolean
          relation?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_preferences_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_star_preferences: {
        Row: {
          ambiances: string[]
          available_dates: string[]
          blocked_dates: string[]
          created_at: string
          deal_breakers: string[]
          departure_airport_or_station: string | null
          departure_city: string | null
          desired_destination: string | null
          excluded_destinations: string[]
          filled_by: string
          id: string
          notes: string | null
          submitted_at: string | null
          trip_id: string
          updated_at: string | null
          user_id: string | null
          wanted_activities: string[]
          wanted_env_type: string | null
        }
        Insert: {
          ambiances?: string[]
          available_dates?: string[]
          blocked_dates?: string[]
          created_at?: string
          deal_breakers?: string[]
          departure_airport_or_station?: string | null
          departure_city?: string | null
          desired_destination?: string | null
          excluded_destinations?: string[]
          filled_by: string
          id?: string
          notes?: string | null
          submitted_at?: string | null
          trip_id: string
          updated_at?: string | null
          user_id?: string | null
          wanted_activities?: string[]
          wanted_env_type?: string | null
        }
        Update: {
          ambiances?: string[]
          available_dates?: string[]
          blocked_dates?: string[]
          created_at?: string
          deal_breakers?: string[]
          departure_airport_or_station?: string | null
          departure_city?: string | null
          desired_destination?: string | null
          excluded_destinations?: string[]
          filled_by?: string
          id?: string
          notes?: string | null
          submitted_at?: string | null
          trip_id?: string
          updated_at?: string | null
          user_id?: string | null
          wanted_activities?: string[]
          wanted_env_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_star_preferences_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_tasks: {
        Row: {
          assigned_participant_id: string | null
          booking_url: string | null
          created_at: string
          day_date: string | null
          id: string
          is_manually_assigned: boolean
          price: string | null
          slot_id: string
          start_time: string | null
          status: string
          title: string
          trip_id: string
          type: string
          updated_at: string
        }
        Insert: {
          assigned_participant_id?: string | null
          booking_url?: string | null
          created_at?: string
          day_date?: string | null
          id?: string
          is_manually_assigned?: boolean
          price?: string | null
          slot_id: string
          start_time?: string | null
          status?: string
          title: string
          trip_id: string
          type: string
          updated_at?: string
        }
        Update: {
          assigned_participant_id?: string | null
          booking_url?: string | null
          created_at?: string
          day_date?: string | null
          id?: string
          is_manually_assigned?: boolean
          price?: string | null
          slot_id?: string
          start_time?: string | null
          status?: string
          title?: string
          trip_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_tasks_assigned_participant_id_fkey"
            columns: ["assigned_participant_id"]
            isOneToOne: false
            referencedRelation: "trip_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_tasks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_transport_time_prefs: {
        Row: {
          created_at: string
          earliest_departure_time: string | null
          earliest_return_departure_time: string | null
          id: string
          latest_arrival_time: string | null
          latest_return_time: string | null
          participant_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          earliest_departure_time?: string | null
          earliest_return_departure_time?: string | null
          id?: string
          latest_arrival_time?: string | null
          latest_return_time?: string | null
          participant_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          earliest_departure_time?: string | null
          earliest_return_departure_time?: string | null
          id?: string
          latest_arrival_time?: string | null
          latest_return_time?: string | null
          participant_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_transport_time_prefs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "trip_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_transport_time_prefs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget_per_person: number
          celebrated_person: string | null
          co_organizer_id: string | null
          created_at: string
          date_confidence: string | null
          dates_locked: boolean
          departure_city: string
          duration_nights: number
          end_date: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          group_itinerary: Json | null
          group_logistics: Json | null
          has_star: boolean
          id: string
          name: string
          owner_id: string
          participants_count: number
          provisional_end_date: string | null
          provisional_start_date: string | null
          runner_ups: Json
          selected_activity_ids: string[] | null
          star_user_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          budget_per_person?: number
          celebrated_person?: string | null
          co_organizer_id?: string | null
          created_at?: string
          date_confidence?: string | null
          dates_locked?: boolean
          departure_city?: string
          duration_nights?: number
          end_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          group_itinerary?: Json | null
          group_logistics?: Json | null
          has_star?: boolean
          id?: string
          name: string
          owner_id: string
          participants_count?: number
          provisional_end_date?: string | null
          provisional_start_date?: string | null
          runner_ups?: Json
          selected_activity_ids?: string[] | null
          star_user_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          budget_per_person?: number
          celebrated_person?: string | null
          co_organizer_id?: string | null
          created_at?: string
          date_confidence?: string | null
          dates_locked?: boolean
          departure_city?: string
          duration_nights?: number
          end_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          group_itinerary?: Json | null
          group_logistics?: Json | null
          has_star?: boolean
          id?: string
          name?: string
          owner_id?: string
          participants_count?: number
          provisional_end_date?: string | null
          provisional_start_date?: string | null
          runner_ups?: Json
          selected_activity_ids?: string[] | null
          star_user_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_trip_member: {
        Args: { _trip_id: string; _user_id: string }
        Returns: boolean
      }
      is_trip_owner: {
        Args: { _trip_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      event_type: "evg" | "evjf" | "anniversaire" | "weekend" | "voyage_groupe"
      participant_status: "invite" | "accepte" | "refuse" | "absent"
      trip_status:
        | "brouillon"
        | "en_preparation"
        | "propositions"
        | "valide"
        | "termine"
        | "annule"
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
      event_type: ["evg", "evjf", "anniversaire", "weekend", "voyage_groupe"],
      participant_status: ["invite", "accepte", "refuse", "absent"],
      trip_status: [
        "brouillon",
        "en_preparation",
        "propositions",
        "valide",
        "termine",
        "annule",
      ],
    },
  },
} as const
