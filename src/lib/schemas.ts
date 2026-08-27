import { z } from "zod";

/** Converte números vindos como texto ("R$ 450.000,00", "5.000,50") quando seguro. */
export const numeroMonetario = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const limpo = v.replace(/[^\d.,-]/g, "").trim();
    if (!limpo) return v;
    const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
    const n = Number(normalizado);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().finite().positive());

export const textoObrigatorio = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.string().min(1),
);

const listaTextos = z.array(z.union([z.string(), z.record(z.any())])).min(1);

export const evaluationResultSchema = z
  .object({
    valor_minimo: numeroMonetario,
    valor_central: numeroMonetario,
    valor_maximo: numeroMonetario,
    valor_unitario_medio: numeroMonetario,
    area_base_calculo: numeroMonetario,
    area_base_tipo: textoObrigatorio,
    area_base_descricao: textoObrigatorio,
    resumo_texto: textoObrigatorio,
    pontos_positivos: listaTextos,
    pontos_atencao: z.array(z.union([z.string(), z.record(z.any())])),
    potencial_valorizacao: textoObrigatorio,
    tendencias_mercado: textoObrigatorio,
    perfil_profissao: textoObrigatorio,
    perfil_renda: textoObrigatorio,
    perfil_preferencias: textoObrigatorio,
    perfil_interesses: textoObrigatorio,
    analise_bairro: z.record(z.any()),
    perfil_publico: z.record(z.any()),
    dicas_precificacao: listaTextos,
    estrategias_venda: listaTextos,
    dicas_anuncio: listaTextos,
    analise_fotos: z.string(),
    analise_fotos_individual: z.array(z.union([z.string(), z.record(z.any())])),
  })
  .passthrough()
  .superRefine((v, ctx) => {
    if (!(v.valor_minimo <= v.valor_central && v.valor_central <= v.valor_maximo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valor_central"],
        message: "faixa incoerente: exige valor_minimo <= valor_central <= valor_maximo",
      });
    }
  });

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
