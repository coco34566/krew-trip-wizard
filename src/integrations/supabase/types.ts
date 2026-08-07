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
          capacity: number
          description: string | null
          destination_id: string
          distance_center_km: number
          external_id: string | null
          id: string
          image_url: string | null
          name: string
          price_per_night_per_person: number
          rating: number
          source: string
          type: string
        }
        Insert: {
          capacity?: number
          description?: string | null
          destination_id: string
          distance_center_km?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_per_night_per_person?: number
          rating?: number
          source?: string
          type?: string
        }
        Update: {
          capacity?: number
          description?: string | null
          destination_id?: string
          distance_center_km?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
          name?: string
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
          category: string
          description: string | null
          destination_id: string
          duration_hours: number
          external_id: string | null
          id: string
          image_url: string | null
          name: string
          price_per_person: number
          rating: number
          source: string
        }
        Insert: {
          category: string
          description?: string | null
          destination_id: string
          duration_hours?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_per_person?: number
          rating?: number
          source?: string
        }
        Update: {
          category?: string
          description?: string | null
          destination_id?: string
          duration_hours?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
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
      destinations: {
        Row: {
          avg_daily_cost: number
          best_months: number[]
          country: string
          description: string | null
          distance_from_paris_km: number
          external_id: string | null
          id: string
          image_url: string | null
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
          country: string
          description?: string | null
          distance_from_paris_km?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
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
          country?: string
          description?: string | null
          distance_from_paris_km?: number
          external_id?: string | null
          id?: string
          image_url?: string | null
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
      trip_participant_preferences: {
        Row: {
          accepts_shared_room: boolean
          activity_categories: string[]
          ambiances: string[]
          budget_max: number | null
          budget_priority: string
          created_at: string
          date_flex_days: number | null
          departure_city: string | null
          departure_flex_km: number | null
          desired_destination: string | null
          dietary_constraints: string[]
          duration_nights_max: number | null
          duration_nights_min: number | null
          excluded_destinations: string[]
          free_text: string | null
          id: string
          min_accommodation_rating: number | null
          mobility_notes: string | null
          preferred_time_slots: string[]
          required_amenities: string[]
          room_type_preference: string | null
          submitted_at: string | null
          travel_pace: string | null
          trip_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accepts_shared_room?: boolean
          activity_categories?: string[]
          ambiances?: string[]
          budget_max?: number | null
          budget_priority?: string
          created_at?: string
          date_flex_days?: number | null
          departure_city?: string | null
          departure_flex_km?: number | null
          desired_destination?: string | null
          dietary_constraints?: string[]
          duration_nights_max?: number | null
          duration_nights_min?: number | null
          excluded_destinations?: string[]
          free_text?: string | null
          id?: string
          min_accommodation_rating?: number | null
          mobility_notes?: string | null
          preferred_time_slots?: string[]
          required_amenities?: string[]
          room_type_preference?: string | null
          submitted_at?: string | null
          travel_pace?: string | null
          trip_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accepts_shared_room?: boolean
          activity_categories?: string[]
          ambiances?: string[]
          budget_max?: number | null
          budget_priority?: string
          created_at?: string
          date_flex_days?: number | null
          departure_city?: string | null
          departure_flex_km?: number | null
          desired_destination?: string | null
          dietary_constraints?: string[]
          duration_nights_max?: number | null
          duration_nights_min?: number | null
          excluded_destinations?: string[]
          free_text?: string | null
          id?: string
          min_accommodation_rating?: number | null
          mobility_notes?: string | null
          preferred_time_slots?: string[]
          required_amenities?: string[]
          room_type_preference?: string | null
          submitted_at?: string | null
          travel_pace?: string | null
          trip_id?: string
          updated_at?: string | null
          user_id?: string
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
      trips: {
        Row: {
          budget_per_person: number
          celebrated_person: string | null
          created_at: string
          departure_city: string
          duration_nights: number
          end_date: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          name: string
          owner_id: string
          participants_count: number
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          budget_per_person?: number
          celebrated_person?: string | null
          created_at?: string
          departure_city?: string
          duration_nights?: number
          end_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          name: string
          owner_id: string
          participants_count?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          budget_per_person?: number
          celebrated_person?: string | null
          created_at?: string
          departure_city?: string
          duration_nights?: number
          end_date?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          name?: string
          owner_id?: string
          participants_count?: number
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
      participant_status: "invite" | "accepte" | "refuse"
      trip_status:
        | "brouillon"
        | "en_preparation"
        | "propositions"
        | "valide"
        | "termine"
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
      participant_status: ["invite", "accepte", "refuse"],
      trip_status: [
        "brouillon",
        "en_preparation",
        "propositions",
        "valide",
        "termine",
      ],
    },
  },
} as const
