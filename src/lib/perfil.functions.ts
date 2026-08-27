import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMeuPerfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: userData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.auth.getUser(),
    ]);
    return {
      profile: profile ?? null,
      authEmail: userData?.user?.email ?? null,
    };
  });

const perfilSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  email: z.string().trim().email("E-mail inválido").max(160).optional().or(z.literal("")),
  telefone: z.string().trim().min(1, "Telefone obrigatório").max(40),
  cpf: z
    .string()
    .trim()
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF deve estar no formato 000.000.000-00"),
  creci: z.string().trim().max(40).optional().or(z.literal("")),
  cnai: z.string().trim().max(40).optional().or(z.literal("")),
  outro_registro: z.string().trim().max(120).optional().or(z.literal("")),
  tipo: z.enum(["pessoa_fisica", "imobiliaria"]),
  nome_imobiliaria: z.string().trim().max(160).optional().or(z.literal("")),
  cidade: z.string().trim().min(1, "Cidade obrigatória").max(120),
  estado: z.string().trim().length(2, "Use a sigla do estado"),
  logo_url: z.string().trim().max(500).optional().or(z.literal("")),
});

export const salvarMeuPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => perfilSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cpfDigits = data.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      throw new Error("CPF inválido");
    }
    const payload = {
      id: userId,
      nome: data.nome,
      email: data.email || null,
      telefone: data.telefone,
      cpf: data.cpf,
      creci: data.creci || null,
      cnai: data.cnai || null,
      outro_registro: data.outro_registro || null,
      tipo: data.tipo,
      nome_imobiliaria: data.tipo === "imobiliaria" ? data.nome_imobiliaria || null : null,
      cidade: data.cidade,
      estado: data.estado.toUpperCase(),
      logo_url: data.logo_url || null,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) {
      if (error.code === "23505" || /profiles_cpf_unique/i.test(error.message)) {
        throw new Error("CPF já cadastrado no sistema");
      }
      throw new Error(error.message || "Erro ao salvar — tente novamente");
    }
    return { ok: true };
  });
