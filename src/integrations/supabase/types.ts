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
      avaliacoes: {
        Row: {
          andar: number | null
          area_privativa: number | null
          area_total: number | null
          banheiros: number | null
          caracteristicas: Json | null
          conservacao: string | null
          created_at: string | null
          finalidade: string
          fotos: Json
          id: string
          localizacao: string
          observacoes: string | null
          padrao: string | null
          posicao: string | null
          quartos: number | null
          status: string | null
          suites: number | null
          tipo_imovel: string
          tipo_relatorio: string
          user_id: string
          vagas: number | null
        }
        Insert: {
          andar?: number | null
          area_privativa?: number | null
          area_total?: number | null
          banheiros?: number | null
          caracteristicas?: Json | null
          conservacao?: string | null
          created_at?: string | null
          finalidade: string
          fotos?: Json
          id?: string
          localizacao: string
          observacoes?: string | null
          padrao?: string | null
          posicao?: string | null
          quartos?: number | null
          status?: string | null
          suites?: number | null
          tipo_imovel: string
          tipo_relatorio: string
          user_id: string
          vagas?: number | null
        }
        Update: {
          andar?: number | null
          area_privativa?: number | null
          area_total?: number | null
          banheiros?: number | null
          caracteristicas?: Json | null
          conservacao?: string | null
          created_at?: string | null
          finalidade?: string
          fotos?: Json
          id?: string
          localizacao?: string
          observacoes?: string | null
          padrao?: string | null
          posicao?: string | null
          quartos?: number | null
          status?: string | null
          suites?: number | null
          tipo_imovel?: string
          tipo_relatorio?: string
          user_id?: string
          vagas?: number | null
        }
        Relationships: []
      }
      comparaveis: {
        Row: {
          andar: number | null
          area: number | null
          area_privativa: number | null
          avaliacao_id: string
          banheiros: number | null
          caracteristicas: Json | null
          condominio: number | null
          conservacao: string | null
          data_pesquisa: string | null
          fonte: string
          id: string
          idade: number | null
          link: string | null
          localizacao: string | null
          observacoes: string | null
          padrao: string | null
          posicao: string | null
          quartos: number | null
          suites: number | null
          tipo: string | null
          vagas: number | null
          valor_anunciado: number | null
        }
        Insert: {
          andar?: number | null
          area?: number | null
          area_privativa?: number | null
          avaliacao_id: string
          banheiros?: number | null
          caracteristicas?: Json | null
          condominio?: number | null
          conservacao?: string | null
          data_pesquisa?: string | null
          fonte: string
          id?: string
          idade?: number | null
          link?: string | null
          localizacao?: string | null
          observacoes?: string | null
          padrao?: string | null
          posicao?: string | null
          quartos?: number | null
          suites?: number | null
          tipo?: string | null
          vagas?: number | null
          valor_anunciado?: number | null
        }
        Update: {
          andar?: number | null
          area?: number | null
          area_privativa?: number | null
          avaliacao_id?: string
          banheiros?: number | null
          caracteristicas?: Json | null
          condominio?: number | null
          conservacao?: string | null
          data_pesquisa?: string | null
          fonte?: string
          id?: string
          idade?: number | null
          link?: string | null
          localizacao?: string | null
          observacoes?: string | null
          padrao?: string | null
          posicao?: string | null
          quartos?: number | null
          suites?: number | null
          tipo?: string | null
          vagas?: number | null
          valor_anunciado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comparaveis_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cidade: string | null
          created_at: string | null
          creci: string | null
          estado: string | null
          id: string
          logo_url: string | null
          nome: string
          plan_price_id: string | null
          plano: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          telefone: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string | null
          creci?: string | null
          estado?: string | null
          id: string
          logo_url?: string | null
          nome: string
          plan_price_id?: string | null
          plano?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          telefone?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string | null
          creci?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          plan_price_id?: string | null
          plano?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      resultados: {
        Row: {
          avaliacao_id: string
          created_at: string | null
          id: string
          pdf_url: string | null
          relatorio_json: Json | null
          valor_central: number | null
          valor_maximo: number | null
          valor_minimo: number | null
          valor_unitario_medio: number | null
        }
        Insert: {
          avaliacao_id: string
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          relatorio_json?: Json | null
          valor_central?: number | null
          valor_maximo?: number | null
          valor_minimo?: number | null
          valor_unitario_medio?: number | null
        }
        Update: {
          avaliacao_id?: string
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          relatorio_json?: Json | null
          valor_central?: number | null
          valor_maximo?: number | null
          valor_minimo?: number | null
          valor_unitario_medio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resultados_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
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
      user_role: "user" | "pro" | "expert" | "basico" | "profissional"
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
      user_role: ["user", "pro", "expert", "basico", "profissional"],
    },
  },
} as const
