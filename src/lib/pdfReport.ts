import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmtBRL = (v: number | null | undefined) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function gerarPdfAvaliacao(avaliacao: any, resultado: any, comparaveis: any[]) {
  const doc = new jsPDF();
  const rel = resultado?.relatorio_json || {};
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFillColor(15, 40, 92);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("A8 INVESTIMENTOS", 14, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Estudo de Mercado Simplificado", 14, 18);
  doc.text(new Date().toLocaleDateString("pt-BR"), pageW - 14, 13, { align: "right" });

  y = 32;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Dados do Imóvel Avaliando", 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const dados: [string, string][] = [
    ["Tipo", String(avaliacao.tipo_imovel ?? "—")],
    ["Finalidade", String(avaliacao.finalidade ?? "—")],
    ["Localização", String(avaliacao.localizacao ?? "—")],
    ["Área Total", `${avaliacao.area_total ?? "—"} m²`],
    ["Área Privativa", avaliacao.area_privativa ? `${avaliacao.area_privativa} m²` : "—"],
    ["Quartos / Suítes / Banheiros / Vagas", `${avaliacao.quartos ?? "—"} / ${avaliacao.suites ?? "—"} / ${avaliacao.banheiros ?? "—"} / ${avaliacao.vagas ?? "—"}`],
    ["Padrão / Conservação", `${avaliacao.padrao ?? "—"} / ${avaliacao.conservacao ?? "—"}`],
    ["Posição", String(avaliacao.posicao ?? "—")],
  ];
  autoTable(doc, {
    startY: y,
    body: dados,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 65 } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Valores
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Valor Estimado", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Mínimo", "Central", "Máximo"]],
    body: [[fmtBRL(resultado?.valor_minimo), fmtBRL(resultado?.valor_central), fmtBRL(resultado?.valor_maximo)]],
    headStyles: { fillColor: [199, 161, 79], textColor: 255 },
    styles: { fontSize: 11, halign: "center" },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Comparáveis
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Comparáveis Utilizados", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Fonte", "Localização", "Área", "Valor", "R$/m²"]],
    body: comparaveis.map((c) => [
      c.fonte ?? "—",
      c.localizacao ?? "—",
      `${c.area} m²`,
      fmtBRL(Number(c.valor_anunciado)),
      c.area > 0 ? fmtBRL(Number(c.valor_anunciado) / Number(c.area)) : "—",
    ]),
    headStyles: { fillColor: [15, 40, 92], textColor: 255 },
    styles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Análise
  const analise = rel.resumo_texto || rel.analise;
  if (analise) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Análise de Mercado", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const text = typeof analise === "string" ? analise : JSON.stringify(analise);
    const lines = doc.splitTextToSize(text, pageW - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 6;
  }

  // Dicas
  const dicas = rel.dicas_anuncio || rel.dicas || rel.recomendacoes;
  if (dicas) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Dicas de Anúncio e Venda", 14, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const arr = Array.isArray(dicas) ? dicas : [String(dicas)];
    arr.forEach((d: string) => {
      const lines = doc.splitTextToSize(`• ${d}`, pageW - 28);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 1;
    });
  }

  // Footer em todas as páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");
    const aviso = "Esta avaliação é mercadológica e não substitui laudo técnico assinado por profissional habilitado (CNAI/IBAPE)";
    const lines = doc.splitTextToSize(aviso, pageW - 28);
    doc.text(lines, pageW / 2, h - 8, { align: "center" });
    doc.text(`${i}/${total}`, pageW - 14, h - 8, { align: "right" });
  }

  doc.save(`avaliacao-${avaliacao.id}.pdf`);
}
