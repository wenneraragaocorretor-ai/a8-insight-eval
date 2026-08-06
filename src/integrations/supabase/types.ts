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
      afiliados: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          email: string
          id: string
          nome: string
          percentual_comissao: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          email: string
          id?: string
          nome: string
          percentual_comissao?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          email?: string
          id?: string
          nome?: string
          percentual_comissao?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      avaliacoes: {
        Row: {
          ambientes_outros: Json | null
          ambientes_servico: Json | null
          ambientes_sociais: Json | null
          andar: number | null
          area_construida: number | null
          area_privativa: number | null
          area_total: number | null
          banheiros: number | null
          caracteristicas: Json | null
          conservacao: string | null
          created_at: string | null
          edicoes_count: number
          editado: boolean
          endereco_completo: string | null
          finalidade: string
          fotos: Json
          fotos_meta: Json | null
          id: string
          idade_aparente: string | null
          idade_real: number | null
          infraestrutura_lazer: Json
          localizacao: string
          numero_pavimentos: string | null
          observacoes: string | null
          padrao: string | null
          posicao: string | null
          posicao_solar: string | null
          quartos: number | null
          status: string | null
          suites: number | null
          tipo_acabamento: Json | null
          tipo_imovel: string
          tipo_relatorio: string
          topografia: string | null
          total_andares: number | null
          ultima_edicao_em: string | null
          user_id: string
          vagas: number | null
          vagas_cobertas: number | null
          vagas_descobertas: number | null
          zoneamento: string | null
        }
        Insert: {
          ambientes_outros?: Json | null
          ambientes_servico?: Json | null
          ambientes_sociais?: Json | null
          andar?: number | null
          area_construida?: number | null
          area_privativa?: number | null
          area_total?: number | null
          banheiros?: number | null
          caracteristicas?: Json | null
          conservacao?: string | null
          created_at?: string | null
          edicoes_count?: number
          editado?: boolean
          endereco_completo?: string | null
          finalidade: string
          fotos?: Json
          fotos_meta?: Json | null
          id?: string
          idade_aparente?: string | null
          idade_real?: number | null
          infraestrutura_lazer?: Json
          localizacao: string
          numero_pavimentos?: string | null
          observacoes?: string | null
          padrao?: string | null
          posicao?: string | null
          posicao_solar?: string | null
          quartos?: number | null
          status?: string | null
          suites?: number | null
          tipo_acabamento?: Json | null
          tipo_imovel: string
          tipo_relatorio: string
          topografia?: string | null
          total_andares?: number | null
          ultima_edicao_em?: string | null
          user_id: string
          vagas?: number | null
          vagas_cobertas?: number | null
          vagas_descobertas?: number | null
          zoneamento?: string | null
        }
        Update: {
          ambientes_outros?: Json | null
          ambientes_servico?: Json | null
          ambientes_sociais?: Json | null
          andar?: number | null
          area_construida?: number | null
          area_privativa?: number | null
          area_total?: number | null
          banheiros?: number | null
          caracteristicas?: Json | null
          conservacao?: string | null
          created_at?: string | null
          edicoes_count?: number
          editado?: boolean
          endereco_completo?: string | null
          finalidade?: string
          fotos?: Json
          fotos_meta?: Json | null
          id?: string
          idade_aparente?: string | null
          idade_real?: number | null
          infraestrutura_lazer?: Json
          localizacao?: string
          numero_pavimentos?: string | null
          observacoes?: string | null
          padrao?: string | null
          posicao?: string | null
          posicao_solar?: string | null
          quartos?: number | null
          status?: string | null
          suites?: number | null
          tipo_acabamento?: Json | null
          tipo_imovel?: string
          tipo_relatorio?: string
          topografia?: string | null
          total_andares?: number | null
          ultima_edicao_em?: string | null
          user_id?: string
          vagas?: number | null
          vagas_cobertas?: number | null
          vagas_descobertas?: number | null
          zoneamento?: string | null
        }
        Relationships: []
      }
      avaliacoes_versoes: {
        Row: {
          avaliacao_id: string
          created_at: string
          id: string
          snapshot: Json
          versao: number
        }
        Insert: {
          avaliacao_id: string
          created_at?: string
          id?: string
          snapshot: Json
          versao: number
        }
        Update: {
          avaliacao_id?: string
          created_at?: string
          id?: string
          snapshot?: Json
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_versoes_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_avulsas: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          moeda: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          tipo: string
          user_id: string
          valor_cents: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          moeda?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          tipo: string
          user_id: string
          valor_cents: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          moeda?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          tipo?: string
          user_id?: string
          valor_cents?: number
        }
        Relationships: []
      }
      comparaveis: {
        Row: {
          andar: number | null
          area: number | null
          area_construida: number | null
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
          area_construida?: number | null
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
          area_construida?: number | null
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
      indicacoes_afiliado: {
        Row: {
          afiliado_id: string
          created_at: string
          id: string
          pago_em: string | null
          plano: string
          status: string
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          usuario_indicado_id: string
          valor_comissao: number
          valor_pago: number
        }
        Insert: {
          afiliado_id: string
          created_at?: string
          id?: string
          pago_em?: string | null
          plano: string
          status?: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          usuario_indicado_id: string
          valor_comissao: number
          valor_pago: number
        }
        Update: {
          afiliado_id?: string
          created_at?: string
          id?: string
          pago_em?: string | null
          plano?: string
          status?: string
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          usuario_indicado_id?: string
          valor_comissao?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_afiliado_afiliado_id_fkey"
            columns: ["afiliado_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          afiliado_indicador_id: string | null
          beta_expira_em: string | null
          beta_plano: string | null
          cidade: string | null
          cnai: string | null
          cpf: string | null
          created_at: string | null
          creci: string | null
          creditos_avulsos: number
          email: string | null
          estado: string | null
          id: string
          is_beta_tester: boolean
          logo_url: string | null
          nome: string
          nome_imobiliaria: string | null
          outro_registro: string | null
          plan_price_id: string | null
          plano: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          telefone: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          afiliado_indicador_id?: string | null
          beta_expira_em?: string | null
          beta_plano?: string | null
          cidade?: string | null
          cnai?: string | null
          cpf?: string | null
          created_at?: string | null
          creci?: string | null
          creditos_avulsos?: number
          email?: string | null
          estado?: string | null
          id: string
          is_beta_tester?: boolean
          logo_url?: string | null
          nome: string
          nome_imobiliaria?: string | null
          outro_registro?: string | null
          plan_price_id?: string | null
          plano?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          telefone?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          afiliado_indicador_id?: string | null
          beta_expira_em?: string | null
          beta_plano?: string | null
          cidade?: string | null
          cnai?: string | null
          cpf?: string | null
          created_at?: string | null
          creci?: string | null
          creditos_avulsos?: number
          email?: string | null
          estado?: string | null
          id?: string
          is_beta_tester?: boolean
          logo_url?: string | null
          nome?: string
          nome_imobiliaria?: string | null
          outro_registro?: string | null
          plan_price_id?: string | null
          plano?: Database["public"]["Enums"]["user_role"] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          telefone?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_afiliado_indicador_id_fkey"
            columns: ["afiliado_indicador_id"]
            isOneToOne: false
            referencedRelation: "afiliados"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados: {
        Row: {
          avaliacao_id: string
          created_at: string | null
          id: string
          pdf_url: string | null
          relatorio_json: Json | null
          user_id: string
          valor_central: number | null
          valor_final_corretor: number | null
          valor_maximo: number | null
          valor_minimo: number | null
          valor_unitario_medio: number | null
          versao_metodologia: number | null
        }
        Insert: {
          avaliacao_id: string
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          relatorio_json?: Json | null
          user_id: string
          valor_central?: number | null
          valor_final_corretor?: number | null
          valor_maximo?: number | null
          valor_minimo?: number | null
          valor_unitario_medio?: number | null
          versao_metodologia?: number | null
        }
        Update: {
          avaliacao_id?: string
          created_at?: string | null
          id?: string
          pdf_url?: string | null
          relatorio_json?: Json | null
          user_id?: string
          valor_central?: number | null
          valor_final_corretor?: number | null
          valor_maximo?: number | null
          valor_minimo?: number | null
          valor_unitario_medio?: number | null
          versao_metodologia?: number | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      resolver_codigo_afiliado: { Args: { _codigo: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user" | "afiliado"
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
      app_role: ["admin", "user", "afiliado"],
      user_role: ["user", "pro", "expert", "basico", "profissional"],
    },
  },
} as const
