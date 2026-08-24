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
      follow_ups: {
        Row: {
          call_result: string | null
          called_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          next_at: string | null
          notes: string | null
          priority: string
          property_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          call_result?: string | null
          called_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          next_at?: string | null
          notes?: string | null
          priority?: string
          property_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          call_result?: string | null
          called_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          next_at?: string | null
          notes?: string | null
          priority?: string
          property_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties_shared"
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
      properties_shared: {
        Row: {
          area: number | null
          bedrooms: number | null
          building_age: number | null
          city: string | null
          created_at: string | null
          deposit: number | null
          description: string | null
          elevator: boolean | null
          floor: number | null
          id: string | null
          monthly_rent: number | null
          neighborhood: string | null
          ownership_type: string | null
          parking: boolean | null
          phase: string | null
          price: number | null
          property_type: string | null
          status: string | null
          storage: boolean | null
          street: string | null
          title: string | null
          total_floors: number | null
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          area?: number | null
          bedrooms?: number | null
          building_age?: number | null
          city?: string | null
          created_at?: string | null
          deposit?: number | null
          description?: string | null
          elevator?: boolean | null
          floor?: number | null
          id?: string | null
          monthly_rent?: number | null
          neighborhood?: string | null
          ownership_type?: string | null
          parking?: boolean | null
          phase?: string | null
          price?: number | null
          property_type?: string | null
          status?: string | null
          storage?: boolean | null
          street?: string | null
          title?: string | null
          total_floors?: number | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: number | null
          bedrooms?: number | null
          building_age?: number | null
          city?: string | null
          created_at?: string | null
          deposit?: number | null
          description?: string | null
          elevator?: boolean | null
          floor?: number | null
          id?: string | null
          monthly_rent?: number | null
          neighborhood?: string | null
          ownership_type?: string | null
          parking?: boolean | null
          phase?: string | null
          price?: number | null
          property_type?: string | null
          status?: string | null
          storage?: boolean | null
          street?: string | null
          title?: string | null
          total_floors?: number | null
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
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
