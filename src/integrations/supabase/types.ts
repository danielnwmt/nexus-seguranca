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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alarms: {
        Row: {
          acknowledged: boolean
          camera_id: string | null
          camera_name: string | null
          client_name: string | null
          created_at: string
          id: string
          message: string | null
          severity: string
          type: string
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean
          camera_id?: string | null
          camera_name?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          message?: string | null
          severity?: string
          type?: string
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean
          camera_id?: string | null
          camera_name?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          message?: string | null
          severity?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alarms_camera_id_fkey"
            columns: ["camera_id"]
            isOneToOne: false
            referencedRelation: "cameras"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          due_date: string | null
          id: string
          notes: string | null
          paid_at: string | null
          status: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cameras: {
        Row: {
          analytics: string[] | null
          brand: string | null
          client_id: string | null
          created_at: string
          id: string
          location: string | null
          max_bitrate: number | null
          name: string
          protocol: string
          resolution: string | null
          retention_days: number
          status: string
          storage_path: string | null
          stream_url: string | null
          updated_at: string
          video_encoding: string | null
        }
        Insert: {
          analytics?: string[] | null
          brand?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          location?: string | null
          max_bitrate?: number | null
          name: string
          protocol?: string
          resolution?: string | null
          retention_days?: number
          status?: string
          storage_path?: string | null
          stream_url?: string | null
          updated_at?: string
          video_encoding?: string | null
        }
        Update: {
          analytics?: string[] | null
          brand?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          location?: string | null
          max_bitrate?: number | null
          name?: string
          protocol?: string
          resolution?: string | null
          retention_days?: number
          status?: string
          storage_path?: string | null
          stream_url?: string | null
          updated_at?: string
          video_encoding?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cameras_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          cameras_count: number
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          monthly_fee: number | null
          name: string
          payment_due_day: number | null
          phone: string | null
          status: string
          storage_server_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cameras_count?: number
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          monthly_fee?: number | null
          name: string
          payment_due_day?: number | null
          phone?: string | null
          status?: string
          storage_server_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cameras_count?: number
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          monthly_fee?: number | null
          name?: string
          payment_due_day?: number | null
          phone?: string | null
          status?: string
          storage_server_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_storage_server_id_fkey"
            columns: ["storage_server_id"]
            isOneToOne: false
            referencedRelation: "storage_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          razao_social: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          razao_social?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          razao_social?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guards: {
        Row: {
          client_ids: string[] | null
          cnv: string | null
          cpf: string | null
          created_at: string
          email: string | null
          hire_date: string | null
          id: string
          name: string
          phone: string | null
          shift: string
          status: string
          updated_at: string
        }
        Insert: {
          client_ids?: string[] | null
          cnv?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          hire_date?: string | null
          id?: string
          name: string
          phone?: string | null
          shift?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_ids?: string[] | null
          cnv?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          hire_date?: string | null
          id?: string
          name?: string
          phone?: string | null
          shift?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      installers: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          specialty: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          bank: string | null
          boleto_url: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          due_date: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          bank?: string | null
          boleto_url?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank?: string | null
          boleto_url?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      patrol_routes: {
        Row: {
          active: boolean
          client_id: string | null
          created_at: string
          description: string | null
          guard_id: string | null
          id: string
          name: string
          updated_at: string
          waypoints: Json
        }
        Insert: {
          active?: boolean
          client_id?: string | null
          created_at?: string
          description?: string | null
          guard_id?: string | null
          id?: string
          name?: string
          updated_at?: string
          waypoints?: Json
        }
        Update: {
          active?: boolean
          client_id?: string | null
          created_at?: string
          description?: string | null
          guard_id?: string | null
          id?: string
          name?: string
          updated_at?: string
          waypoints?: Json
        }
        Relationships: [
          {
            foreignKeyName: "patrol_routes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patrol_routes_guard_id_fkey"
            columns: ["guard_id"]
            isOneToOne: false
            referencedRelation: "guards"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          client_id: string | null
          client_name: string | null
          completed_date: string | null
          created_at: string
          description: string | null
          id: string
          installer_id: string | null
          installer_name: string | null
          notes: string | null
          order_number: string
          scheduled_date: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          installer_id?: string | null
          installer_name?: string | null
          notes?: string | null
          order_number?: string
          scheduled_date?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          installer_id?: string | null
          installer_name?: string | null
          notes?: string | null
          order_number?: string
          scheduled_date?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_installer_id_fkey"
            columns: ["installer_id"]
            isOneToOne: false
            referencedRelation: "installers"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_servers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ip_address: string
          max_storage_gb: number | null
          name: string
          status: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string
          max_storage_gb?: number | null
          name: string
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string
          max_storage_gb?: number | null
          name?: string
          status?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "n1" | "n2" | "n3"
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
      app_role: ["admin", "n1", "n2", "n3"],
    },
  },
} as const
