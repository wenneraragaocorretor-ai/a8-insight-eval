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
  cpf: z.string().trim().max(20).optional().or(z.literal("")),
  creci: z.string().trim().min(1, "CRECI obrigatório").max(40),
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
    const payload = {
      id: userId,
      nome: data.nome,
      email: data.email || null,
      telefone: data.telefone,
      cpf: data.cpf || null,
      creci: data.creci,
      tipo: data.tipo,
      nome_imobiliaria: data.tipo === "imobiliaria" ? (data.nome_imobiliaria || null) : null,
      cidade: data.cidade,
      estado: data.estado.toUpperCase(),
      logo_url: data.logo_url || null,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
