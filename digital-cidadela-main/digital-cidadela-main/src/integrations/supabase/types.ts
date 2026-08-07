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
      admin_trials: {
        Row: {
          access_code: string | null
          admin_email: string | null
          admin_phone: string | null
          config_updated_at: string | null
          created_at: string
          id: string
          is_active: boolean
          is_premium: boolean
          pix_key: string | null
          premium_expires_at: string | null
          store_id: string
          store_marquee: string | null
          store_name: string | null
          store_slogan: string | null
          trial_expires_at: string | null
          trial_started_at: string | null
          whatsapp: string | null
        }
        Insert: {
          access_code?: string | null
          admin_email?: string | null
          admin_phone?: string | null
          config_updated_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          pix_key?: string | null
          premium_expires_at?: string | null
          store_id: string
          store_marquee?: string | null
          store_name?: string | null
          store_slogan?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          access_code?: string | null
          admin_email?: string | null
          admin_phone?: string | null
          config_updated_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_premium?: boolean
          pix_key?: string | null
          premium_expires_at?: string | null
          store_id?: string
          store_marquee?: string | null
          store_name?: string | null
          store_slogan?: string | null
          trial_expires_at?: string | null
          trial_started_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      cidadela_codes: {
        Row: {
          access_type: string
          code: string
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          order_total: number | null
          store_id: string | null
          used_at: string | null
        }
        Insert: {
          access_type: string
          code: string
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          order_total?: number | null
          store_id?: string | null
          used_at?: string | null
        }
        Update: {
          access_type?: string
          code?: string
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          order_total?: number | null
          store_id?: string | null
          used_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          change_for: number | null
          cidadela_access_type: string | null
          cidadela_code: string | null
          comanda: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_type: string | null
          id: string
          observations: string | null
          payment_confirmed_at: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_rejected_reason: string | null
          payment_status: string
          status: string
          store_id: string | null
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          change_for?: number | null
          cidadela_access_type?: string | null
          cidadela_code?: string | null
          comanda?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_type?: string | null
          id?: string
          observations?: string | null
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_rejected_reason?: string | null
          payment_status?: string
          status?: string
          store_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          change_for?: number | null
          cidadela_access_type?: string | null
          cidadela_code?: string | null
          comanda?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_type?: string | null
          id?: string
          observations?: string | null
          payment_confirmed_at?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_rejected_reason?: string | null
          payment_status?: string
          status?: string
          store_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      soberania_points: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          id: string
          last_updated: string
          points: number
          store_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          id?: string
          last_updated?: string
          points?: number
          store_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          id?: string
          last_updated?: string
          points?: number
          store_id?: string | null
        }
        Relationships: []
      }
      soberania_transactions: {
        Row: {
          amount: number
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          id: string
          reason: string | null
          source: string
          store_id: string | null
          timestamp: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          id?: string
          reason?: string | null
          source: string
          store_id?: string | null
          timestamp?: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          id?: string
          reason?: string | null
          source?: string
          store_id?: string | null
          timestamp?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
