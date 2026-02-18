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
      agente_config: {
        Row: {
          agressividade: number
          argumentos: string[]
          created_at: string
          descricao_produto: string
          estilo: string
          id: string
          missao: string
          nicho: string
          nome_agente: string
          objecoes: string[]
          system_prompt: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agressividade?: number
          argumentos?: string[]
          created_at?: string
          descricao_produto?: string
          estilo?: string
          id?: string
          missao?: string
          nicho?: string
          nome_agente?: string
          objecoes?: string[]
          system_prompt?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agressividade?: number
          argumentos?: string[]
          created_at?: string
          descricao_produto?: string
          estilo?: string
          id?: string
          missao?: string
          nicho?: string
          nome_agente?: string
          objecoes?: string[]
          system_prompt?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          created_at: string
          enviado_em: string | null
          id: string
          lead_id: string
          mensagem: string
          pausado_por_humano: boolean
          respondido_em: string | null
          resposta: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          lead_id: string
          mensagem?: string
          pausado_por_humano?: boolean
          respondido_em?: string | null
          resposta?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          enviado_em?: string | null
          id?: string
          lead_id?: string
          mensagem?: string
          pausado_por_humano?: boolean
          respondido_em?: string | null
          resposta?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          cidade_filtro: string
          created_at: string
          delay_segundos: number
          estado_filtro: string
          id: string
          nicho_filtro: string
          nome: string
          quantidade_por_dia: number
          status: string
          total_enviados: number
          total_leads: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cidade_filtro?: string
          created_at?: string
          delay_segundos?: number
          estado_filtro?: string
          id?: string
          nicho_filtro?: string
          nome?: string
          quantidade_por_dia?: number
          status?: string
          total_enviados?: number
          total_leads?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cidade_filtro?: string
          created_at?: string
          delay_segundos?: number
          estado_filtro?: string
          id?: string
          nicho_filtro?: string
          nome?: string
          quantidade_por_dia?: number
          status?: string
          total_enviados?: number
          total_leads?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          cidade: string
          created_at: string
          email: string | null
          estado: string
          fonte: string
          id: string
          nicho: string
          nome_empresa: string
          site: string | null
          status_funil: string
          telefone: string | null
          temperatura: string
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          cidade: string
          created_at?: string
          email?: string | null
          estado: string
          fonte?: string
          id?: string
          nicho: string
          nome_empresa: string
          site?: string | null
          status_funil?: string
          telefone?: string | null
          temperatura?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          cidade?: string
          created_at?: string
          email?: string | null
          estado?: string
          fonte?: string
          id?: string
          nicho?: string
          nome_empresa?: string
          site?: string | null
          status_funil?: string
          telefone?: string | null
          temperatura?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          plano: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          plano?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          plano?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_accounts: {
        Row: {
          connected_at: string | null
          created_at: string
          id: string
          instance_id: string | null
          numero: string | null
          qr_code: string | null
          status: string
          token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          numero?: string | null
          qr_code?: string | null
          status?: string
          token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          numero?: string | null
          qr_code?: string | null
          status?: string
          token?: string | null
          updated_at?: string
          user_id?: string
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
