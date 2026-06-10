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
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  email?: string | null;
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

function microHeader(doc: jsPDF, corretor: CorretorInfo) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text("A8 INVESTIMENTOS IMOBILIÁRIOS", PW - M, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD);
  doc.text(corretor.nome.toUpperCase(), PW - M, 14, { align: "right" });
}

function rodape(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    // strip
    doc.setFillColor(...BLUE);
    doc.rect(0, PH - 12, PW, 12, "F");
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.line(0, PH - 12, PW, PH - 12);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text("Gerado pela plataforma A8 Investimentos Imobiliários", M, PH - 5);
    doc.setFont("helvetica", "normal");
    doc.text(`${i} / ${total}  •  ${hoje()}`, PW - M, PH - 5, { align: "right" });
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

// ---------- PAGE 1: COVER ----------
function paginaCapa(doc: jsPDF, avaliacao: any, corretor: CorretorInfo, titulo: string) {
  pintarFundo(doc);
  try {
    doc.addImage(COVER_BG_BASE64, "JPEG", 0, 0, PW, PH, undefined, "FAST");
  } catch {
    /* ignore */
  }
  // semi-transparent BLUE overlay
  doc.saveGraphicsState();
  // @ts-ignore
  doc.setGState(new (doc as any).GState({ opacity: 0.7 }));
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, PW, PH, "F");
  doc.restoreGraphicsState();

  // top white header bar with logo text
  doc.setFillColor(...WHITE);
  doc.rect(0, 0, PW, 18, "F");
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(0, 18, PW, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLUE);
  doc.text("A8 INVESTIMENTOS", M, 11);
  doc.setTextColor(...GOLD);
  doc.text(" IMOBILIÁRIOS", M + doc.getTextWidth("A8 INVESTIMENTOS"), 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BLUE);
  doc.text(corretor.nome.toUpperCase(), PW - M, 11, { align: "right" });

  // big title bottom-left over overlay
  doc.setFont("helvetica", "bold");
  doc.setFontSize(64);
  doc.setTextColor(...WHITE);
  const partes = titulo.split(" ");
  const linha1 = partes[0];
  const linha2 = partes.slice(1).join(" ");
  doc.text(linha1.toUpperCase(), M, PH - 40);
  doc.setFontSize(28);
  doc.setTextColor(...GOLD);
  doc.text(linha2.toUpperCase(), M, PH - 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(`${avaliacao?.localizacao ?? ""}  •  ${hoje()}`, M, PH - 10);
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
  doc.text(`◉ ${ab.bairro || a.localizacao || "—"}`, M, 46);
  if (ab.cidade) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text(String(ab.cidade), M, 53);
  }

  const usable = PW - M * 2;
  const gap = 6;
  const colW = (usable - gap) / 2;
  const yRow = 62;
  const ch = 56;
  card(doc, M, yRow, colW, ch, { variant: "white", border: "gold" });
  card(doc, M + colW + gap, yRow, colW, ch, { variant: "white", border: "gold" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text("Potencial de Valorização", M + 8, yRow + 12);
  doc.text("Tendências de Mercado", M + colW + gap + 8, yRow + 12);
  textoMultilinha(doc, String(ab.potencial_valorizacao ?? rel?.potencial_valorizacao ?? "Informação não disponível."), M + 8, yRow + 22, colW - 16, {
    size: 10, color: TEXT, lineHeight: 4.6,
  });
  textoMultilinha(doc, String(ab.tendencias_mercado ?? rel?.tendencias_mercado ?? "Informação não disponível."), M + colW + gap + 8, yRow + 22, colW - 16, {
    size: 10, color: TEXT, lineHeight: 4.6,
  });

  // descrição
  const yDesc = yRow + ch + 8;
  card(doc, M, yDesc, usable, PH - yDesc - 18, { variant: "white", border: "gold" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text("Sobre a Região", M + 8, yDesc + 12);
  textoMultilinha(doc, String(ab.descricao ?? rel?.resumo_texto ?? ""), M + 8, yDesc + 22, usable - 16, {
    size: 11, color: TEXT, lineHeight: 5.2,
  });
}

// ---------- PAGE: PERFIL DO PÚBLICO ----------
function paginaPerfil(doc: jsPDF, rel: any, corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Perfil do Público");

  const pp = rel?.perfil_publico ?? {};
  const items: Array<[string, string]> = [
    ["Profissão Predominante", String(pp.profissao ?? rel?.perfil_profissao ?? "—")],
    ["Renda Média", String(pp.renda_media ?? rel?.perfil_renda ?? "—")],
    ["Preferências", String(pp.preferencias ?? rel?.perfil_preferencias ?? "—")],
    ["Interesses", String(pp.interesses ?? rel?.perfil_interesses ?? "—")],
  ];
  const usable = PW - M * 2;
  const gap = 6;
  const cw = (usable - gap) / 2;
  const ch = 56;
  const yStart = 56;
  items.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (cw + gap);
    const y = yStart + row * (ch + gap);
    card(doc, x, y, cw, ch, { variant: "darkblue" });
    doc.setFillColor(...GOLD);
    doc.circle(x + 12, y + 12, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...GOLD);
    doc.text(label, x + 20, y + 14);
    textoMultilinha(doc, value, x + 8, y + 24, cw - 16, { size: 10, color: WHITE, lineHeight: 4.8 });
  });
}

// ---------- PAGE: ANÚNCIOS NA REGIÃO ----------
function paginaAnuncios(doc: jsPDF, comparaveis: any[], corretor: CorretorInfo) {
  const PER_PAGE = 4;
  for (let p = 0; p < Math.ceil(comparaveis.length / PER_PAGE); p++) {
    novaPagina(doc);
    microHeader(doc, corretor);
    if (p === 0) tituloPagina(doc, "Anúncios na Região");

    const pageItems = comparaveis.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const usable = PW - M * 2;
    const ch = 32;
    const gap = 4;
    const yStart = 48;
    pageItems.forEach((c, idx) => {
      const i = p * PER_PAGE + idx;
      const y = yStart + idx * (ch + gap);
      const alt = idx % 2 === 1;
      card(doc, M, y, usable, ch, { variant: alt ? "blue" : "white", border: "soft" });
      // number badge
      doc.setFillColor(...BLUE);
      doc.circle(M + 10, y + ch / 2, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...WHITE);
      doc.text(String(i + 1), M + 10, y + ch / 2 + 1.5, { align: "center" });

      // cols
      const x0 = M + 22;
      const colW = (usable - 30) / 4;
      // col 1: local + quartos
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...BLUE);
      const loc = doc.splitTextToSize(String(c.localizacao ?? "—").toUpperCase(), colW - 4);
      doc.text(loc.slice(0, 2), x0, y + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(`${c.quartos ?? 0} quartos`, x0, y + 22);
      doc.text(`${c.suites ?? 0} suítes  •  ${c.vagas ?? 0} vagas`, x0, y + 26);

      // col 2: metragem + valor + tempo
      const x1 = x0 + colW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(`Metragem: ${c.area ?? "—"} m²`, x1, y + 10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLUE);
      doc.text(`Valor: ${fmtBRL(Number(c.valor_anunciado))}`, x1, y + 17);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(`Fonte: ${fmtFonte(c.fonte)}`, x1, y + 24);

      // col 3: R$/m²
      const x2 = x1 + colW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text("Valor unitário", x2, y + 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...GOLD);
      const vm = Number(c.area) > 0 ? fmtBRL(Number(c.valor_anunciado) / Number(c.area)) : "—";
      doc.text(`${vm}/m²`, x2, y + 19);

      // col 4: conservação
      const x3 = x2 + colW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text("Estado de conservação", x3, y + 10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BLUE);
      const cons = doc.splitTextToSize(String(c.conservacao ?? "—"), colW - 4);
      doc.text(cons.slice(0, 2), x3, y + 17);
    });
  }
}

// ---------- PAGE: VALOR DO IMÓVEL ----------
function paginaValor(doc: jsPDF, resultado: any, corretor: CorretorInfo) {
  novaPagina(doc);
  microHeader(doc, corretor);
  tituloPagina(doc, "Valor do Imóvel");

  const central = resultado?.valor_central;
  const minV = resultado?.valor_minimo;
  const maxV = resultado?.valor_maximo;

  // central giant
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GRAY);
  doc.text("Valor sugerido de mercado", PW / 2, 60, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(58);
  doc.setTextColor(...BLUE);
  doc.text(fmtBRL(central), PW / 2, 88, { align: "center" });

  // min / max range
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text(`Faixa sugerida:  ${fmtBRL(minV)}   —   ${fmtBRL(maxV)}`, PW / 2, 102, { align: "center" });

  // 3 tip cards
  const tips: Array<[string, string]> = [
    ["Comece acima do valor", "Iniciar levemente acima do central permite margem para negociação."],
    ["Valor é sugestão", "A faixa é mercadológica; o preço final depende de estratégia e momento."],
    ["IA + mercado local", "Análise considera comparáveis reais e contexto da região informada."],
  ];
  const usable = PW - M * 2;
  const gap = 6;
  const cw = (usable - gap * 2) / 3;
  const ch = 50;
  const yRow = 120;
  tips.forEach(([t, d], i) => {
    const x = M + i * (cw + gap);
    card(doc, x, yRow, cw, ch, { variant: "darkblue" });
    doc.setFillColor(...GOLD);
    doc.circle(x + 10, yRow + 8, 2.4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...GOLD);
    doc.text(t, x + 16, yRow + 14);
    textoMultilinha(doc, d, x + 8, yRow + 24, cw - 16, { size: 10, color: WHITE, lineHeight: 4.8 });
  });
}

// ---------- PAGE: CONTATO ----------
function paginaContato(doc: jsPDF, corretor: CorretorInfo) {
  novaPagina(doc);
  // full BLUE background
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, PW, PH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text("A8 INVESTIMENTOS IMOBILIÁRIOS", PW / 2, 40, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(corretor.nome.toUpperCase(), PW / 2, 48, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(96);
  doc.setTextColor(...WHITE);
  doc.text("Obrigado!", PW / 2, 110, { align: "center" });

  // contact pills (outlined gold)
  const items = [
    corretor.telefone ? `Tel  ${corretor.telefone}` : null,
    corretor.email ? `Email  ${corretor.email}` : null,
    corretor.creci ? `CRECI ${corretor.creci}` : null,
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
  const rank = (lista: string[], v: string) => {
    const i = lista.indexOf(v);
    return i === -1 ? 0 : i;
  };

  const body = comparaveis.map((c, i) => {
    const fOferta = 0.9;
    const areaA = Number(a?.area_total) || 0;
    const areaC = Number(c.area) || 0;
    let fArea = 1.0;
    if (areaA > 0 && areaC > 0) {
      fArea = Math.max(0.8, Math.min(1.2, Math.pow(areaC / areaA, 0.25)));
    }
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
    return [
      String(i + 1),
      fmtFonte(c.fonte),
      fmtNum(fOferta, 2),
      fmtNum(fArea, 2),
      fmtNum(fPadrao, 2),
      fmtNum(fConserv, 2),
      fmtNum(fLocal, 2),
      fmtNum(total, 3),
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [["#", "Fonte", "F. Oferta", "F. Área", "F. Padrão", "F. Conserv.", "F. Localiz.", "F. Total"]],
    body,
    theme: "grid",
    headStyles: { fillColor: BLUE, textColor: WHITE, fontSize: 10, halign: "center" },
    bodyStyles: { fillColor: WHITE, textColor: TEXT, fontSize: 10, halign: "center", lineColor: BORDER },
    alternateRowStyles: { fillColor: BG_SOFT },
    margin: { left: M, right: M },
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
  const items: Array<[string, string]> = [
    ["Amostras (n)", String(unit.length)],
    ["Média (R$/m²)", fmtBRL(media)],
    ["Mediana (R$/m²)", fmtBRL(mediana)],
    ["Desvio padrão", fmtBRL(desvio)],
    ["Coef. variação", `${fmtNum(cv, 2)}%`],
  ];
  const usable = PW - M * 2;
  const gap = 6;
  const cw = (usable - gap * 4) / 5;
  const ch = 50;
  const yRow = 60;
  items.forEach(([l, v], i) => {
    const x = M + i * (cw + gap);
    card(doc, x, yRow, cw, ch, { variant: "blue", border: "soft" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.text(l, x + cw / 2, yRow + 14, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...BLUE);
    doc.text(v, x + cw / 2, yRow + 30, { align: "center" });
  });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const t = "Tratamento por fatores de homogeneização (ABNT NBR 14653-2:2011). A média dos valores unitários, ponderada pela qualidade da amostra, fundamenta o valor central apurado.";
  textoMultilinha(doc, t, M, yRow + ch + 14, usable, { size: 11, color: TEXT, lineHeight: 5.2 });
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
  const yStart = 50;
  const colW = (usable - 6) / 2;
  const rowH = 12;

  const dados: Array<[string, string]> = [
    ["Padrão Construtivo", String(a.padrao ?? "—")],
    ["Estado de Conservação", String(a.conservacao ?? "—")],
    ["Idade Real (anos)", a.idade_real != null && a.idade_real !== 0 ? String(a.idade_real) : "—"],
    ["Idade Aparente", String(a.idade_aparente || "—")],
    ["Posição Solar", String(a.posicao_solar || "—")],
    ["Topografia", String(a.topografia || "—")],
    ["Zoneamento", String(a.zoneamento || "—")],
    ["Posição", String(a.posicao || "—")],
    ["Vagas Cobertas", a.vagas_cobertas != null && a.vagas_cobertas !== 0 ? String(a.vagas_cobertas) : "—"],
    ["Vagas Descobertas", a.vagas_descobertas != null && a.vagas_descobertas !== 0 ? String(a.vagas_descobertas) : "—"],
    ["Andar do Imóvel", a.andar != null && a.andar !== 0 ? String(a.andar) : "—"],
    ["Total de Andares", a.total_andares != null && a.total_andares !== 0 ? String(a.total_andares) : "—"],
    ["Número de Pavimentos", String(a.numero_pavimentos || "—")],
  ];

  let y = yStart;
  dados.forEach((d, i) => {
    const col = i % 2;
    const x = M + col * (colW + 6);
    if (col === 0 && i > 0) y += rowH + 2;
    card(doc, x, y, colW, rowH, { variant: "white", border: "soft" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text(d[0].toUpperCase(), x + 5, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(d[1], x + 5, y + 10);
  });

  // Tipo de Acabamento
  const acabamentos: string[] = Array.isArray(a.tipo_acabamento)
    ? a.tipo_acabamento.filter((s: any) => typeof s === "string" && s.trim().length > 0)
    : [];
  const yAcab = y + rowH + 10;
  const acabBoxH = 32;
  card(doc, M, yAcab, usable, acabBoxH, { variant: "white", border: "gold" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text("Tipo de Acabamento", M + 8, yAcab + 10);
  if (acabamentos.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text("Nenhum item informado.", M + 8, yAcab + 22);
  } else {
    const cols = 3;
    const colInnerW = (usable - 16) / cols;
    const lineH = 6;
    acabamentos.forEach((item, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = M + 8 + c * colInnerW;
      const yi = yAcab + 22 + r * lineH;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...GOLD);
      doc.text("•", x, yi);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT);
      doc.text(item, x + 4, yi);
    });
  }

  // Infraestrutura de Lazer
  const lazer: string[] = Array.isArray(a.infraestrutura_lazer)
    ? a.infraestrutura_lazer.filter((s: any) => typeof s === "string" && s.trim().length > 0)
    : [];
  const yLazer = yAcab + acabBoxH + 6;
  const boxH = PH - yLazer - 18;
  card(doc, M, yLazer, usable, boxH, { variant: "white", border: "gold" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLUE);
  doc.text("Infraestrutura de Lazer", M + 8, yLazer + 10);

  if (lazer.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text("Nenhum item informado.", M + 8, yLazer + 22);
  } else {
    const cols = 3;
    const colInnerW = (usable - 16) / cols;
    const lineH = 6;
    lazer.forEach((item, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = M + 8 + c * colInnerW;
      const yi = yLazer + 22 + r * lineH;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...GOLD);
      doc.text("•", x, yi);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT);
      doc.text(item, x + 4, yi);
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

function gerarModelo3(avaliacao: any, resultado: any, comparaveis: any[], corretor: CorretorInfo, fotos: string[], fotosDet: FotoDetalhada[] = []) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const rel = resultado?.relatorio_json || {};
  const temFotos = fotos.length > 0;
  const temDocFotos = fotosDet.length > 0;
  paginaCapa(doc, avaliacao, corretor, "Laudo de Avaliação");
  paginaSumario(doc, [
    "O Imóvel",
    "Ficha Técnica",
    ...(temFotos ? ["Fotos do Imóvel"] : []),
    ...(temDocFotos ? ["Documentação Fotográfica"] : []),
    "Análise do Bairro",
    "Perfil do Público",
    "Anúncios na Região",
    "Homogeneização",
    "Tratamento Estatístico",
    "Campo de Arbítrio",
    "Valor do Imóvel",
    "Contato",
  ]);
  paginaImovel(doc, avaliacao, rel, corretor);
  paginaAmbientes(doc, avaliacao, corretor);
  paginaFichaTecnica(doc, avaliacao, corretor);
  if (temFotos) paginaFotos(doc, rel, fotos, corretor);
  if (temDocFotos) paginaDocumentacaoFotografica(doc, fotosDet, corretor);
  paginaBairro(doc, avaliacao, rel, corretor);
  paginaPerfil(doc, rel, corretor);
  paginaAnuncios(doc, comparaveis, corretor);
  paginaHomogeneizacao(doc, avaliacao, comparaveis, corretor);
  paginaEstatistica(doc, comparaveis, corretor);
  paginaArbitrio(doc, resultado, corretor);
  paginaValor(doc, resultado, corretor);
  paginaContato(doc, corretor);
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
      ? gerarModelo3(avaliacao, resultado, comparaveis, corretor, fotos, fotosDet)
      : modelo === 2
      ? gerarModelo2(avaliacao, resultado, comparaveis, corretor, fotos)
      : gerarModelo1(avaliacao, resultado, comparaveis, corretor, fotos);

  const nome = `A8-Avaliacao-M${modelo}-${(avaliacao?.id || "").slice(0, 8)}.pdf`;
  doc.save(nome);
}

