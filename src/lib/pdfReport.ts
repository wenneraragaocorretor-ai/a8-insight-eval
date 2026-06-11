import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { COVER_BG_BASE64 } from "../assets/cover-bg";

// ============================================================
// A8 Investimentos — PDF Premium (dark, landscape A4)
// 297mm x 210mm | Fundo escuro | Dourado #C8A951 | Azul #0F2D5C
// ============================================================

const BG: [number, number, number] = [255, 255, 255];        // #FFFFFF
const BG_SOFT: [number, number, number] = [247, 248, 250];   // #F7F8FA
const CARD_TOP: [number, number, number] = [255, 255, 255];  // white card
const CARD_BOTTOM: [number, number, number] = [247, 248, 250];
const CARD_BLUE: [number, number, number] = [230, 241, 251]; // #E6F1FB light blue
const BORDER: [number, number, number] = [232, 232, 232];    // #E8E8E8
const GOLD: [number, number, number] = [200, 169, 81];       // #C8A951
const BLUE: [number, number, number] = [15, 45, 92];         // #0F2D5C
const NAVY: [number, number, number] = [10, 31, 68];          // #0A1F44
const GOLD_LIGHT: [number, number, number] = [226, 201, 126]; // #E2C97E
const WHITE: [number, number, number] = [255, 255, 255];
const TEXT: [number, number, number] = [44, 44, 42];         // #2C2C2A
const GRAY: [number, number, number] = [90, 95, 105];
const GRAY_DIM: [number, number, number] = [140, 145, 155];

const PW = 297; // page width landscape
const PH = 210; // page height landscape
const M = 18;   // margin

export type PlanoUsuario = "basico" | "profissional" | "expert" | "user" | "pro" | string;
export type ModeloPdf = 1 | 2 | 3;
export type CorretorInfo = {
  nome: string;
  creci?: string | null;
  cnai?: string | null;
  outro_registro?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  email?: string | null;
  nome_imobiliaria?: string | null;
  logo_data_url?: string | null;
};

const fmtBRL = (v: number | null | undefined) =>
  v == null || isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtNum = (v: number | null | undefined, digits = 2) =>
  v == null || isNaN(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: digits });

const hoje = () => new Date().toLocaleDateString("pt-BR");

// Extrai apenas o domínio principal quando a fonte for uma URL completa
const fmtFonte = (f: any): string => {
  const s = String(f ?? "").trim();
  if (!s) return "—";
  const looksLikeUrl = /^https?:\/\//i.test(s) || /^www\./i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(s);
  if (!looksLikeUrl) return s;
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    const host = new URL(withProto).hostname.replace(/^www\./i, "");
    return host || s;
  } catch {
    return s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  }
};

export function modelosDisponiveis(plano: PlanoUsuario): ModeloPdf[] {
  const p = String(plano || "basico").toLowerCase();
  if (p === "expert") return [1, 2, 3];
  if (p === "profissional" || p === "pro") return [1, 2];
  return [1];
}

export function podeGerarModelo(plano: PlanoUsuario, modelo: ModeloPdf) {
  return modelosDisponiveis(plano).includes(modelo);
}

// ---------- helpers ----------
function pintarFundo(doc: jsPDF) {
  doc.setFillColor(...BG);
  doc.rect(0, 0, PW, PH, "F");
}

function novaPagina(doc: jsPDF) {
  doc.addPage();
  pintarFundo(doc);
}

function card(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { radius?: number; variant?: "white" | "blue" | "darkblue"; border?: "gold" | "soft" | "none" } = {},
) {
  const radius = opts.radius ?? 3;
  const variant = opts.variant ?? "white";
  const fill: [number, number, number] =
    variant === "darkblue" ? BLUE : variant === "blue" ? CARD_BLUE : WHITE;
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, radius, radius, "F");
  const border = opts.border ?? (variant === "white" ? "soft" : "none");
  if (border !== "none") {
    if (border === "gold") {
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
    } else {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
    }
    doc.roundedRect(x, y, w, h, radius, radius, "S");
  }
}

function tituloPagina(doc: jsPDF, texto: string, y = 28, cor: [number, number, number] = BLUE) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(...cor);
  doc.text(texto, M, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(1.2);
  doc.line(M, y + 3, M + 24, y + 3);
}

function microHeader(doc: jsPDF, corretor: CorretorInfo, laudoNum?: string) {
  // Faixa fina azul marinho no topo (12mm)
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, 12, "F");
  // Linha dourada inferior
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(0, 12, PW, 12);

  // Logo / marca à esquerda
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("A8", M, 7.8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text("INVESTIMENTOS  •  " + (corretor.nome || "").toUpperCase(), M + 7, 7.8);

  // Número do laudo à direita em dourado
  if (laudoNum) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.text(`LAUDO ${laudoNum}`, PW - M, 7.8, { align: "right" });
  }
}

function rodape(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    // Linha dourada fina
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(M, PH - 12, PW - M, PH - 12);

    // Logo pequeno à esquerda
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text("A8", M, PH - 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...NAVY);
    doc.text("INVESTIMENTOS", M + 6, PH - 7);

    // Disclaimer central em itálico cinza
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY_DIM);
    doc.text(
      "Esta avaliação é mercadológica e não substitui laudo técnico assinado por profissional habilitado (CNAI/IBAPE).",
      PW / 2,
      PH - 7,
      { align: "center" },
    );

    // Número da página em dourado à direita
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text(`${String(i).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, PW - M, PH - 7, { align: "right" });
  }
}

function textoMultilinha(
  doc: jsPDF,
  texto: string,
  x: number,
  y: number,
  w: number,
  opts: { size?: number; color?: [number, number, number]; bold?: boolean; lineHeight?: number } = {},
) {
  const size = opts.size ?? 10;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...(opts.color ?? GRAY));
  const lines = doc.splitTextToSize(texto, w);
  const lh = opts.lineHeight ?? size * 0.42;
  doc.text(lines, x, y);
  return y + lines.length * lh;
}

// ============================================================
// HELPERS VISUAIS (gauges, badges, mini-charts)
// ============================================================
function iconCircle(doc: jsPDF, cx: number, cy: number, r: number, glyph: string, cor: [number, number, number] = GOLD) {
  doc.setFillColor(...cor);
  doc.circle(cx, cy, r, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(r * 1.5);
  doc.setTextColor(255, 255, 255);
  doc.text(glyph, cx, cy + r * 0.55, { align: "center" });
}

function progressBar(doc: jsPDF, x: number, y: number, w: number, pct: number, cor: [number, number, number] = GOLD) {
  doc.setFillColor(...BORDER);
  doc.roundedRect(x, y, w, 3, 1.5, 1.5, "F");
  const p = Math.max(0, Math.min(1, pct));
  if (p > 0) {
    doc.setFillColor(...cor);
    doc.roundedRect(x, y, Math.max(3, w * p), 3, 1.5, 1.5, "F");
  }
}

function gaugeChart(doc: jsPDF, cx: number, cy: number, r: number, valor: number) {
  const v = Math.max(0, Math.min(10, valor));
  const segs = 40;
  const start = Math.PI;
  const end = 0;
  const colorFor = (t: number): [number, number, number] =>
    t < 0.4 ? [220, 53, 69] : t < 0.7 ? [240, 180, 60] : [40, 167, 105];
  doc.setLineWidth(5);
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const a1 = start + (end - start) * t;
    const a2 = start + (end - start) * ((i + 1) / segs);
    const filled = t <= v / 10;
    const col: [number, number, number] = filled ? colorFor(t) : [232, 232, 232];
    doc.setDrawColor(...col);
    doc.line(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cx + Math.cos(a2) * r, cy + Math.sin(a2) * r);
  }
  const angP = start + (end - start) * (v / 10);
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(1.2);
  doc.line(cx, cy, cx + Math.cos(angP) * (r - 4), cy + Math.sin(angP) * (r - 4));
  doc.setFillColor(...BLUE);
  doc.circle(cx, cy, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...BLUE);
  doc.text(v.toFixed(1), cx, cy + 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("/ 10", cx, cy + 17, { align: "center" });
}

function trendBadge(doc: jsPDF, cx: number, cy: number, w: number, h: number, tendencia: "alta" | "estavel" | "baixa") {
  const cor: [number, number, number] = tendencia === "alta" ? [40, 167, 105]
    : tendencia === "baixa" ? [220, 53, 69] : [240, 180, 60];
  const seta = tendencia === "alta" ? "^" : tendencia === "baixa" ? "v" : ">";
  const txt = tendencia === "alta" ? "VALORIZACAO" : tendencia === "baixa" ? "DESVALORIZACAO" : "ESTAVEL";
  doc.setFillColor(...cor);
  doc.roundedRect(cx - w / 2, cy - h / 2, w, h, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(seta, cx - w / 2 + 10, cy + 3);
  doc.setFontSize(11);
  doc.text(txt, cx + 4, cy + 3);
}

function checkIcon(doc: jsPDF, cx: number, cy: number, r: number, ok: boolean) {
  const cor: [number, number, number] = ok ? [40, 167, 105] : [200, 200, 205];
  doc.setFillColor(...cor);
  doc.circle(cx, cy, r, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(r * 1.4);
  doc.setTextColor(255, 255, 255);
  doc.text(ok ? "v" : "-", cx, cy + r * 0.5, { align: "center" });
}

function badgePadrao(padrao: string): { cor: [number, number, number]; label: string } {
  const p = String(padrao || "").toLowerCase();
  if (p.includes("luxo")) return { cor: [120, 81, 169], label: padrao };
  if (p.includes("alto")) return { cor: GOLD, label: padrao };
  if (p.includes("normal") || p.includes("médio") || p.includes("medio")) return { cor: BLUE, label: padrao };
  return { cor: [120, 125, 135], label: padrao || "—" };
}

function conservPct(c: string): number {
  const v = String(c || "").toLowerCase();
  if (v.includes("péssimo") || v.includes("pessimo") || v.includes("ruim")) return 0.18;
  if (v.includes("regular")) return 0.45;
  if (v.includes("bom")) return 0.72;
  if (v.includes("ótimo") || v.includes("otimo") || v.includes("novo") || v.includes("reformado")) return 1.0;
  return 0.55;
}

// ---------- PAGE 1: COVER ----------
function paginaCapa(
  doc: jsPDF,
  avaliacao: any,
  corretor: CorretorInfo,
  titulo: string,
  capaFoto?: string | null,
) {
  pintarFundo(doc);

  // ===== TOPO (60% da página): foto do imóvel com overlay marinho =====
  const fotoH = PH * 0.6; // ~126mm
  try {
    const img = capaFoto || COVER_BG_BASE64;
    const fmt = typeof img === "string" && img.includes("image/png") ? "PNG" : "JPEG";
    doc.addImage(img, fmt, 0, 0, PW, fotoH, undefined, "FAST");
  } catch {
    /* ignore */
  }

  // Overlay gradiente azul marinho escuro (várias camadas para fake gradient)
  doc.saveGraphicsState();
  // @ts-ignore
  doc.setGState(new (doc as any).GState({ opacity: 0.55 }));
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, fotoH, "F");
  doc.restoreGraphicsState();

  // Banda mais escura na base da foto para transição
  doc.saveGraphicsState();
  // @ts-ignore
  doc.setGState(new (doc as any).GState({ opacity: 0.85 }));
  doc.setFillColor(...NAVY);
  doc.rect(0, fotoH - 24, PW, 24, "F");
  doc.restoreGraphicsState();

  // ===== Faixa dourada no topo (6mm) =====
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, PW, 4, "F");
  doc.setFillColor(...GOLD_LIGHT);
  doc.rect(0, 4, PW, 1.2, "F");

  // ===== Bloco inferior (40%): fundo branco com texto e elementos =====
  doc.setFillColor(...WHITE);
  doc.rect(0, fotoH, PW, PH - fotoH, "F");

  // Faixa dourada na base (6mm)
  doc.setFillColor(...GOLD_LIGHT);
  doc.rect(0, PH - 5.2, PW, 1.2, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, PH - 4, PW, 4, "F");

  // ===== Ornamentos dourados nos cantos =====
  const ornamento = (x: number, y: number, dir: number) => {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(x, y, x + 14 * dir, y);
    doc.line(x, y, x, y + 14);
  };
  ornamento(M / 2 + 4, 10, 1);
  ornamento(PW - M / 2 - 4, 10, -1);

  // ===== Logo do corretor (top-left, sobre a foto) =====
  if (corretor.logo_data_url) {
    try {
      const fmt = corretor.logo_data_url.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(corretor.logo_data_url, fmt, M, 14, 28, 14, undefined, "FAST");
    } catch { /* ignore */ }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    doc.text("A8", M, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text("INVESTIMENTOS IMOBILIÁRIOS", M, 27);
  }

  // Etiqueta superior direita
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LIGHT);
  doc.text("LAUDO TÉCNICO", PW - M, 22, { align: "right" });
  doc.text("CONFIDENCIAL", PW - M, 27, { align: "right" });

  // ===== Título principal (serif dourado, centralizado no bloco branco) =====
  const yTituloCentro = fotoH + (PH - fotoH) / 2 - 6;

  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...GOLD);
  doc.text("LAUDO DE AVALIAÇÃO", PW / 2, yTituloCentro - 8, { align: "center" });
  doc.setFont("times", "italic");
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text("Mercadológica", PW / 2, yTituloCentro + 4, { align: "center" });

  // Divisor dourado
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(PW / 2 - 18, yTituloCentro + 9, PW / 2 + 18, yTituloCentro + 9);

  // Subtítulo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(
    "Conforme orientações da NBR 14653-2 da ABNT",
    PW / 2,
    yTituloCentro + 16,
    { align: "center" },
  );

  // ===== Endereço do imóvel (sobre a foto, em branco) =====
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(String(avaliacao?.localizacao ?? "").toUpperCase(), M, fotoH - 12);
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LIGHT);
  doc.text("IMÓVEL AVALIADO", M, fotoH - 17);

  // ===== Número do laudo + data (canto inferior direito do bloco branco, dourado) =====
  const laudoId = String(avaliacao?.id ?? "").slice(0, 8).toUpperCase();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("LAUDO Nº", PW - M, PH - 22, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(laudoId || "—", PW - M, PH - 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.text(hoje(), PW - M, PH - 10, { align: "right" });

  // Pequena referência do titulo original (parametrizada)
  if (titulo && !/laudo/i.test(titulo)) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(titulo, M, PH - 10);
  }
}

// ---------- PAGE: SUMÁRIO ----------
function paginaSumario(doc: jsPDF, sec: string[]) {
  novaPagina(doc);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(54);
  doc.setTextColor(...BLUE);
  doc.text("Sumário", M, 70);

  const xCard = PW / 2 + 4;
  const wCard = PW - xCard - M;
  const hCard = 14;
  const gap = 4;
  let y = 30;
  sec.forEach((nome, i) => {
    card(doc, xCard, y, wCard, hCard, { variant: "darkblue" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...GOLD);
    doc.text(String(i + 3).padStart(2, "0"), xCard + 6, y + 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(nome.toUpperCase(), xCard + 24, y + 9);
    y += hCard + gap;
  });
}

// ---------- PAGE: IMÓVEL ----------
function paginaImovel(doc: jsPDF, a: any, rel: any, corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "O Imóvel");

  // metric cards row
  const items: Array<[string, string]> = [
    ["TIPOLOGIA", String(a.tipo_imovel ?? "—")],
    ["QUARTOS", String(a.quartos ?? "—")],
    ["SUÍTES", String(a.suites ?? "—")],
    ["VAGAS", String(a.vagas ?? "—")],
    ["ÁREA (m²)", String(a.area_total ?? "—")],
  ];
  const usable = PW - M * 2;
  const gap = 4;
  const cw = (usable - gap * (items.length - 1)) / items.length;
  const ch = 32;
  const yRow = 50;
  items.forEach(([label, value], i) => {
    const x = M + i * (cw + gap);
    card(doc, x, yRow, cw, ch, { variant: "blue", border: "soft" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...BLUE);
    doc.text(label, x + cw / 2, yRow + 10, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...BLUE);
    const val = value.length > 14 ? value.slice(0, 13) + "…" : value;
    doc.text(val, x + cw / 2, yRow + 22, { align: "center" });
  });

  // location bar
  const yLoc = yRow + ch + 6;
  card(doc, M, yLoc, usable, 14, { variant: "darkblue" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("LOCALIZAÇÃO", M + 6, yLoc + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(String(a.localizacao ?? "—"), M + 6, yLoc + 11);

  // pros / cons
  const pos: string[] = Array.isArray(rel?.pontos_positivos) ? rel.pontos_positivos : [];
  const neg: string[] = Array.isArray(rel?.pontos_atencao)
    ? rel.pontos_atencao
    : Array.isArray(rel?.pontos_negativos)
    ? rel.pontos_negativos
    : [];
  const yPN = yLoc + 22;
  const colW = (usable - gap) / 2;
  const colH = PH - yPN - 18;
  card(doc, M, yPN, colW, colH, { variant: "white", border: "soft" });
  card(doc, M + colW + gap, yPN, colW, colH, { variant: "white", border: "soft" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLUE);
  doc.text("Pontos Positivos", M + 8, yPN + 12);
  doc.setTextColor(190, 50, 50);
  doc.text("Pontos de Atenção", M + colW + gap + 8, yPN + 12);

  let yp = yPN + 22;
  pos.slice(0, 6).forEach((p) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text("•", M + 8, yp);
    yp = textoMultilinha(doc, p, M + 12, yp, colW - 18, { size: 10, color: TEXT, lineHeight: 4.5 });
    yp += 3;
  });
  let yn = yPN + 22;
  neg.slice(0, 6).forEach((p) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(190, 50, 50);
    doc.text("•", M + colW + gap + 8, yn);
    yn = textoMultilinha(doc, p, M + colW + gap + 12, yn, colW - 18, { size: 10, color: TEXT, lineHeight: 4.5 });
    yn += 3;
  });
}

// ---------- PAGE: FOTOS DO IMÓVEL ----------
function paginaFotos(doc: jsPDF, rel: any, fotos: string[], corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Fotos do Imóvel");

  const usable = PW - M * 2;
  const gap = 6;
  // Reserva área para análise abaixo das fotos (~55mm)
  const analiseH = 55;
  const topY = 50;
  const fotosH = PH - topY - analiseH - 18;
  const n = Math.min(fotos.length, 3);

  const drawImg = (src: string, x: number, y: number, w: number, h: number) => {
    try {
      // detect type from dataURL
      const match = /^data:image\/(jpe?g|png|webp);base64,/i.exec(src);
      const fmt = match && match[1].toLowerCase().startsWith("png") ? "PNG"
        : match && match[1].toLowerCase() === "webp" ? "WEBP" : "JPEG";
      // fundo card
      doc.setFillColor(...CARD_BLUE);
      doc.roundedRect(x, y, w, h, 2, 2, "F");
      doc.addImage(src, fmt as any, x + 1, y + 1, w - 2, h - 2, undefined, "FAST");
    } catch (e) {
      console.error("Falha ao desenhar foto:", e);
      doc.setFillColor(...CARD_BLUE);
      doc.roundedRect(x, y, w, h, 2, 2, "F");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(...GRAY);
      doc.text("Foto indisponível", x + w / 2, y + h / 2, { align: "center" });
    }
  };

  if (n === 1) {
    drawImg(fotos[0], M, topY, usable, fotosH);
  } else if (n === 2) {
    const w = (usable - gap) / 2;
    drawImg(fotos[0], M, topY, w, fotosH);
    drawImg(fotos[1], M + w + gap, topY, w, fotosH);
  } else {
    // 3 fotos: 1 grande à esquerda + 2 menores à direita
    const wLeft = (usable - gap) * 0.6;
    const wRight = usable - gap - wLeft;
    const hRight = (fotosH - gap) / 2;
    drawImg(fotos[0], M, topY, wLeft, fotosH);
    drawImg(fotos[1], M + wLeft + gap, topY, wRight, hRight);
    drawImg(fotos[2], M + wLeft + gap, topY + hRight + gap, wRight, hRight);
  }

  // Caixa de análise
  const yAn = topY + fotosH + 6;
  card(doc, M, yAn, usable, analiseH - 12, { variant: "white", border: "gold" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text("Análise Visual (IA)", M + 8, yAn + 10);
  const analiseTxt =
    typeof rel?.analise_fotos === "string" && rel.analise_fotos.trim().length > 0
      ? rel.analise_fotos
      : "Análise visual das imagens não disponível.";
  textoMultilinha(doc, analiseTxt, M + 8, yAn + 18, usable - 16, {
    size: 10, color: TEXT, lineHeight: 4.6,
  });
}


// ---------- PAGE: ANÁLISE DO BAIRRO ----------
function paginaBairro(doc: jsPDF, a: any, rel: any, corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Análise do Bairro");

  const ab = rel?.analise_bairro ?? {};
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BLUE);
  doc.text(String(ab.bairro || a.localizacao || "—"), M, 46);

  const usable = PW - M * 2;
  const gap = 6;
  const colW = (usable - gap * 2) / 3;
  const yRow = 56;
  const ch = 84;

  // BLOCO 1 — Gauge Potencial de Valorização
  const score = Number(ab.score_valorizacao ?? rel?.score_valorizacao ?? 7.5);
  const pctValor = String(ab.percentual_valorizacao ?? rel?.percentual_valorizacao ?? "+8% a.a.");
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, yRow, colW, ch, 3, 3, "FD");
  doc.setFillColor(...GOLD);
  doc.rect(M, yRow, colW, 1.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLUE);
  doc.text("POTENCIAL DE VALORIZAÇÃO", M + colW / 2, yRow + 10, { align: "center" });
  gaugeChart(doc, M + colW / 2, yRow + 42, 22, score);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...GOLD);
  doc.text(pctValor, M + colW / 2, yRow + ch - 8, { align: "center" });

  // BLOCO 2 — Infraestrutura (grid de checks)
  const x2 = M + colW + gap;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(x2, yRow, colW, ch, 3, 3, "FD");
  doc.setFillColor(...GOLD);
  doc.rect(x2, yRow, colW, 1.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLUE);
  doc.text("INFRAESTRUTURA", x2 + colW / 2, yRow + 10, { align: "center" });

  const infraDefault = ["Escola", "Hospital", "Supermercado", "Transporte", "Farmácia", "Lazer"];
  const infraAtivos: string[] = Array.isArray(ab.infraestrutura)
    ? ab.infraestrutura.map((s: any) => String(s).toLowerCase())
    : infraDefault.map((s) => s.toLowerCase());
  const cols = 3;
  const itemW = (colW - 12) / cols;
  infraDefault.forEach((nome, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const ix = x2 + 6 + c * itemW + itemW / 2;
    const iy = yRow + 22 + r * 28;
    const ok = infraAtivos.some((v) => v.includes(nome.toLowerCase()));
    checkIcon(doc, ix, iy + 4, 4.5, ok);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...(ok ? TEXT : GRAY_DIM));
    doc.text(nome, ix, iy + 16, { align: "center" });
  });

  // BLOCO 3 — Tendência de Mercado
  const x3 = x2 + colW + gap;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(x3, yRow, colW, ch, 3, 3, "FD");
  doc.setFillColor(...GOLD);
  doc.rect(x3, yRow, colW, 1.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLUE);
  doc.text("TENDÊNCIA DE MERCADO", x3 + colW / 2, yRow + 10, { align: "center" });

  const tendStr = String(ab.tendencia ?? rel?.tendencia ?? "alta").toLowerCase();
  const tend: "alta" | "estavel" | "baixa" = tendStr.includes("desv") || tendStr.includes("baix")
    ? "baixa"
    : tendStr.includes("estav") ? "estavel" : "alta";
  trendBadge(doc, x3 + colW / 2, yRow + 36, colW - 16, 20, tend);
  textoMultilinha(
    doc,
    String(ab.tendencias_mercado ?? rel?.tendencias_mercado ?? "Mercado em movimento positivo, com demanda crescente na região."),
    x3 + 6, yRow + 56, colW - 12,
    { size: 9, color: TEXT, lineHeight: 4.2 },
  );

  // Resumo curto (máx 3 linhas)
  const yDesc = yRow + ch + 10;
  const resumo = String(ab.descricao ?? "").trim();
  if (resumo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text("SOBRE A REGIÃO", M, yDesc);
    textoMultilinha(doc, resumo, M, yDesc + 5, usable, {
      size: 10, color: TEXT, lineHeight: 4.6,
    });
  }
}

// ---------- PAGE: PERFIL DO PÚBLICO ----------
function paginaPerfil(doc: jsPDF, rel: any, corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Perfil do Público");

  const pp = rel?.perfil_publico ?? {};
  const usable = PW - M * 2;
  const cx = PW / 2;

  // Avatar centralizado
  doc.setFillColor(...CARD_BLUE);
  doc.circle(cx, 64, 14, "F");
  doc.setFillColor(...BLUE);
  doc.circle(cx, 60, 4, "F");
  doc.ellipse(cx, 70, 7, 4, "F");

  // Faixa etária
  const faixa = String(pp.faixa_etaria ?? pp.idade ?? rel?.perfil_idade ?? "35–50 anos");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...BLUE);
  doc.text(faixa, cx, 92, { align: "center" });

  // Renda badge dourado
  const renda = String(pp.faixa_renda ?? pp.renda_media ?? rel?.perfil_renda ?? "R$ 20.000+/mês");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const tw = doc.getTextWidth(renda) + 18;
  doc.setFillColor(...GOLD);
  doc.roundedRect(cx - tw / 2, 100, tw, 10, 5, 5, "F");
  doc.setTextColor(...WHITE);
  doc.text(renda, cx, 107, { align: "center" });

  // Perfil familiar
  const familia = String(pp.perfil_familiar ?? "Famílias com filhos");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(familia, cx, 122, { align: "center" });

  // 3 motivações com ícones
  const motivRaw = Array.isArray(pp.motivacoes) && pp.motivacoes.length
    ? pp.motivacoes.slice(0, 3).map(String)
    : String(pp.motivacao_compra ?? "Upgrade | Investimento | Família")
        .split(/[|,/]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 3);
  if (motivRaw.length) {
    const baseY = 138;
    const blockW = usable / motivRaw.length;
    const glyphs = ["♥", "★", "▲"];
    motivRaw.forEach((m: string, i: number) => {
      const mx = M + blockW * i + blockW / 2;
      iconCircle(doc, mx, baseY, 6, glyphs[i] || "•", GOLD);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...BLUE);
      doc.text(m, mx, baseY + 14, { align: "center" });
    });
  }

  // Interesses como chips coloridos
  const interesses: string[] = Array.isArray(pp.interesses)
    ? pp.interesses.filter(Boolean).map(String)
    : String(pp.interesses ?? pp.preferencias ?? "").split(/[|,]+/).map((s: string) => s.trim()).filter(Boolean);
  if (interesses.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text("INTERESSES", M, 168);
    let cxi = M;
    let cyi = 175;
    const cores: Array<[number, number, number]> = [BLUE, GOLD, [120, 81, 169], [40, 167, 105], [220, 100, 80]];
    interesses.slice(0, 14).forEach((it, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const w = doc.getTextWidth(it) + 10;
      if (cxi + w > PW - M) { cxi = M; cyi += 9; }
      const cor = cores[i % cores.length];
      doc.setFillColor(...cor);
      doc.roundedRect(cxi, cyi - 4, w, 7, 3.5, 3.5, "F");
      doc.setTextColor(...WHITE);
      doc.text(it, cxi + w / 2, cyi + 0.8, { align: "center" });
      cxi += w + 4;
    });
  }
}

// ---------- PAGE: ANÚNCIOS NA REGIÃO ----------
function paginaAnuncios(doc: jsPDF, comparaveis: any[], corretor: CorretorInfo) {
  // Referência: mediana de R$/m²
  const unit = comparaveis
    .filter((c) => Number(c.area) > 0 && Number(c.valor_anunciado) > 0)
    .map((c) => Number(c.valor_anunciado) / Number(c.area));
  const sortedRef = [...unit].sort((a, b) => a - b);
  const ref = sortedRef.length ? sortedRef[Math.floor(sortedRef.length / 2)] : 0;

  const PER_PAGE = 4;
  for (let p = 0; p < Math.ceil(comparaveis.length / PER_PAGE); p++) {
    novaPagina(doc);
    microHeader(doc, corretor);
    if (p === 0) tituloPagina(doc, "Comparáveis");

    const pageItems = comparaveis.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const usable = PW - M * 2;
    const gap = 6;
    const cw = (usable - gap) / 2;
    const ch = 62;
    const yStart = 50;

    pageItems.forEach((c, idx) => {
      const i = p * PER_PAGE + idx;
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = M + col * (cw + gap);
      const y = yStart + row * (ch + gap);

      // Card
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cw, ch, 3, 3, "FD");
      doc.setFillColor(...GOLD);
      doc.rect(x, y, cw, 1.4, "F");

      // Número círculo dourado
      doc.setFillColor(...GOLD);
      doc.circle(x + 10, y + 13, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...WHITE);
      doc.text(String(i + 1), x + 10, y + 14.5, { align: "center" });

      // Valor em destaque
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...BLUE);
      doc.text(fmtBRL(Number(c.valor_anunciado)), x + 20, y + 15);

      // Badge R$/m²
      const vm = Number(c.area) > 0 ? Number(c.valor_anunciado) / Number(c.area) : 0;
      if (vm > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const lbl = `${fmtBRL(vm)}/m²`;
        const bw = doc.getTextWidth(lbl) + 8;
        doc.setFillColor(...BLUE);
        doc.roundedRect(x + cw - bw - 6, y + 8, bw, 8, 4, 4, "F");
        doc.setTextColor(...WHITE);
        doc.text(lbl, x + cw - bw / 2 - 6, y + 13.5, { align: "center" });
      }

      // Ícones quartos/vagas/área
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT);
      const linha = `${c.quartos ?? 0} qtos  ·  ${c.vagas ?? 0} vagas  ·  ${c.area ?? "—"} m²`;
      doc.text(linha, x + 8, y + 28);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      const fonteTxt = `${fmtFonte(c.fonte)} · ${String(c.localizacao || "").slice(0, 42)}`;
      doc.text(fonteTxt, x + 8, y + 35);

      // Barra de comparação relativa ao imóvel avaliado (mediana)
      if (ref > 0 && vm > 0) {
        const barX = x + 8;
        const barY = y + ch - 13;
        const barW = cw - 16;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.text("ABAIXO", barX, barY - 1);
        doc.text("SIMILAR", barX + barW / 2, barY - 1, { align: "center" });
        doc.text("ACIMA", barX + barW, barY - 1, { align: "right" });
        doc.setFillColor(...BORDER);
        doc.roundedRect(barX, barY + 1, barW, 3, 1.5, 1.5, "F");
        const ratio = vm / ref;
        const t = Math.max(0, Math.min(1, (ratio - 0.7) / 0.6));
        const mx = barX + t * barW;
        const cor: [number, number, number] = t < 0.4 ? [40, 167, 105] : t > 0.6 ? [220, 53, 69] : GOLD;
        doc.setFillColor(...cor);
        doc.circle(mx, barY + 2.5, 2.5, "F");
      }
    });
  }
}

// ---------- PAGE: VALOR DO IMÓVEL ----------
function paginaValor(doc: jsPDF, resultado: any, corretor: CorretorInfo) {
  novaPagina(doc);
  // Fundo navy total
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, PH, "F");
  microHeader(doc, corretor);

  const central = Number(resultado?.valor_central) || 0;
  const minV = Number(resultado?.valor_minimo) || central * 0.85;
  const maxV = Number(resultado?.valor_maximo) || central * 1.15;

  // Faixa dourada
  doc.setFillColor(...GOLD);
  doc.rect(0, 38, PW, 0.6, "F");

  // Título pequeno
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text("VALOR DE MERCADO ESTIMADO", PW / 2, 58, { align: "center" });

  // Valor central enorme dourado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(72);
  doc.setTextColor(...GOLD);
  doc.text(fmtBRL(central), PW / 2, 102, { align: "center" });

  // Termômetro horizontal
  const tx = M + 30;
  const tw = PW - M * 2 - 60;
  const ty = 130;
  doc.setFillColor(60, 75, 110);
  doc.roundedRect(tx, ty, tw, 6, 3, 3, "F");
  doc.setFillColor(...GOLD);
  doc.roundedRect(tx + tw * 0.15, ty + 1.5, tw * 0.7, 3, 1.5, 1.5, "F");
  doc.setFillColor(...GOLD);
  doc.circle(tx + tw / 2, ty + 3, 4.5, "F");
  doc.setDrawColor(...WHITE);
  doc.setLineWidth(0.8);
  doc.circle(tx + tw / 2, ty + 3, 4.5, "S");

  // Labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text(fmtBRL(minV), tx, ty + 16, { align: "center" });
  doc.text(fmtBRL(central), tx + tw / 2, ty + 16, { align: "center" });
  doc.text(fmtBRL(maxV), tx + tw, ty + 16, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 210);
  doc.text("Mínimo -15%", tx, ty + 22, { align: "center" });
  doc.text("Central", tx + tw / 2, ty + 22, { align: "center" });
  doc.text("Máximo +15%", tx + tw, ty + 22, { align: "center" });

  // 3 ícones informativos
  const tips = [
    { glyph: "$", txt: "Inicie acima do central" },
    { glyph: "#", txt: "Baseado em comparáveis" },
    { glyph: "@", txt: "Válido por 6 meses" },
  ];
  const baseY = PH - 38;
  const tipW = (PW - M * 2) / 3;
  tips.forEach((t, i) => {
    const cx = M + tipW * i + tipW / 2;
    iconCircle(doc, cx, baseY, 6, t.glyph, GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text(t.txt, cx, baseY + 14, { align: "center" });
  });
}

// ---------- PAGE: CONTATO ----------
function paginaContato(doc: jsPDF, corretor: CorretorInfo) {
  novaPagina(doc);
  // full BLUE background
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, PW, PH, "F");

  // Logo do corretor (se disponível)
  if (corretor.logo_data_url) {
    try {
      const fmt = corretor.logo_data_url.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(corretor.logo_data_url, fmt, PW / 2 - 18, 18, 36, 18, undefined, "FAST");
    } catch { /* ignore */ }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text(
    (corretor.nome_imobiliaria || "A8 INVESTIMENTOS IMOBILIÁRIOS").toUpperCase(),
    PW / 2, 44, { align: "center" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(corretor.nome.toUpperCase(), PW / 2, 52, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(96);
  doc.setTextColor(...WHITE);
  doc.text("Obrigado!", PW / 2, 114, { align: "center" });

  // contact pills (outlined gold)
  const localCidade = [corretor.cidade, corretor.estado].filter(Boolean).join(" / ");
  const items = [
    corretor.telefone ? `Tel  ${corretor.telefone}` : null,
    corretor.email ? `Email  ${corretor.email}` : null,
    localCidade ? `Local  ${localCidade}` : null,
  ].filter(Boolean) as string[];

  let totalW = 0;
  const pads: number[] = [];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  items.forEach((t) => {
    const w = doc.getTextWidth(t) + 18;
    pads.push(w);
    totalW += w;
  });
  totalW += (items.length - 1) * 6;
  let x = (PW - totalW) / 2;
  const y = 140;
  items.forEach((t, i) => {
    const w = pads[i];
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.setFillColor(...BLUE);
    doc.roundedRect(x, y, w, 14, 7, 7, "FD");
    doc.setTextColor(...WHITE);
    doc.text(t, x + w / 2, y + 9.2, { align: "center" });
    x += w + 6;
  });

  // Registros profissionais (um abaixo do outro)
  const stripPrefix = (v: string, prefixes: string[]) => {
    let s = v.trim();
    for (const p of prefixes) {
      const re = new RegExp(`^${p}[\\s\\-:]*`, "i");
      if (re.test(s)) { s = s.replace(re, "").trim(); break; }
    }
    return s;
  };
  const detectarLabel = (v: string): { label: string; value: string } => {
    const s = v.trim();
    if (/^cau\b/i.test(s)) return { label: "CAU", value: stripPrefix(s, ["CAU"]) };
    if (/^crea\b/i.test(s)) return { label: "CREA", value: stripPrefix(s, ["CREA"]) };
    return { label: "Registro", value: s };
  };
  const registros: string[] = [];
  if (corretor.creci) registros.push(`CRECI: ${stripPrefix(corretor.creci, ["CRECI"])}`);
  if (corretor.cnai) registros.push(`CNAI: ${stripPrefix(corretor.cnai, ["CNAI"])}`);
  if (corretor.outro_registro) {
    const { label, value } = detectarLabel(corretor.outro_registro);
    registros.push(`${label}: ${value}`);
  }
  if (registros.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    let yr = y + 24;
    registros.forEach((r) => {
      doc.text(r, PW / 2, yr, { align: "center" });
      yr += 6;
    });
  }

  // Disclaimer técnico (CNAI/IBAPE)
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(
    "Esta avaliação é mercadológica e não substitui laudo técnico",
    PW / 2,
    PH - 32,
    { align: "center" }
  );
  doc.text(
    "aprovado por profissional habilitado (CNAI/IBAPE).",
    PW / 2,
    PH - 27,
    { align: "center" }
  );

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text("Gerado pela plataforma A8 Investimentos Imobiliários", PW / 2, PH - 18, { align: "center" });
}

// ---------- EXPERT EXTRA: HOMOGENEIZAÇÃO ----------
function paginaHomogeneizacao(doc: jsPDF, a: any, comparaveis: any[], corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Homogeneização");

  const norm = (v: any) => String(v ?? "").trim().toLowerCase();
  const ordemPadrao = ["baixo", "simples", "popular", "medio", "médio", "normal", "alto", "luxo", "alto luxo"];
  const ordemConserv = ["ruim", "regular", "bom", "novo", "reformado"];
  const rank = (lista: string[], v: string) => { const i = lista.indexOf(v); return i === -1 ? 0 : i; };

  type Row = { idx: number; fonte: string; fatores: Array<[string, number]>; total: number };
  const rows: Row[] = comparaveis.map((c, i) => {
    const fOferta = 0.9;
    const areaA = Number(a?.area_total) || 0;
    const areaC = Number(c.area) || 0;
    let fArea = 1.0;
    if (areaA > 0 && areaC > 0) fArea = Math.max(0.8, Math.min(1.2, Math.pow(areaC / areaA, 0.25)));
    const pA = rank(ordemPadrao, norm(a?.padrao));
    const pC = rank(ordemPadrao, norm(c.padrao));
    const fPadrao = pC === pA ? 1.0 : pC < pA ? 1.1 : 0.9;
    const cA = rank(ordemConserv, norm(a?.conservacao));
    const cC = rank(ordemConserv, norm(c.conservacao));
    const fConserv = cC === cA ? 1.0 : cC < cA ? 1.08 : 0.95;
    const locA = norm(a?.localizacao);
    const locC = norm(c.localizacao);
    const fLocal = !locA || !locC ? 1.0 : locA === locC ? 1.0 : locA.split(",")[0] === locC.split(",")[0] ? 0.98 : 0.95;
    const total = fOferta * fArea * fPadrao * fConserv * fLocal;
    return {
      idx: i + 1,
      fonte: fmtFonte(c.fonte),
      fatores: [["Oferta", fOferta], ["Área", fArea], ["Padrão", fPadrao], ["Conservação", fConserv], ["Localização", fLocal]],
      total,
    };
  });

  const usable = PW - M * 2;
  const yStart = 50;
  const available = PH - yStart - 20;
  const rowH = Math.min(28, available / Math.max(1, rows.length));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Cada barra representa um fator aplicado. Azul = deságio (<1) · Dourado = prêmio (>1)", M, yStart - 4);

  rows.forEach((r, ri) => {
    const y = yStart + ri * rowH;
    // Cabeçalho
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.text(`#${r.idx} · ${r.fonte}`, M, y + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...GOLD);
    doc.text(`Fator Total: ${fmtNum(r.total, 3)}`, PW - M, y + 4, { align: "right" });

    // Barras
    const barH = 2.4;
    const gap = 1.2;
    const barAreaY = y + 7;
    const labelW = 30;
    const valueW = 14;
    const barAreaW = usable - labelW - valueW - 6;
    const refX = M + labelW + barAreaW / 2;
    r.fatores.forEach((f, fi) => {
      const [label, val] = f;
      const by = barAreaY + fi * (barH + gap);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT);
      doc.text(label, M, by + 2);
      doc.setFillColor(...BORDER);
      doc.rect(M + labelW, by, barAreaW, barH, "F");
      const cor: [number, number, number] = val < 1 ? BLUE : val > 1 ? GOLD : [120, 125, 135];
      const delta = val - 1;
      const half = barAreaW / 2;
      const len = Math.min(half, Math.abs(delta) * half / 0.2);
      doc.setFillColor(...cor);
      if (delta < 0) doc.rect(refX - len, by, len, barH, "F");
      else if (delta > 0) doc.rect(refX, by, len, barH, "F");
      else doc.rect(refX - 0.4, by, 0.8, barH, "F");
      doc.setDrawColor(...GRAY_DIM);
      doc.setLineWidth(0.2);
      doc.line(refX, by - 0.4, refX, by + barH + 0.4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...cor);
      doc.text(fmtNum(val, 2), M + labelW + barAreaW + 4, by + 2);
    });

    if (ri < rows.length - 1) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(M, y + rowH - 1, PW - M, y + rowH - 1);
    }
  });
}

// ---------- EXPERT EXTRA: TRATAMENTO ESTATÍSTICO ----------
function paginaEstatistica(doc: jsPDF, comparaveis: any[], corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Tratamento Estatístico");

  const unit = comparaveis
    .filter((c) => Number(c.area) > 0 && Number(c.valor_anunciado) > 0)
    .map((c) => Number(c.valor_anunciado) / Number(c.area));
  let media = 0, mediana = 0, desvio = 0, cv = 0;
  if (unit.length) {
    media = unit.reduce((a, b) => a + b, 0) / unit.length;
    const sorted = [...unit].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    mediana = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const variancia = unit.reduce((acc, v) => acc + (v - media) ** 2, 0) / unit.length;
    desvio = Math.sqrt(variancia);
    cv = media > 0 ? (desvio / media) * 100 : 0;
  }

  const cvColor: [number, number, number] = cv < 15 ? [40, 167, 105] : cv < 30 ? [240, 180, 60] : [220, 53, 69];

  const usable = PW - M * 2;
  const gap = 6;
  const cw = (usable - gap * 3) / 4;
  const ch = 52;
  const yRow = 56;

  const cards: Array<{ bg: [number, number, number]; fg: [number, number, number]; accent: [number, number, number]; label: string; value: string }> = [
    { bg: NAVY, fg: WHITE, accent: GOLD, label: "Média R$/m²", value: fmtBRL(media) },
    { bg: BLUE, fg: WHITE, accent: GOLD, label: "Mediana R$/m²", value: fmtBRL(mediana) },
    { bg: WHITE, fg: BLUE, accent: GOLD, label: "Desvio Padrão", value: fmtBRL(desvio) },
    { bg: WHITE, fg: cvColor, accent: cvColor, label: "Coef. Variação", value: `${fmtNum(cv, 1)}%` },
  ];
  cards.forEach((c, i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(...c.bg);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yRow, cw, ch, 3, 3, "FD");
    doc.setFillColor(...c.accent);
    doc.rect(x, yRow, cw, 1.6, "F");
    const isLight = c.bg[0] > 200;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...(isLight ? GRAY : ([220, 220, 220] as [number, number, number])));
    doc.text(c.label.toUpperCase(), x + cw / 2, yRow + 12, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(c.value.length > 10 ? 14 : 20);
    doc.setTextColor(...c.fg);
    doc.text(c.value, x + cw / 2, yRow + 32, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...(isLight ? GRAY : ([200, 200, 200] as [number, number, number])));
    doc.text(`n = ${unit.length}`, x + cw / 2, yRow + ch - 6, { align: "center" });
  });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const cvDesc = cv < 15 ? "amostra muito homogênea" : cv < 30 ? "amostra aceitável" : "amostra com alta dispersão";
  textoMultilinha(
    doc,
    `Tratamento por fatores de homogeneização (ABNT NBR 14653-2). Coef. de variação de ${fmtNum(cv, 1)}% — ${cvDesc}.`,
    M, yRow + ch + 12, usable,
    { size: 11, color: TEXT, lineHeight: 5.2 },
  );
}

// ---------- EXPERT EXTRA: CAMPO DE ARBÍTRIO ----------
function paginaArbitrio(doc: jsPDF, resultado: any, corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Campo de Arbítrio");

  const c = Number(resultado?.valor_central ?? 0);
  const minA = c * 0.85;
  const maxA = c * 1.15;

  const usable = PW - M * 2;
  const yRow = 60;
  const ch = 60;
  const gap = 6;
  const cw = (usable - gap * 2) / 3;

  const items: Array<[string, string]> = [
    ["LIMITE INFERIOR (-15%)", fmtBRL(minA)],
    ["VALOR CENTRAL", fmtBRL(c)],
    ["LIMITE SUPERIOR (+15%)", fmtBRL(maxA)],
  ];
  items.forEach(([l, v], i) => {
    const x = M + i * (cw + gap);
    card(doc, x, yRow, cw, ch, { variant: i === 1 ? "darkblue" : "white", border: i === 1 ? "gold" : "soft" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...(i === 1 ? GOLD : BLUE));
    doc.text(l, x + cw / 2, yRow + 18, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(i === 1 ? 26 : 20);
    doc.setTextColor(...(i === 1 ? WHITE : BLUE));
    doc.text(v, x + cw / 2, yRow + 42, { align: "center" });
  });

  textoMultilinha(
    doc,
    "Conforme item 9.2.3 da ABNT NBR 14653-2, é admitido um campo de arbítrio de ±15% sobre o valor central como margem técnica de ajuste, sem alterar o grau de fundamentação da avaliação.",
    M,
    yRow + ch + 18,
    usable,
    { size: 11, color: TEXT, lineHeight: 5.4 },
  );
}

// ============================================================
// Orquestração dos modelos
// ============================================================
function gerarModelo1(avaliacao: any, resultado: any, comparaveis: any[], corretor: CorretorInfo, fotos: string[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const rel = resultado?.relatorio_json || {};
  const temFotos = fotos.length > 0;
  paginaCapa(doc, avaliacao, corretor, "Estudo de Mercado");
  paginaSumario(
    doc,
    ["O Imóvel", ...(temFotos ? ["Fotos do Imóvel"] : []), "Análise do Bairro", "Anúncios na Região", "Valor do Imóvel", "Contato"],
  );
  paginaImovel(doc, avaliacao, rel, corretor);
  paginaAmbientes(doc, avaliacao, corretor);
  if (temFotos) paginaFotos(doc, rel, fotos, corretor);
  paginaBairro(doc, avaliacao, rel, corretor);
  paginaAnuncios(doc, comparaveis, corretor);
  paginaValor(doc, resultado, corretor);
  paginaContato(doc, corretor);
  rodape(doc);
  return doc;
}

function gerarModelo2(avaliacao: any, resultado: any, comparaveis: any[], corretor: CorretorInfo, fotos: string[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const rel = resultado?.relatorio_json || {};
  const temFotos = fotos.length > 0;
  paginaCapa(doc, avaliacao, corretor, "Estudo de Mercado");
  paginaSumario(
    doc,
    ["O Imóvel", ...(temFotos ? ["Fotos do Imóvel"] : []), "Análise do Bairro", "Perfil do Público", "Anúncios na Região", "Valor do Imóvel", "Contato"],
  );
  paginaImovel(doc, avaliacao, rel, corretor);
  paginaAmbientes(doc, avaliacao, corretor);
  if (temFotos) paginaFotos(doc, rel, fotos, corretor);
  paginaBairro(doc, avaliacao, rel, corretor);
  paginaPerfil(doc, rel, corretor);
  paginaAnuncios(doc, comparaveis, corretor);
  paginaValor(doc, resultado, corretor);
  paginaContato(doc, corretor);
  rodape(doc);
  return doc;
}

function paginaFichaTecnica(doc: jsPDF, a: any, corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Ficha Técnica");

  const usable = PW - M * 2;
  const yTop = 50;

  // ===== CARDS PRINCIPAIS =====
  const principais: Array<{ icon: string; value: string; label: string }> = [];
  if (a.quartos != null && Number(a.quartos) > 0) principais.push({ icon: "Q", value: String(a.quartos), label: "Quartos" });
  if (a.suites != null && Number(a.suites) > 0) principais.push({ icon: "S", value: String(a.suites), label: "Suítes" });
  const vagas = (Number(a.vagas_cobertas) || 0) + (Number(a.vagas_descobertas) || 0) || Number(a.vagas) || 0;
  if (vagas > 0) principais.push({ icon: "V", value: String(vagas), label: "Vagas" });
  if (a.area_total) principais.push({ icon: "A", value: String(a.area_total), label: "m² Área" });

  if (principais.length) {
    const gap = 6;
    const cw = (usable - gap * (principais.length - 1)) / principais.length;
    const ch = 50;
    principais.forEach((p, i) => {
      const x = M + i * (cw + gap);
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, yTop, cw, ch, 3, 3, "FD");
      doc.setFillColor(...GOLD);
      doc.rect(x, yTop, cw, 1.6, "F");
      iconCircle(doc, x + cw / 2, yTop + 14, 5, p.icon, GOLD);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.setTextColor(...BLUE);
      doc.text(p.value, x + cw / 2, yTop + 36, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(p.label.toUpperCase(), x + cw / 2, yTop + ch - 5, { align: "center" });
    });
  }

  // ===== CARDS SECUNDÁRIOS =====
  const ySec = yTop + 56;
  const sec: Array<(x: number, y: number, w: number, h: number) => void> = [];

  if (a.padrao) {
    sec.push((x, y, w, h) => {
      const b = badgePadrao(String(a.padrao));
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x, y, w, h, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text("PADRÃO CONSTRUTIVO", x + w / 2, y + 8, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const tw = doc.getTextWidth(b.label) + 12;
      doc.setFillColor(...b.cor);
      doc.roundedRect(x + (w - tw) / 2, y + h / 2 - 3, tw, 10, 5, 5, "F");
      doc.setTextColor(...WHITE);
      doc.text(b.label, x + w / 2, y + h / 2 + 4, { align: "center" });
    });
  }
  if (a.conservacao) {
    sec.push((x, y, w, h) => {
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x, y, w, h, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text("ESTADO DE CONSERVAÇÃO", x + w / 2, y + 8, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...BLUE);
      doc.text(String(a.conservacao), x + w / 2, y + h / 2, { align: "center" });
      progressBar(doc, x + 8, y + h / 2 + 5, w - 16, conservPct(String(a.conservacao)));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text("Péssimo", x + 8, y + h - 3);
      doc.text("Ótimo", x + w - 8, y + h - 3, { align: "right" });
    });
  }
  if (a.posicao_solar) {
    sec.push((x, y, w, h) => {
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x, y, w, h, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text("POSIÇÃO SOLAR", x + w / 2, y + 8, { align: "center" });
      iconCircle(doc, x + w / 2, y + h / 2 - 1, 6, "*", GOLD);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...BLUE);
      doc.text(String(a.posicao_solar), x + w / 2, y + h - 5, { align: "center" });
    });
  }
  if (a.numero_pavimentos || a.total_andares) {
    sec.push((x, y, w, h) => {
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x, y, w, h, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text("PAVIMENTOS", x + w / 2, y + 8, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(...BLUE);
      doc.text(String(a.numero_pavimentos || a.total_andares), x + w / 2, y + h / 2 + 8, { align: "center" });
    });
  }

  let yAcab = ySec;
  if (sec.length) {
    const gap = 6;
    const cw = (usable - gap * (sec.length - 1)) / sec.length;
    const ch = 38;
    sec.forEach((r, i) => r(M + i * (cw + gap), ySec, cw, ch));
    yAcab = ySec + ch + 10;
  }

  // ===== AMBIENTES como chips =====
  const ambientes: string[] = [
    ...(Array.isArray(a.ambientes_sociais) ? a.ambientes_sociais : []),
    ...(Array.isArray(a.ambientes_servico) ? a.ambientes_servico : []),
    ...(Array.isArray(a.ambientes_outros) ? a.ambientes_outros : []),
  ].filter((s: any) => typeof s === "string" && s.trim().length > 0);

  if (ambientes.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text("AMBIENTES", M, yAcab + 4);
    let cxi = M;
    let cyi = yAcab + 12;
    ambientes.slice(0, 28).forEach((it) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const tw = doc.getTextWidth(it) + 10;
      if (cxi + tw > PW - M) { cxi = M; cyi += 9; }
      doc.setFillColor(...CARD_BLUE);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.roundedRect(cxi, cyi - 4, tw, 7, 3.5, 3.5, "FD");
      doc.setTextColor(...BLUE);
      doc.text(it, cxi + tw / 2, cyi + 0.8, { align: "center" });
      cxi += tw + 4;
    });
    yAcab = cyi + 10;
  }

  // ===== ACABAMENTOS =====
  const acab: string[] = Array.isArray(a.tipo_acabamento)
    ? a.tipo_acabamento.filter((s: any) => typeof s === "string" && s.trim().length > 0)
    : [];
  if (acab.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text("ACABAMENTOS", M, yAcab + 4);
    let cxi = M;
    let cyi = yAcab + 12;
    acab.forEach((it) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const tw = doc.getTextWidth(it) + 12;
      if (cxi + tw > PW - M) { cxi = M; cyi += 9; }
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.4);
      doc.roundedRect(cxi, cyi - 4, tw, 7, 3.5, 3.5, "FD");
      doc.setFillColor(...GOLD);
      doc.circle(cxi + 3.5, cyi - 0.6, 1, "F");
      doc.setTextColor(...TEXT);
      doc.text(it, cxi + 7, cyi + 0.8);
      cxi += tw + 4;
    });
    yAcab = cyi + 10;
  }

  // ===== INFRA LAZER =====
  const lazer: string[] = Array.isArray(a.infraestrutura_lazer)
    ? a.infraestrutura_lazer.filter((s: any) => typeof s === "string" && s.trim().length > 0)
    : [];
  if (lazer.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text("INFRAESTRUTURA DE LAZER", M, yAcab + 4);
    let cxi = M;
    let cyi = yAcab + 12;
    lazer.forEach((it) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const tw = doc.getTextWidth(it) + 10;
      if (cxi + tw > PW - M) { cxi = M; cyi += 9; }
      doc.setFillColor(...CARD_BLUE);
      doc.roundedRect(cxi, cyi - 4, tw, 7, 3.5, 3.5, "F");
      doc.setTextColor(...BLUE);
      doc.text(it, cxi + tw / 2, cyi + 0.8, { align: "center" });
      cxi += tw + 4;
    });
  }
}

function paginaAmbientes(doc: jsPDF, a: any, corretor: CorretorInfo) {
  const sociais: string[] = Array.isArray(a.ambientes_sociais)
    ? a.ambientes_sociais.filter((s: any) => typeof s === "string" && s.trim().length > 0)
    : [];
  const servico: string[] = Array.isArray(a.ambientes_servico)
    ? a.ambientes_servico.filter((s: any) => typeof s === "string" && s.trim().length > 0)
    : [];
  const outros: string[] = Array.isArray(a.ambientes_outros)
    ? a.ambientes_outros.filter((s: any) => typeof s === "string" && s.trim().length > 0)
    : [];
  if (sociais.length === 0 && servico.length === 0 && outros.length === 0) return;

  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Ambientes do Imóvel");

  const usable = PW - M * 2;
  let y = 50;

  const grupos: Array<[string, string[]]> = [
    ["Ambientes Sociais", sociais],
    ["Ambientes de Serviço", servico],
    ["Outros Ambientes", outros],
  ];

  grupos.forEach(([titulo, itens]) => {
    if (itens.length === 0) return;
    const cols = 3;
    const lineH = 6;
    const rows = Math.ceil(itens.length / cols);
    const boxH = 18 + rows * lineH;
    card(doc, M, y, usable, boxH, { variant: "white", border: "gold" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BLUE);
    doc.text(titulo, M + 8, y + 10);
    const colInnerW = (usable - 16) / cols;
    itens.forEach((item, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = M + 8 + c * colInnerW;
      const yi = y + 18 + r * lineH;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...GOLD);
      doc.text("•", x, yi);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT);
      doc.text(item, x + 4, yi);
    });
    y += boxH + 6;
  });
}

function paginaDocumentacaoFotografica(doc: jsPDF, fotosDet: FotoDetalhada[], corretor: CorretorInfo) {
  if (fotosDet.length === 0) return;
  const usable = PW - M * 2;
  const gap = 6;
  const colW = (usable - gap) / 2;
  const imgH = 55;
  const legendaH = 6;
  const comentH = 18;
  const blocoH = imgH + legendaH + comentH + 6;
  const topY = 50;
  const maxY = PH - 18;
  let y = topY;
  let col = 0;
  let primeira = true;

  const novaPag = () => {
    novaPagina(doc);
    microHeader(doc, corretor);
    tituloPagina(doc, "Documentação Fotográfica");
    y = topY;
    col = 0;
  };

  novaPag();
  primeira = false;

  fotosDet.forEach((f) => {
    if (col === 0 && y + blocoH > maxY) novaPag();
    const x = M + col * (colW + gap);
    try {
      const match = /^data:image\/(jpe?g|png|webp);base64,/i.exec(f.dataUrl);
      const fmt = match && match[1].toLowerCase().startsWith("png") ? "PNG"
        : match && match[1].toLowerCase() === "webp" ? "WEBP" : "JPEG";
      doc.setFillColor(...CARD_BLUE);
      doc.roundedRect(x, y, colW, imgH, 2, 2, "F");
      doc.addImage(f.dataUrl, fmt as any, x + 1, y + 1, colW - 2, imgH - 2, undefined, "FAST");
    } catch (e) {
      console.error("Falha ao desenhar foto:", e);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...BLUE);
    doc.text(f.legenda || "Sem legenda", x, y + imgH + 5);
    if (f.comentario_ia) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT);
      textoMultilinha(doc, f.comentario_ia, x, y + imgH + legendaH + 5, colW, {
        size: 8, color: TEXT, lineHeight: 3.6,
      });
    }
    col++;
    if (col >= 2) {
      col = 0;
      y += blocoH;
    }
  });
  void primeira;
}

// ---------- EXPERT EXTRA: DISPERSÃO (R$/m² × Área) ----------
function paginaDispersao(doc: jsPDF, avaliacao: any, resultado: any, comparaveis: any[], corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Dispersão dos Comparáveis — Valor/m² × Área");

  const pts = comparaveis
    .filter((c) => Number(c.area) > 0 && Number(c.valor_anunciado) > 0)
    .map((c) => ({ x: Number(c.area), y: Number(c.valor_anunciado) / Number(c.area) }));

  // Detecta outliers via 1.5 * desvio padrão em y
  let mean = 0, sd = 0;
  if (pts.length) {
    mean = pts.reduce((a, b) => a + b.y, 0) / pts.length;
    sd = Math.sqrt(pts.reduce((a, b) => a + (b.y - mean) ** 2, 0) / pts.length);
  }
  const inliers = pts.filter((p) => sd === 0 || Math.abs(p.y - mean) <= 1.5 * sd);
  const outliers = pts.filter((p) => sd > 0 && Math.abs(p.y - mean) > 1.5 * sd);

  // Ponto do imóvel avaliado
  const avalArea = Number(avaliacao?.area_total) || 0;
  const avalY =
    Number(resultado?.valor_unitario_medio) ||
    (Number(resultado?.valor_central) > 0 && avalArea > 0 ? Number(resultado.valor_central) / avalArea : 0);
  const avalPoint = avalArea > 0 && avalY > 0 ? { x: avalArea, y: avalY } : null;

  // Regressão linear nos inliers
  let slope = 0, intercept = mean;
  if (inliers.length >= 2) {
    const mx = inliers.reduce((a, b) => a + b.x, 0) / inliers.length;
    const my = inliers.reduce((a, b) => a + b.y, 0) / inliers.length;
    const num = inliers.reduce((a, b) => a + (b.x - mx) * (b.y - my), 0);
    const den = inliers.reduce((a, b) => a + (b.x - mx) ** 2, 0);
    slope = den === 0 ? 0 : num / den;
    intercept = my - slope * mx;
  }

  // Caixa do gráfico
  const x0 = M + 22;
  const x1 = PW - M - 8;
  const y0 = 52;
  const y1 = PH - 48;
  const cw = x1 - x0;
  const ch = y1 - y0;

  // Range
  const allXs = [...pts.map((p) => p.x), ...(avalPoint ? [avalPoint.x] : [])];
  const allYs = [...pts.map((p) => p.y), ...(avalPoint ? [avalPoint.y] : [])];
  if (allXs.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text("Sem dados suficientes para gerar o gráfico de dispersão.", PW / 2, PH / 2, { align: "center" });
    return;
  }
  const padPct = 0.08;
  const xMinR = Math.min(...allXs), xMaxR = Math.max(...allXs);
  const yMinR = Math.min(...allYs), yMaxR = Math.max(...allYs);
  const xMin = xMinR - (xMaxR - xMinR || xMinR) * padPct;
  const xMax = xMaxR + (xMaxR - xMinR || xMaxR) * padPct;
  const yMin = Math.max(0, yMinR - (yMaxR - yMinR || yMinR) * padPct);
  const yMax = yMaxR + (yMaxR - yMinR || yMaxR) * padPct;
  const sx = (x: number) => x0 + ((x - xMin) / (xMax - xMin || 1)) * cw;
  const sy = (y: number) => y1 - ((y - yMin) / (yMax - yMin || 1)) * ch;

  // Fundo + grid
  doc.setFillColor(...BG_SOFT);
  doc.rect(x0, y0, cw, ch, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const gy = y0 + (ch * i) / steps;
    doc.line(x0, gy, x1, gy);
    const yVal = yMax - ((yMax - yMin) * i) / steps;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(fmtBRL(yVal), x0 - 2, gy + 1.5, { align: "right" });
  }
  for (let i = 0; i <= steps; i++) {
    const gx = x0 + (cw * i) / steps;
    doc.line(gx, y0, gx, y1);
    const xVal = xMin + ((xMax - xMin) * i) / steps;
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`${fmtNum(xVal, 0)} m²`, gx, y1 + 5, { align: "center" });
  }

  // Eixos
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(x0, y0, x0, y1);
  doc.line(x0, y1, x1, y1);

  // Linha de tendência
  if (inliers.length >= 2) {
    const yA = slope * xMin + intercept;
    const yB = slope * xMax + intercept;
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.8);
    doc.line(sx(xMin), sy(yA), sx(xMax), sy(yB));
  }

  // Pontos inliers (azul escuro)
  doc.setDrawColor(...BLUE);
  doc.setFillColor(...BLUE);
  inliers.forEach((p) => doc.circle(sx(p.x), sy(p.y), 1.6, "F"));

  // Outliers (vermelho com "x")
  doc.setDrawColor(220, 53, 69);
  doc.setLineWidth(0.8);
  outliers.forEach((p) => {
    const cx = sx(p.x), cy = sy(p.y);
    doc.line(cx - 2, cy - 2, cx + 2, cy + 2);
    doc.line(cx - 2, cy + 2, cx + 2, cy - 2);
  });

  // Imóvel avaliado (dourado, maior)
  if (avalPoint) {
    doc.setDrawColor(...GOLD);
    doc.setFillColor(...GOLD);
    doc.circle(sx(avalPoint.x), sy(avalPoint.y), 2.6, "F");
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.4);
    doc.circle(sx(avalPoint.x), sy(avalPoint.y), 2.6, "S");
  }

  // Rótulos dos eixos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BLUE);
  doc.text("Área total (m²)", (x0 + x1) / 2, y1 + 11, { align: "center" });
  doc.text("Valor por m² (R$/m²)", x0 - 16, (y0 + y1) / 2, { align: "center", angle: 90 });

  // Legenda
  const lgY = PH - 22;
  const item = (cx: number, cor: [number, number, number], tipo: "dot" | "x" | "gold", label: string) => {
    if (tipo === "gold") {
      doc.setFillColor(...cor);
      doc.circle(cx, lgY - 1.2, 2, "F");
    } else if (tipo === "dot") {
      doc.setFillColor(...cor);
      doc.circle(cx, lgY - 1.2, 1.5, "F");
    } else {
      doc.setDrawColor(...cor);
      doc.setLineWidth(0.8);
      doc.line(cx - 2, lgY - 3, cx + 2, lgY + 0.5);
      doc.line(cx - 2, lgY + 0.5, cx + 2, lgY - 3);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text(label, cx + 4, lgY, { align: "left" });
  };
  item(M, BLUE, "dot", "Comparáveis");
  item(M + 55, BLUE, "dot", "Linha de tendência (regressão linear)");
  // Sobrescreve para desenhar uma linha azul ao lado da legenda da tendência
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.8);
  doc.line(M + 53, lgY - 1.2, M + 57, lgY - 1.2);
  item(M + 130, [220, 53, 69], "x", "Outliers eliminados");
  item(M + 180, GOLD, "gold", "Imóvel avaliado");
}

// ---------- EXPERT EXTRA: LOCALIZAÇÃO ----------
function paginaLocalizacao(doc: jsPDF, avaliacao: any, corretor: CorretorInfo, mapaDataUrl?: string | null) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Localização");

  const endereco =
    String(avaliacao?.endereco_completo || "").trim() ||
    String(avaliacao?.localizacao || "").trim() ||
    "Endereço não informado";

  const x = M;
  const y = 50;
  const w = PW - M * 2;
  const h = PH - y - 50;

  if (mapaDataUrl) {
    try {
      const fmt = mapaDataUrl.startsWith("data:image/jpeg") || mapaDataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
      doc.addImage(mapaDataUrl, fmt as any, x, y, w, h, undefined, "FAST");
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.4);
      doc.rect(x, y, w, h, "S");
    } catch (e) {
      console.error("Falha ao desenhar mapa OSM:", e);
      desenharPlaceholderMapa(doc, x, y, w, h);
    }
  } else {
    desenharPlaceholderMapa(doc, x, y, w, h);
  }

  // Endereço abaixo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLUE);
  doc.text("Endereço:", M, y + h + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  const wrapped = doc.splitTextToSize(endereco, PW - M * 2 - 26);
  doc.text(wrapped, M + 22, y + h + 12);

  // Atribuição obrigatória do OpenStreetMap
  if (mapaDataUrl) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_DIM);
    doc.text("© OpenStreetMap contributors", PW - M, y + h - 2, { align: "right" });
  }
}

function desenharPlaceholderMapa(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...CARD_BLUE);
  doc.rect(x, y, w, h, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h, "S");
  doc.setDrawColor(210, 220, 232);
  doc.setLineWidth(0.3);
  for (let i = 1; i < 8; i++) doc.line(x + (w * i) / 8, y + 4, x + (w * i) / 8, y + h - 4);
  for (let i = 1; i < 5; i++) doc.line(x + 4, y + (h * i) / 5, x + w - 4, y + (h * i) / 5);
  const cx = x + w / 2;
  const cy = y + h / 2 - 6;
  doc.setFillColor(...GOLD);
  doc.circle(cx, cy - 6, 5, "F");
  doc.setFillColor(...BLUE);
  doc.circle(cx, cy - 6, 1.8, "F");
  doc.setFillColor(...GOLD);
  doc.triangle(cx - 4, cy - 3, cx + 4, cy - 3, cx, cy + 4, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text("Mapa indisponível — exibindo apenas o endereço", cx, cy + 14, { align: "center" });
}


function paginaAssinatura(doc: jsPDF, corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Assinatura e Responsabilidade Técnica");

  // Declaração
  const declY = 48;
  card(doc, M, declY, PW - 2 * M, 36, { variant: "blue", border: "gold" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLUE);
  doc.text("DECLARAÇÃO DE RESPONSABILIDADE", M + 6, declY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const decl =
    "Declaro que as informações contidas neste laudo são verdadeiras e foram obtidas através de pesquisa de mercado realizada na data de referência indicada, seguindo as orientações da NBR 14653-2 da ABNT.";
  const linhas = doc.splitTextToSize(decl, PW - 2 * M - 12);
  doc.text(linhas, M + 6, declY + 16);

  // Logo
  const logoY = 92;
  const logoH = 22;
  const logoW = 44;
  const logoX = PW / 2 - logoW / 2;
  if (corretor.logo_data_url) {
    try {
      const fmt = corretor.logo_data_url.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(corretor.logo_data_url, fmt, logoX, logoY, logoW, logoH, undefined, "FAST");
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...BLUE);
      doc.text("A8", PW / 2, logoY + 14, { align: "center" });
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...BLUE);
    doc.text("A8", PW / 2, logoY + 14, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text("INVESTIMENTOS IMOBILIÁRIOS", PW / 2, logoY + 20, { align: "center" });
  }

  // Linha de assinatura
  const lineY = logoY + logoH + 12;
  const lineW = 110;
  const lineX = PW / 2 - lineW / 2;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(lineX, lineY, lineX + lineW, lineY);

  // Nome e registros
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text(corretor.nome.toUpperCase(), PW / 2, lineY + 6, { align: "center" });

  const regs: string[] = [];
  if (corretor.creci) regs.push(`CRECI ${String(corretor.creci).replace(/^CRECI[\s:-]*/i, "")}`);
  if (corretor.cnai) regs.push(`CNAI ${String(corretor.cnai).replace(/^CNAI[\s:-]*/i, "")}`);
  if (corretor.outro_registro) regs.push(String(corretor.outro_registro));
  if (regs.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(regs.join("  •  "), PW / 2, lineY + 11, { align: "center" });
  }

  // Contato
  const contato: string[] = [];
  if (corretor.telefone) contato.push(corretor.telefone);
  if (corretor.email) contato.push(corretor.email);
  if (contato.length) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(contato.join("  •  "), PW / 2, lineY + 16, { align: "center" });
  }

  // Data por extenso
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const d = new Date();
  const dataExt = `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  const cidadeEstado = [corretor.cidade, corretor.estado].filter(Boolean).join(" / ");
  const local = cidadeEstado ? `${cidadeEstado}, ${dataExt}.` : `${dataExt}.`;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(local, PW / 2, lineY + 24, { align: "center" });
}


function paginaMarketing(doc: jsPDF, marketing: MarketingPdf, corretor: CorretorInfo) {
  // ---- Página 1: Público + Divulgação ----
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Estratégia de Marketing");

  const usable = PW - M * 2;
  const colW = (usable - 6) / 2;
  const yTop = 50;

  // Card Público
  card(doc, M, yTop, colW, 110, { variant: "darkblue" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...GOLD);
  doc.text("PERFIL DO PÚBLICO-ALVO", M + 8, yTop + 10);

  const pubItems: Array<[string, string]> = [
    ["Faixa etária", marketing.publico?.faixa_etaria ?? "—"],
    ["Perfil familiar", marketing.publico?.perfil_familiar ?? "—"],
    ["Faixa de renda", marketing.publico?.faixa_renda ?? "—"],
    ["Estilo de vida", marketing.publico?.estilo_vida ?? "—"],
    ["Motivação de compra", marketing.publico?.motivacao_compra ?? "—"],
  ];
  let yp = yTop + 18;
  pubItems.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(k.toUpperCase(), M + 8, yp);
    yp = textoMultilinha(doc, v, M + 8, yp + 4, colW - 16, {
      size: 9, color: WHITE, lineHeight: 4,
    }) + 3;
  });

  // Card Divulgação
  const xR = M + colW + 6;
  card(doc, xR, yTop, colW, 110, { variant: "white", border: "gold" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLUE);
  doc.text("ESTRATÉGIA DE DIVULGAÇÃO", xR + 8, yTop + 10);

  const divItems: Array<[string, string]> = [
    ["Canais prioritários", (marketing.divulgacao?.canais ?? []).join(", ") || "—"],
    ["Melhor horário", marketing.divulgacao?.melhor_horario ?? "—"],
    ["Prazo estimado de venda", marketing.divulgacao?.prazo_venda ?? "—"],
    ["Dicas de precificação", marketing.divulgacao?.dicas_precificacao ?? "—"],
    ["Desconto máximo", marketing.divulgacao?.desconto_maximo ?? "—"],
  ];
  let yd = yTop + 18;
  divItems.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(k.toUpperCase(), xR + 8, yd);
    yd = textoMultilinha(doc, v, xR + 8, yd + 4, colW - 16, {
      size: 9, color: TEXT, lineHeight: 4,
    }) + 3;
  });

  // ---- Página 2: Texto de Anúncio ----
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Texto de Anúncio");

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text("TÍTULO (PORTAIS)", M, 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BLUE);
  let yT = textoMultilinha(doc, marketing.anuncio?.titulo ?? "—", M, 56, usable, {
    size: 14, bold: true, color: BLUE, lineHeight: 6,
  });

  // Descrição portal
  yT += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text("DESCRIÇÃO COMPLETA — ZAP / OLX / VIVA REAL", M, yT);
  yT = textoMultilinha(doc, marketing.anuncio?.descricao_portal ?? "—", M, yT + 6, usable, {
    size: 10, color: TEXT, lineHeight: 4.5,
  });

  // WhatsApp
  yT += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text("VERSÃO WHATSAPP", M, yT);
  yT = textoMultilinha(doc, marketing.anuncio?.whatsapp ?? "—", M, yT + 6, usable, {
    size: 10, color: TEXT, lineHeight: 4.5,
  });

  // Hashtags
  yT += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text("HASHTAGS — INSTAGRAM", M, yT);
  textoMultilinha(doc, (marketing.anuncio?.hashtags ?? []).join("  "), M, yT + 6, usable, {
    size: 10, color: BLUE, bold: true, lineHeight: 4.5,
  });
}

export type MarketingPdf = {
  publico?: {
    faixa_etaria?: string;
    perfil_familiar?: string;
    faixa_renda?: string;
    estilo_vida?: string;
    motivacao_compra?: string;
  };
  divulgacao?: {
    canais?: string[];
    melhor_horario?: string;
    prazo_venda?: string;
    dicas_precificacao?: string;
    desconto_maximo?: string;
  };
  anuncio?: {
    titulo?: string;
    descricao_portal?: string;
    whatsapp?: string;
    hashtags?: string[];
  };
};

function gerarModelo3(avaliacao: any, resultado: any, comparaveis: any[], corretor: CorretorInfo, fotos: string[], fotosDet: FotoDetalhada[] = [], mapaDataUrl?: string | null, marketing?: MarketingPdf | null) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const rel = resultado?.relatorio_json || {};
  const temFotos = fotos.length > 0;
  const temDocFotos = fotosDet.length > 0;
  const temMkt = !!marketing;
  const capaFoto = fotosDet.find((f) => f.principal)?.dataUrl || fotos[0] || null;
  paginaCapa(doc, avaliacao, corretor, "Laudo de Avaliação", capaFoto);
  paginaSumario(doc, [
    "O Imóvel",
    "Ficha Técnica",
    "Localização",
    ...(temFotos ? ["Fotos do Imóvel"] : []),
    ...(temDocFotos ? ["Documentação Fotográfica"] : []),
    "Análise do Bairro",
    "Perfil do Público",
    "Anúncios na Região",
    "Homogeneização",
    "Dispersão dos Comparáveis",
    "Tratamento Estatístico",
    "Campo de Arbítrio",
    "Valor do Imóvel",
    ...(temMkt ? ["Estratégia de Marketing", "Texto de Anúncio"] : []),
    "Contato",
    "Assinatura",
  ]);

  paginaImovel(doc, avaliacao, rel, corretor);
  paginaAmbientes(doc, avaliacao, corretor);
  paginaFichaTecnica(doc, avaliacao, corretor);
  paginaLocalizacao(doc, avaliacao, corretor, mapaDataUrl);
  if (temFotos) paginaFotos(doc, rel, fotos, corretor);
  if (temDocFotos) paginaDocumentacaoFotografica(doc, fotosDet, corretor);
  paginaBairro(doc, avaliacao, rel, corretor);
  paginaPerfil(doc, rel, corretor);
  paginaAnuncios(doc, comparaveis, corretor);
  paginaHomogeneizacao(doc, avaliacao, comparaveis, corretor);
  paginaDispersao(doc, avaliacao, resultado, comparaveis, corretor);
  paginaEstatistica(doc, comparaveis, corretor);
  paginaArbitrio(doc, resultado, corretor);
  paginaValor(doc, resultado, corretor);
  if (temMkt && marketing) paginaMarketing(doc, marketing, corretor);
  paginaContato(doc, corretor);
  paginaAssinatura(doc, corretor);
  rodape(doc);

  return doc;
}

export type FotoDetalhada = { dataUrl: string; legenda: string; principal: boolean; comentario_ia: string };

export function gerarPdfAvaliacao(
  avaliacao: any,
  resultado: any,
  comparaveis: any[],
  opts: {
    modelo: ModeloPdf;
    plano: PlanoUsuario;
    corretor?: CorretorInfo | string;
    fotosDataUrls?: string[];
    fotosDetalhadas?: FotoDetalhada[];
    mapaDataUrl?: string | null;
    marketing?: MarketingPdf | null;
  },
) {
  const { modelo, plano } = opts;
  const fotos = Array.isArray(opts.fotosDataUrls) ? opts.fotosDataUrls.filter((s) => typeof s === "string" && s.length > 0) : [];
  const fotosDet = Array.isArray(opts.fotosDetalhadas) ? opts.fotosDetalhadas.filter((f) => f && f.dataUrl) : [];
  const corretor: CorretorInfo =
    typeof opts.corretor === "string"
      ? { nome: opts.corretor || "Corretor não identificado" }
      : opts.corretor ?? { nome: "Corretor não identificado" };
  if (!podeGerarModelo(plano, modelo)) {
    throw new Error("Faça upgrade para acessar este relatório");
  }

  const doc =
    modelo === 3
      ? gerarModelo3(avaliacao, resultado, comparaveis, corretor, fotos, fotosDet, opts.mapaDataUrl ?? null, opts.marketing ?? null)
      : modelo === 2
      ? gerarModelo2(avaliacao, resultado, comparaveis, corretor, fotos)
      : gerarModelo1(avaliacao, resultado, comparaveis, corretor, fotos);

  const nome = `A8-Avaliacao-M${modelo}-${(avaliacao?.id || "").slice(0, 8)}.pdf`;
  doc.save(nome);
}

