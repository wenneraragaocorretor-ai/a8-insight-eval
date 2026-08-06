/**
 * REGRA ÚNICA DE ÁREA-BASE (ABNT NBR 14653-2) — fonte canônica.
 *
 * ATENÇÃO: este arquivo tem um ESPELHO EXATO em
 * `supabase/functions/_shared/area-base.ts` (runtime Deno, sem acesso ao bundle
 * do app). Qualquer alteração aqui DEVE ser replicada lá, e vice-versa.
 *
 * Regra:
 * - Terreno / lote:            área total do terreno.
 * - Apartamento:               área privativa; se inexistente, área total.
 * - Casa / sobrado:            área construída; se inexistente, `area_privativa`
 *                              (que no sistema representa "privativa/construída");
 *                              se inexistente, área total.
 * - Galpão / barracão:         área privativa/útil; se inexistente, área total.
 * - Sala comercial / loja /
 *   demais tipologias:         área privativa/útil; se inexistente, área total.
 *
 * A mesma regra vale no envio à IA, na regressão, no PDF e na exibição de R$/m².
 */

export type AreaBaseFonte = "privativa" | "construida" | "total";

export type AreaBase = {
  area: number;
  fonte: AreaBaseFonte;
  label: string;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * @param tipo tipologia do imóvel avaliado (usada também para os comparáveis)
 * @param item objeto com `area_total` (ou `area`), `area_privativa` e opcionalmente `area_construida`
 */
export function areaBaseDe(tipo: unknown, item: any): AreaBase {
  const tn = String(tipo ?? item?.tipo ?? "").toLowerCase();
  const priv = num(item?.area_privativa);
  const constr = num(item?.area_construida);
  const total = num(item?.area_total ?? item?.area);

  if (tn.includes("terreno") || tn.includes("lote")) {
    return { area: total, fonte: "total", label: "área total do terreno" };
  }

  if (tn.includes("casa") || tn.includes("sobrado")) {
    if (constr > 0) return { area: constr, fonte: "construida", label: "área construída" };
    if (priv > 0) return { area: priv, fonte: "privativa", label: "área construída" };
    return { area: total, fonte: "total", label: "área total" };
  }

  if (tn.includes("apart")) {
    if (priv > 0) return { area: priv, fonte: "privativa", label: "área privativa" };
    return { area: total, fonte: "total", label: "área total" };
  }

  // Galpão / barracão / sala comercial / loja / demais tipologias
  if (priv > 0) return { area: priv, fonte: "privativa", label: "área privativa/útil" };
  if (constr > 0) return { area: constr, fonte: "construida", label: "área construída" };
  return { area: total, fonte: "total", label: "área total" };
}

/** Rótulo do valor unitário exibido no PDF/tela, coerente com a área-base. */
export function labelValorM2(tipo: unknown): string {
  const tn = String(tipo ?? "").toLowerCase();
  if (tn.includes("terreno") || tn.includes("lote")) return "Valor/m² terreno";
  if (tn.includes("casa") || tn.includes("sobrado")) return "Valor/m² construído";
  return "Valor/m² privativo";
}

/** Sufixo curto para eixos de gráfico e equações. */
export function sufixoAreaBase(tipo: unknown): string {
  const tn = String(tipo ?? "").toLowerCase();
  if (tn.includes("terreno") || tn.includes("lote")) return "terreno";
  if (tn.includes("casa") || tn.includes("sobrado")) return "construído";
  return "privativo";
}
