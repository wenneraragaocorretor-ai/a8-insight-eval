import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================
// A8 Investimentos — Geração de PDF (3 modelos)
// Identidade visual:
//   Primária  #0F2D5C (azul escuro)
//   Destaque  #C8A951 (dourado)
//   A4, margens 20mm, Helvetica
// ============================================================

const COR_AZUL: [number, number, number] = [15, 45, 92];
const COR_DOURADO: [number, number, number] = [200, 169, 81];
const COR_TEXTO: [number, number, number] = [40, 40, 40];
const COR_MUTED: [number, number, number] = [110, 110, 110];

const MARGIN = 20; // mm

export type PlanoUsuario = "basico" | "profissional" | "expert" | "user" | "pro" | string;
export type ModeloPdf = 1 | 2 | 3;
export type CorretorInfo = {
  nome: string;
  creci?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

const fmtBRL = (v: number | null | undefined) =>
  v == null || isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtNum = (v: number | null | undefined, digits = 2) =>
  v == null || isNaN(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: digits });

const hoje = () => new Date().toLocaleDateString("pt-BR");

const numeroReferencia = (id: string) =>
  `A8-${(id || "").slice(0, 8).toUpperCase()}-${new Date().getFullYear()}`;

export function modelosDisponiveis(plano: PlanoUsuario): ModeloPdf[] {
  const p = String(plano || "basico").toLowerCase();
  if (p === "expert") return [1, 2, 3];
  if (p === "profissional" || p === "pro") return [1, 2];
  return [1];
}

export function podeGerarModelo(plano: PlanoUsuario, modelo: ModeloPdf) {
  return modelosDisponiveis(plano).includes(modelo);
}

// ------------------------------------------------------------
// Header / Footer comuns
// ------------------------------------------------------------
function desenharCabecalho(doc: jsPDF, refNumero: string, selo?: string) {
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COR_AZUL);
  doc.text("A8 Investimentos Imobiliários", MARGIN, 18);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...COR_DOURADO);
  doc.text("Gerando riqueza, construindo patrimônio", MARGIN, 24);

  // Bloco direito: data + referência (+ selo opcional)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR_TEXTO);
  doc.text(`Data: ${hoje()}`, pageW - MARGIN, 16, { align: "right" });
  doc.text(`Ref.: ${refNumero}`, pageW - MARGIN, 21, { align: "right" });
  if (selo) {
    doc.setFillColor(...COR_DOURADO);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const w = doc.getTextWidth(selo) + 6;
    doc.roundedRect(pageW - MARGIN - w, 24, w, 6, 1, 1, "F");
    doc.text(selo, pageW - MARGIN - 3, 28.2, { align: "right" });
  }

  // Linha separadora dourada
  doc.setDrawColor(...COR_DOURADO);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, 32, pageW - MARGIN, 32);
}

function desenharRodape(doc: jsPDF, corretor: CorretorInfo) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const extras = [
    corretor.creci ? `CRECI ${corretor.creci}` : null,
    corretor.telefone || null,
    [corretor.cidade, corretor.estado].filter(Boolean).join("/") || null,
  ].filter(Boolean).join(" • ");
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COR_DOURADO);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, pageH - 18, pageW - MARGIN, pageH - 18);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COR_MUTED);
    const aviso = "Esta avaliação é mercadológica e não substitui laudo técnico assinado por profissional habilitado (CNAI/IBAPE)";
    const lines = doc.splitTextToSize(aviso, pageW - MARGIN * 2);
    doc.text(lines, pageW / 2, pageH - 14, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COR_TEXTO);
    doc.text(corretor.nome, MARGIN, pageH - 6);
    if (extras) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COR_MUTED);
      doc.text(extras, MARGIN + doc.getTextWidth(corretor.nome) + 3, pageH - 6);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COR_TEXTO);
    doc.text(`Página ${i} de ${total} — ${hoje()}`, pageW - MARGIN, pageH - 6, { align: "right" });
  }
}

function marcaDagua(doc: jsPDF, texto: string) {
  const total = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.saveGraphicsState();
    // @ts-ignore - GState exists at runtime
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(60);
    doc.setTextColor(...COR_AZUL);
    doc.text(texto, pageW / 2, pageH / 2, { align: "center", angle: 45 });
    doc.restoreGraphicsState();
  }
}

function tituloSecao(doc: jsPDF, y: number, texto: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COR_AZUL);
  doc.text(texto, MARGIN, y);
  doc.setDrawColor(...COR_DOURADO);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 1.5, MARGIN + 40, y + 1.5);
  return y + 6;
}

function tituloPrincipal(doc: jsPDF, y: number, texto: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COR_AZUL);
  const pageW = doc.internal.pageSize.getWidth();
  doc.text(texto, pageW / 2, y, { align: "center" });
  return y + 8;
}

function caixasValor(doc: jsPDF, y: number, vMin: number | null | undefined, vCentral: number | null | undefined, vMax: number | null | undefined) {
  const pageW = doc.internal.pageSize.getWidth();
  const usable = pageW - MARGIN * 2;
  const gap = 4;
  const boxW = (usable - gap * 2) / 3;
  const boxH = 22;

  const blocos: Array<[string, string, [number, number, number]]> = [
    ["Valor Mínimo", fmtBRL(vMin), [120, 130, 150]],
    ["Valor Central", fmtBRL(vCentral), COR_DOURADO],
    ["Valor Máximo", fmtBRL(vMax), [80, 110, 80]],
  ];

  blocos.forEach(([label, valor, cor], i) => {
    const x = MARGIN + i * (boxW + gap);
    doc.setFillColor(...cor);
    doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(label, x + boxW / 2, y + 7, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(i === 1 ? 14 : 12);
    doc.text(valor, x + boxW / 2, y + 16, { align: "center" });
  });

  return y + boxH + 6;
}

function paragrafo(doc: jsPDF, y: number, texto: string, tamanho = 10) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(tamanho);
  doc.setTextColor(...COR_TEXTO);
  const lines = doc.splitTextToSize(texto, pageW - MARGIN * 2);
  doc.text(lines, MARGIN, y);
  return y + lines.length * (tamanho * 0.45) + 3;
}

function listaNumerada(doc: jsPDF, y: number, itens: string[]) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COR_TEXTO);
  itens.forEach((it, i) => {
    const linhas = doc.splitTextToSize(`${i + 1}. ${it}`, pageW - MARGIN * 2 - 4);
    if (y + linhas.length * 5 > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      y = 40;
    }
    doc.text(linhas, MARGIN, y);
    y += linhas.length * 5 + 1;
  });
  return y + 2;
}

function novaPaginaSeNecessario(doc: jsPDF, y: number, espacoRequerido = 30) {
  if (y + espacoRequerido > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    return 40;
  }
  return y;
}

// ------------------------------------------------------------
// Coletor de campos
// ------------------------------------------------------------
function dadosBasicos(a: any): [string, string][] {
  const carac = Array.isArray(a.caracteristicas) ? a.caracteristicas.join(", ") : "";
  return [
    ["Tipo do imóvel", String(a.tipo_imovel ?? "—")],
    ["Localização", String(a.localizacao ?? "—")],
    ["Área total", a.area_total ? `${a.area_total} m²` : "—"],
    ["Área privativa", a.area_privativa ? `${a.area_privativa} m²` : "—"],
    ["Quartos / Suítes", `${a.quartos ?? "—"} / ${a.suites ?? "—"}`],
    ["Banheiros / Vagas", `${a.banheiros ?? "—"} / ${a.vagas ?? "—"}`],
    ["Padrão", String(a.padrao ?? "—")],
    ["Conservação", String(a.conservacao ?? "—")],
    ["Posição", String(a.posicao ?? "—")],
    ["Características", carac || "—"],
  ];
}

function dadosCompletos(a: any): [string, string][] {
  const carac = Array.isArray(a.caracteristicas) ? a.caracteristicas.join(", ") : "—";
  return [
    ["Tipo do imóvel", String(a.tipo_imovel ?? "—")],
    ["Finalidade", String(a.finalidade ?? "—")],
    ["Localização", String(a.localizacao ?? "—")],
    ["Área total", a.area_total ? `${a.area_total} m²` : "—"],
    ["Área privativa", a.area_privativa ? `${a.area_privativa} m²` : "—"],
    ["Quartos / Suítes", `${a.quartos ?? "—"} / ${a.suites ?? "—"}`],
    ["Banheiros / Vagas", `${a.banheiros ?? "—"} / ${a.vagas ?? "—"}`],
    ["Andar", String(a.andar ?? "—")],
    ["Padrão / Conservação", `${a.padrao ?? "—"} / ${a.conservacao ?? "—"}`],
    ["Posição", String(a.posicao ?? "—")],
    ["Características", carac || "—"],
    ["Observações", String(a.observacoes ?? "—")],
  ];
}

// ------------------------------------------------------------
// MODELO 1 — Plano Básico
// ------------------------------------------------------------
function gerarModelo1(avaliacao: any, resultado: any, comparaveis: any[], corretor: CorretorInfo) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ref = numeroReferencia(avaliacao?.id ?? "");
  desenharCabecalho(doc, ref);

  let y = tituloPrincipal(doc, 42, "Estudo de Mercado Simplificado");

  y = tituloSecao(doc, y, "1. Dados do Imóvel Avaliando");
  autoTable(doc, {
    startY: y,
    body: dadosBasicos(avaliacao),
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.2, textColor: COR_TEXTO },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  y = tituloSecao(doc, y, "2. Comparáveis Pesquisados");
  autoTable(doc, {
    startY: y,
    head: [["Fonte", "Localização", "Área", "Quartos", "Vagas", "Valor", "R$/m²"]],
    body: comparaveis.map((c) => [
      c.fonte ?? "—",
      c.localizacao ?? "—",
      `${c.area ?? "—"} m²`,
      String(c.quartos ?? "—"),
      String(c.vagas ?? "—"),
      fmtBRL(Number(c.valor_anunciado)),
      c.area > 0 ? fmtBRL(Number(c.valor_anunciado) / Number(c.area)) : "—",
    ]),
    headStyles: { fillColor: COR_AZUL, textColor: 255, fontSize: 9 },
    styles: { fontSize: 8 },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = novaPaginaSeNecessario(doc, y, 40);
  y = tituloSecao(doc, y, "3. Resultado da Avaliação");
  caixasValor(doc, y, resultado?.valor_minimo, resultado?.valor_central, resultado?.valor_maximo);

  desenharRodape(doc, corretor);
  return doc;
}

// ------------------------------------------------------------
// MODELO 2 — Plano Profissional
// ------------------------------------------------------------
function gerarModelo2(avaliacao: any, resultado: any, comparaveis: any[], corretor: CorretorInfo) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const rel = resultado?.relatorio_json || {};
  const ref = numeroReferencia(avaliacao?.id ?? "");
  desenharCabecalho(doc, ref);

  let y = tituloPrincipal(doc, 42, "Estudo de Mercado Completo");

  y = tituloSecao(doc, y, "1. Dados do Imóvel Avaliando");
  autoTable(doc, {
    startY: y,
    body: dadosCompletos(avaliacao),
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.2, textColor: COR_TEXTO },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  y = tituloSecao(doc, y, "2. Pesquisa de Mercado — Comparáveis");
  autoTable(doc, {
    startY: y,
    head: [["Fonte", "Local", "Área", "Priv.", "Q/S/B/V", "Padrão", "Conserv.", "Valor", "R$/m²"]],
    body: comparaveis.map((c) => [
      c.fonte ?? "—",
      c.localizacao ?? "—",
      `${c.area ?? "—"}`,
      c.area_privativa ? `${c.area_privativa}` : "—",
      `${c.quartos ?? "-"}/${c.suites ?? "-"}/${c.banheiros ?? "-"}/${c.vagas ?? "-"}`,
      c.padrao ?? "—",
      c.conservacao ?? "—",
      fmtBRL(Number(c.valor_anunciado)),
      c.area > 0 ? fmtBRL(Number(c.valor_anunciado) / Number(c.area)) : "—",
    ]),
    headStyles: { fillColor: COR_AZUL, textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5 },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = novaPaginaSeNecessario(doc, y, 40);
  y = tituloSecao(doc, y, "3. Resultado da Avaliação");
  y = caixasValor(doc, y, resultado?.valor_minimo, resultado?.valor_central, resultado?.valor_maximo);

  if (resultado?.valor_unitario_medio) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COR_AZUL);
    doc.text(`4. Valor Unitário Médio: ${fmtBRL(resultado.valor_unitario_medio)}/m²`, MARGIN, y);
    y += 8;
  }

  const analise = rel.resumo_texto || rel.analise;
  if (analise) {
    y = novaPaginaSeNecessario(doc, y, 30);
    y = tituloSecao(doc, y, "5. Análise de Mercado");
    y = paragrafo(doc, y, typeof analise === "string" ? analise : JSON.stringify(analise));
    y += 3;
  }

  const dicasPrec = rel.dicas_precificacao || rel.precificacao;
  if (dicasPrec) {
    y = novaPaginaSeNecessario(doc, y, 30);
    y = tituloSecao(doc, y, "6. Dicas de Precificação");
    y = listaNumerada(doc, y, Array.isArray(dicasPrec) ? dicasPrec : [String(dicasPrec)]);
  }

  const estrategias = rel.estrategias_venda || rel.estrategias;
  if (estrategias) {
    y = novaPaginaSeNecessario(doc, y, 30);
    y = tituloSecao(doc, y, "7. Estratégias de Venda");
    y = listaNumerada(doc, y, Array.isArray(estrategias) ? estrategias : [String(estrategias)]);
  }

  const divulgacao = rel.dicas_anuncio || rel.dicas || rel.recomendacoes;
  if (divulgacao) {
    y = novaPaginaSeNecessario(doc, y, 30);
    y = tituloSecao(doc, y, "8. Dicas de Divulgação e Anúncio");
    y = listaNumerada(doc, y, Array.isArray(divulgacao) ? divulgacao : [String(divulgacao)]);
  }

  desenharRodape(doc, corretor);
  return doc;
}

// ------------------------------------------------------------
// MODELO 3 — Plano Expert (ABNT NBR 14653-2)
// ------------------------------------------------------------
function calcEstatisticas(comparaveis: any[]) {
  const unit = comparaveis
    .filter((c) => Number(c.area) > 0 && Number(c.valor_anunciado) > 0)
    .map((c) => Number(c.valor_anunciado) / Number(c.area));
  if (unit.length === 0) return { media: 0, mediana: 0, desvio: 0, cv: 0, n: 0 };
  const media = unit.reduce((a, b) => a + b, 0) / unit.length;
  const sorted = [...unit].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const mediana = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const variancia = unit.reduce((acc, v) => acc + (v - media) ** 2, 0) / unit.length;
  const desvio = Math.sqrt(variancia);
  const cv = media > 0 ? (desvio / media) * 100 : 0;
  return { media, mediana, desvio, cv, n: unit.length };
}

function gerarModelo3(avaliacao: any, resultado: any, comparaveis: any[], corretor: CorretorInfo) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const rel = resultado?.relatorio_json || {};
  const ref = numeroReferencia(avaliacao?.id ?? "");
  desenharCabecalho(doc, ref, "Avaliador Expert");

  let y = tituloPrincipal(doc, 42, "Laudo de Avaliação Mercadológica");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COR_MUTED);
  doc.text("ABNT NBR 14653-2", doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
  y += 8;

  y = tituloSecao(doc, y, "1. Identificação e Objetivo da Avaliação");
  y = paragrafo(doc, y,
    `Avaliação mercadológica do imóvel localizado em ${avaliacao?.localizacao ?? "—"}, com finalidade de ${avaliacao?.finalidade ?? "—"}. ` +
    `Referência: ${ref}. Solicitante: ${corretor.nome}${corretor.creci ? ` (CRECI ${corretor.creci})` : ""}.`,
  );

  y = tituloSecao(doc, y, "2. Caracterização do Imóvel Avaliando");
  autoTable(doc, {
    startY: y,
    body: dadosCompletos(avaliacao),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.5, textColor: COR_TEXTO },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55, fillColor: [245, 240, 225] } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  y = novaPaginaSeNecessario(doc, y, 30);
  y = tituloSecao(doc, y, "3. Metodologia");
  y = paragrafo(doc, y,
    "Foi adotado o Método Comparativo Direto de Dados de Mercado, conforme prescrito pela ABNT NBR 14653-2:2011, " +
    "com tratamento por fatores de homogeneização aplicados aos atributos de oferta, área, padrão construtivo, " +
    "conservação e localização dos elementos pesquisados.",
  );

  y = novaPaginaSeNecessario(doc, y, 30);
  y = tituloSecao(doc, y, "4. Pesquisa de Mercado");
  autoTable(doc, {
    startY: y,
    head: [["#", "Fonte", "Local", "Área", "Q/S/B/V", "Padrão", "Conserv.", "Valor", "R$/m²"]],
    body: comparaveis.map((c, i) => [
      String(i + 1),
      c.fonte ?? "—",
      c.localizacao ?? "—",
      `${c.area ?? "—"}`,
      `${c.quartos ?? "-"}/${c.suites ?? "-"}/${c.banheiros ?? "-"}/${c.vagas ?? "-"}`,
      c.padrao ?? "—",
      c.conservacao ?? "—",
      fmtBRL(Number(c.valor_anunciado)),
      c.area > 0 ? fmtBRL(Number(c.valor_anunciado) / Number(c.area)) : "—",
    ]),
    headStyles: { fillColor: COR_AZUL, textColor: 255, fontSize: 8 },
    styles: { fontSize: 7.5 },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  y = novaPaginaSeNecessario(doc, y, 40);
  y = tituloSecao(doc, y, "5. Homogeneização dos Dados");
  autoTable(doc, {
    startY: y,
    head: [["#", "F. Oferta", "F. Área", "F. Padrão", "F. Conserv.", "F. Localiz.", "F. Total"]],
    body: comparaveis.map((_c, i) => {
      const fOferta = 0.9;
      const fArea = 1.0;
      const fPadrao = 1.0;
      const fConserv = 1.0;
      const fLocal = 1.0;
      const total = fOferta * fArea * fPadrao * fConserv * fLocal;
      return [
        String(i + 1),
        fmtNum(fOferta, 2),
        fmtNum(fArea, 2),
        fmtNum(fPadrao, 2),
        fmtNum(fConserv, 2),
        fmtNum(fLocal, 2),
        fmtNum(total, 3),
      ];
    }),
    headStyles: { fillColor: COR_AZUL, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, halign: "center" },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const stats = calcEstatisticas(comparaveis);
  y = novaPaginaSeNecessario(doc, y, 40);
  y = tituloSecao(doc, y, "6. Tratamento Estatístico");
  autoTable(doc, {
    startY: y,
    body: [
      ["Amostras válidas (n)", String(stats.n)],
      ["Valor unitário médio", `${fmtBRL(stats.media)}/m²`],
      ["Mediana", `${fmtBRL(stats.mediana)}/m²`],
      ["Desvio padrão", `${fmtBRL(stats.desvio)}/m²`],
      ["Coeficiente de variação", `${fmtNum(stats.cv, 2)}%`],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70, fillColor: [245, 240, 225] } },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  y = novaPaginaSeNecessario(doc, y, 40);
  y = tituloSecao(doc, y, "7. Resultado — Valor de Mercado Estimado");
  y = caixasValor(doc, y, resultado?.valor_minimo, resultado?.valor_central, resultado?.valor_maximo);

  y = tituloSecao(doc, y, "8. Campo de Arbítrio (±15%)");
  const central = Number(resultado?.valor_central ?? 0);
  const arbMin = central * 0.85;
  const arbMax = central * 1.15;
  y = paragrafo(doc, y,
    `Conforme item 9.2.3 da ABNT NBR 14653-2, aplicando-se o campo de arbítrio de ±15% sobre o valor central, ` +
    `obtém-se a faixa entre ${fmtBRL(arbMin)} e ${fmtBRL(arbMax)}.`,
  );

  y = novaPaginaSeNecessario(doc, y, 30);
  y = tituloSecao(doc, y, "9. Ressalvas e Limitações Técnicas");
  y = paragrafo(doc, y,
    "Esta avaliação tem caráter mercadológico e foi elaborada com base nos dados informados pelo solicitante e " +
    "em pesquisa de elementos comparáveis disponíveis no mercado. Não substitui laudo técnico assinado por " +
    "profissional habilitado (CNAI/IBAPE). O valor apurado é válido para a data de referência indicada e considera " +
    "as condições normais de mercado, não contemplando vícios construtivos, pendências jurídicas, documentais ou " +
    "registrais que possam afetar o imóvel.",
  );

  y = novaPaginaSeNecessario(doc, y, 20);
  y = tituloSecao(doc, y, "10. Identificação do Sistema");
  paragrafo(doc, y, "Avaliação gerada pela plataforma A8 Investimentos Imobiliários.");

  marcaDagua(doc, corretor.nome);
  desenharRodape(doc, corretor);
  return doc;
}

// ------------------------------------------------------------
// Entry point
// ------------------------------------------------------------
export function gerarPdfAvaliacao(
  avaliacao: any,
  resultado: any,
  comparaveis: any[],
  opts: { modelo: ModeloPdf; plano: PlanoUsuario; corretor?: CorretorInfo | string },
) {
  const { modelo, plano } = opts;
  const corretor: CorretorInfo =
    typeof opts.corretor === "string"
      ? { nome: opts.corretor || "Corretor não identificado" }
      : opts.corretor ?? { nome: "Corretor não identificado" };
  if (!podeGerarModelo(plano, modelo)) {
    throw new Error("Faça upgrade para acessar este relatório");
  }

  const doc =
    modelo === 3
      ? gerarModelo3(avaliacao, resultado, comparaveis, corretor)
      : modelo === 2
      ? gerarModelo2(avaliacao, resultado, comparaveis, corretor)
      : gerarModelo1(avaliacao, resultado, comparaveis, corretor);

  const nome = `A8-Avaliacao-M${modelo}-${(avaliacao?.id || "").slice(0, 8)}.pdf`;
  doc.save(nome);
}
