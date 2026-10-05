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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          broker_default_interval_days: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          broker_default_interval_days?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          broker_default_interval_days?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brokers: {
        Row: {
          agency: string | null
          created_at: string
          id: string
          last_contact_at: string | null
          last_contact_note: string | null
          name: string
          notes: string | null
          phone: string | null
          update_interval_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agency?: string | null
          created_at?: string
          id?: string
          last_contact_at?: string | null
          last_contact_note?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          update_interval_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agency?: string | null
          created_at?: string
          id?: string
          last_contact_at?: string | null
          last_contact_note?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          update_interval_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_import_batches: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          last_processed_at: string | null
          skipped: Json
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_processed_at?: string | null
          skipped?: Json
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_processed_at?: string | null
          skipped?: Json
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bulk_import_items: {
        Row: {
          batch_id: string
          created_at: string
          decided_at: string | null
          decision: string | null
          decision_property_id: string | null
          fence: number
          file_code: number | null
          folder: string
          id: string
          idempotency_key: string
          image_hash: string | null
          last_error: string | null
          lease_owner: string | null
          lease_until: string | null
          matching_result: Json | null
          name: string
          next_retry_at: string | null
          ocr_result: Json | null
          property_id: string | null
          retry_count: number
          size: number
          source: string
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          decision_property_id?: string | null
          fence?: number
          file_code?: number | null
          folder?: string
          id?: string
          idempotency_key: string
          image_hash?: string | null
          last_error?: string | null
          lease_owner?: string | null
          lease_until?: string | null
          matching_result?: Json | null
          name: string
          next_retry_at?: string | null
          ocr_result?: Json | null
          property_id?: string | null
          retry_count?: number
          size?: number
          source?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          decision_property_id?: string | null
          fence?: number
          file_code?: number | null
          folder?: string
          id?: string
          idempotency_key?: string
          image_hash?: string | null
          last_error?: string | null
          lease_owner?: string | null
          lease_until?: string | null
          matching_result?: Json | null
          name?: string
          next_retry_at?: string | null
          ocr_result?: Json | null
          property_id?: string | null
          retry_count?: number
          size?: number
          source?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_import_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "bulk_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_requirements: {
        Row: {
          bedrooms: number | null
          city: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          max_area: number | null
          max_budget: number | null
          min_area: number | null
          min_budget: number | null
          needs_elevator: boolean
          needs_parking: boolean
          needs_storage: boolean
          neighborhood: string | null
          ownership_type: string
          phase: string | null
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          max_area?: number | null
          max_budget?: number | null
          min_area?: number | null
          min_budget?: number | null
          needs_elevator?: boolean
          needs_parking?: boolean
          needs_storage?: boolean
          neighborhood?: string | null
          ownership_type?: string
          phase?: string | null
          transaction_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bedrooms?: number | null
          city?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          max_area?: number | null
          max_budget?: number | null
          min_area?: number | null
          min_budget?: number | null
          needs_elevator?: boolean
          needs_parking?: boolean
          needs_storage?: boolean
          neighborhood?: string | null
          ownership_type?: string
          phase?: string | null
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_requirements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      file_code_pool: {
        Row: {
          code: number
          released_at: string
        }
        Insert: {
          code: number
          released_at?: string
        }
        Update: {
          code?: number
          released_at?: string
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          all_day: boolean
          broker_id: string | null
          call_result: string | null
          called_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          kind: string
          next_at: string | null
          notes: string | null
          priority: string
          property_id: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          broker_id?: string | null
          call_result?: string | null
          called_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          kind?: string
          next_at?: string | null
          notes?: string | null
          priority?: string
          property_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          broker_id?: string | null
          call_result?: string | null
          called_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          kind?: string
          next_at?: string | null
          notes?: string | null
          priority?: string
          property_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_visibility: {
        Row: {
          created_at: string
          property_id: string | null
          storage_path: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          property_id?: string | null
          storage_path: string
          updated_at?: string
          user_id: string
          visibility: string
        }
        Update: {
          created_at?: string
          property_id?: string | null
          storage_path?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_visibility_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          area: number | null
          bedrooms: number | null
          broker_id: string | null
          building_age: number | null
          city: string
          company_payable_amount: number | null
          company_payment_terms: string | null
          cover_photo: string | null
          created_at: string
          deed_status: string | null
          deposit: number | null
          deposited_amount: number | null
          description: string | null
          elevator: boolean
          file_code: number | null
          floor: number | null
          id: string
          initial_date: string | null
          initial_price: number | null
          land_category: string | null
          land_zone: string | null
          monthly_rent: number | null
          neighborhood: string | null
          notes: string | null
          owner_name: string | null
          owner_phone: string | null
          ownership_type: string | null
          parking: boolean
          payment_plan: Json
          payment_terms: string | null
          phase: string | null
          photos: string[]
          plot_number: string | null
          price: number | null
          price_verified_at: string | null
          private_photos: string[]
          property_type: string
          status: string
          storage: boolean
          street: string | null
          title: string
          total_floors: number | null
          transaction_type: string
          unit_number: string | null
          updated_at: string
          user_id: string
          verified_price: number | null
        }
        Insert: {
          address?: string | null
          area?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          building_age?: number | null
          city?: string
          company_payable_amount?: number | null
          company_payment_terms?: string | null
          cover_photo?: string | null
          created_at?: string
          deed_status?: string | null
          deposit?: number | null
          deposited_amount?: number | null
          description?: string | null
          elevator?: boolean
          file_code?: number | null
          floor?: number | null
          id?: string
          initial_date?: string | null
          initial_price?: number | null
          land_category?: string | null
          land_zone?: string | null
          monthly_rent?: number | null
          neighborhood?: string | null
          notes?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          ownership_type?: string | null
          parking?: boolean
          payment_plan?: Json
          payment_terms?: string | null
          phase?: string | null
          photos?: string[]
          plot_number?: string | null
          price?: number | null
          price_verified_at?: string | null
          private_photos?: string[]
          property_type?: string
          status?: string
          storage?: boolean
          street?: string | null
          title: string
          total_floors?: number | null
          transaction_type?: string
          unit_number?: string | null
          updated_at?: string
          user_id: string
          verified_price?: number | null
        }
        Update: {
          address?: string | null
          area?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          building_age?: number | null
          city?: string
          company_payable_amount?: number | null
          company_payment_terms?: string | null
          cover_photo?: string | null
          created_at?: string
          deed_status?: string | null
          deposit?: number | null
          deposited_amount?: number | null
          description?: string | null
          elevator?: boolean
          file_code?: number | null
          floor?: number | null
          id?: string
          initial_date?: string | null
          initial_price?: number | null
          land_category?: string | null
          land_zone?: string | null
          monthly_rent?: number | null
          neighborhood?: string | null
          notes?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          ownership_type?: string | null
          parking?: boolean
          payment_plan?: Json
          payment_terms?: string | null
          phase?: string | null
          photos?: string[]
          plot_number?: string | null
          price?: number | null
          price_verified_at?: string | null
          private_photos?: string[]
          property_type?: string
          status?: string
          storage?: boolean
          street?: string | null
          title?: string
          total_floors?: number | null
          transaction_type?: string
          unit_number?: string | null
          updated_at?: string
          user_id?: string
          verified_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
        ]
      }
      property_price_events: {
        Row: {
          confidence: string | null
          created_at: string
          deposit: number | null
          event_at: string
          id: string
          kind: string
          monthly_rent: number | null
          note: string | null
          price: number | null
          property_id: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          deposit?: number | null
          event_at?: string
          id?: string
          kind?: string
          monthly_rent?: number | null
          note?: string | null
          price?: number | null
          property_id: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          deposit?: number | null
          event_at?: string
          id?: string
          kind?: string
          monthly_rent?: number | null
          note?: string | null
          price?: number | null
          property_id?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_price_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_shares: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string | null
          expires_at: string | null
          id: string
          property_id: string
          revoked_at: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          property_id: string
          revoked_at?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          property_id?: string
          revoked_at?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_shares_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_shares_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      [_ in never]: never
    }
    Functions: {
      can_view_shared: { Args: { _user_id: string }; Returns: boolean }
      claim_bulk_import_items: {
        Args: { _lease_seconds?: number; _limit?: number; _worker: string }
        Returns: {
          batch_id: string
          created_at: string
          decided_at: string | null
          decision: string | null
          decision_property_id: string | null
          fence: number
          file_code: number | null
          folder: string
          id: string
          idempotency_key: string
          image_hash: string | null
          last_error: string | null
          lease_owner: string | null
          lease_until: string | null
          matching_result: Json | null
          name: string
          next_retry_at: string | null
          ocr_result: Json | null
          property_id: string | null
          retry_count: number
          size: number
          source: string
          status: string
          storage_path: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "bulk_import_items"
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      photo_is_public_listing: { Args: { _path: string }; Returns: boolean }
      shared_properties: {
        Args: never
        Returns: {
          area: number
          bedrooms: number
          building_age: number
          city: string
          created_at: string
          deposit: number
          description: string
          elevator: boolean
          file_code: number
          floor: number
          id: string
          initial_date: string
          initial_price: number
          land_category: string
          land_zone: string
          monthly_rent: number
          neighborhood: string
          ownership_type: string
          parking: boolean
          phase: string
          photos: string[]
          plot_number: string
          price: number
          price_verified_at: string
          property_type: string
          status: string
          storage: boolean
          street: string
          title: string
          total_floors: number
          transaction_type: string
          updated_at: string
          verified_price: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "collaborator"
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
      app_role: ["admin", "collaborator"],
    },
  },
} as const
