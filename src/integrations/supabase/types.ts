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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      collaborators: {
        Row: {
          created_at: string
          first_seen_batch: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          first_seen_batch?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          first_seen_batch?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_first_seen_batch_fkey"
            columns: ["first_seen_batch"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      column_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          header_signature: string
          id: string
          mapping: Json
          module: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          header_signature: string
          id?: string
          mapping: Json
          module: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          header_signature?: string
          id?: string
          mapping?: Json
          module?: string
          name?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          duplicate_rows: number
          duplicate_strategy: string | null
          duration_ms: number | null
          error_rows: number
          file_name: string
          file_type: string | null
          finished_at: string | null
          headers: Json | null
          id: string
          ignored_rows: number
          include_soc: boolean | null
          inserted_rows: number
          mapping: Json | null
          module: string
          selected_shifts: string[] | null
          sheet_name: string | null
          soc_rows: number | null
          status: string
          total_rows: number
          updated_rows: number
          user_email: string | null
          user_id: string | null
          valid_rows: number
        }
        Insert: {
          created_at?: string
          duplicate_rows?: number
          duplicate_strategy?: string | null
          duration_ms?: number | null
          error_rows?: number
          file_name: string
          file_type?: string | null
          finished_at?: string | null
          headers?: Json | null
          id?: string
          ignored_rows?: number
          include_soc?: boolean | null
          inserted_rows?: number
          mapping?: Json | null
          module: string
          selected_shifts?: string[] | null
          sheet_name?: string | null
          soc_rows?: number | null
          status?: string
          total_rows?: number
          updated_rows?: number
          user_email?: string | null
          user_id?: string | null
          valid_rows?: number
        }
        Update: {
          created_at?: string
          duplicate_rows?: number
          duplicate_strategy?: string | null
          duration_ms?: number | null
          error_rows?: number
          file_name?: string
          file_type?: string | null
          finished_at?: string | null
          headers?: Json | null
          id?: string
          ignored_rows?: number
          include_soc?: boolean | null
          inserted_rows?: number
          mapping?: Json | null
          module?: string
          selected_shifts?: string[] | null
          sheet_name?: string | null
          soc_rows?: number | null
          status?: string
          total_rows?: number
          updated_rows?: number
          user_email?: string | null
          user_id?: string | null
          valid_rows?: number
        }
        Relationships: []
      }
      import_errors: {
        Row: {
          batch_id: string
          column_name: string | null
          created_at: string
          id: string
          kind: string
          message: string
          module: string
          raw: Json | null
          row_number: number | null
        }
        Insert: {
          batch_id: string
          column_name?: string | null
          created_at?: string
          id?: string
          kind?: string
          message: string
          module: string
          raw?: Json | null
          row_number?: number | null
        }
        Update: {
          batch_id?: string
          column_name?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          module?: string
          raw?: Json | null
          row_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          aging: string | null
          batch_id: string
          carrier_3pl: string | null
          classification: string | null
          collaborator: string | null
          create_time: string | null
          created_at: string
          created_by: string | null
          dedupe_key: string
          delivery_attempts: string | null
          driver_id: string | null
          driver_name: string | null
          eha_inbound_time: string | null
          exception_order_id: string | null
          extra: Json
          follow_up_action: string | null
          id: string
          lh: string | null
          location: string | null
          module: string
          month: string | null
          neighborhood: string | null
          order_id: string | null
          product: string | null
          product_code: string | null
          quantity: number | null
          raw: Json
          reason: string | null
          record_date: string | null
          record_date_raw: string | null
          resolve_time: string | null
          route: string | null
          row_number: number | null
          shift: string | null
          status: string | null
          tracking_number: string | null
          treatment: string | null
          updated_at: string
        }
        Insert: {
          aging?: string | null
          batch_id: string
          carrier_3pl?: string | null
          classification?: string | null
          collaborator?: string | null
          create_time?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key: string
          delivery_attempts?: string | null
          driver_id?: string | null
          driver_name?: string | null
          eha_inbound_time?: string | null
          exception_order_id?: string | null
          extra?: Json
          follow_up_action?: string | null
          id?: string
          lh?: string | null
          location?: string | null
          module: string
          month?: string | null
          neighborhood?: string | null
          order_id?: string | null
          product?: string | null
          product_code?: string | null
          quantity?: number | null
          raw?: Json
          reason?: string | null
          record_date?: string | null
          record_date_raw?: string | null
          resolve_time?: string | null
          route?: string | null
          row_number?: number | null
          shift?: string | null
          status?: string | null
          tracking_number?: string | null
          treatment?: string | null
          updated_at?: string
        }
        Update: {
          aging?: string | null
          batch_id?: string
          carrier_3pl?: string | null
          classification?: string | null
          collaborator?: string | null
          create_time?: string | null
          created_at?: string
          created_by?: string | null
          dedupe_key?: string
          delivery_attempts?: string | null
          driver_id?: string | null
          driver_name?: string | null
          eha_inbound_time?: string | null
          exception_order_id?: string | null
          extra?: Json
          follow_up_action?: string | null
          id?: string
          lh?: string | null
          location?: string | null
          module?: string
          month?: string | null
          neighborhood?: string | null
          order_id?: string | null
          product?: string | null
          product_code?: string | null
          quantity?: number | null
          raw?: Json
          reason?: string | null
          record_date?: string | null
          record_date_raw?: string | null
          resolve_time?: string | null
          route?: string | null
          row_number?: number | null
          shift?: string | null
          status?: string | null
          tracking_number?: string | null
          treatment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
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
    Enums: {},
  },
} as const
