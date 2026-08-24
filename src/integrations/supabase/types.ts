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
      brokers: {
        Row: {
          agency: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agency?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agency?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      follow_ups: {
        Row: {
          call_result: string | null
          called_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          next_at: string | null
          notes: string | null
          priority: string
          property_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          call_result?: string | null
          called_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          next_at?: string | null
          notes?: string | null
          priority?: string
          property_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          call_result?: string | null
          called_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          next_at?: string | null
          notes?: string | null
          priority?: string
          property_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string
          deposit: number | null
          description: string | null
          elevator: boolean
          floor: number | null
          id: string
          monthly_rent: number | null
          neighborhood: string | null
          notes: string | null
          owner_name: string | null
          owner_phone: string | null
          ownership_type: string | null
          parking: boolean
          phase: string | null
          photos: string[]
          price: number | null
          private_photos: string[]
          property_type: string
          status: string
          storage: boolean
          street: string | null
          title: string
          total_floors: number | null
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          area?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          building_age?: number | null
          city?: string
          created_at?: string
          deposit?: number | null
          description?: string | null
          elevator?: boolean
          floor?: number | null
          id?: string
          monthly_rent?: number | null
          neighborhood?: string | null
          notes?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          ownership_type?: string | null
          parking?: boolean
          phase?: string | null
          photos?: string[]
          price?: number | null
          private_photos?: string[]
          property_type?: string
          status?: string
          storage?: boolean
          street?: string | null
          title: string
          total_floors?: number | null
          transaction_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          area?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          building_age?: number | null
          city?: string
          created_at?: string
          deposit?: number | null
          description?: string | null
          elevator?: boolean
          floor?: number | null
          id?: string
          monthly_rent?: number | null
          neighborhood?: string | null
          notes?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          ownership_type?: string | null
          parking?: boolean
          phase?: string | null
          photos?: string[]
          price?: number | null
          private_photos?: string[]
          property_type?: string
          status?: string
          storage?: boolean
          street?: string | null
          title?: string
          total_floors?: number | null
          transaction_type?: string
          updated_at?: string
          user_id?: string
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
          floor: number
          id: string
          monthly_rent: number
          neighborhood: string
          ownership_type: string
          parking: boolean
          phase: string
          photos: string[]
          price: number
          property_type: string
          status: string
          storage: boolean
          street: string
          title: string
          total_floors: number
          transaction_type: string
          updated_at: string
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
      app_role: ["admin", "collaborator"],
    },
  },
} as const
