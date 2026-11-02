import { formatMissorted } from "@/lib/missorted";
import { durationLabel } from "@/lib/conferencia";

type Tone = "blue" | "red" | "amber" | "orange" | "purple" | "green" | "cyan" | "muted";
export type ReportMetric = { label: string; value: number | null; tone: Tone; note?: string };
export type ReportConfRow = { shift: string; routes: number; collaborators: number; average: number | null; scanned: number | null; missing: number | null; missorted: number | null };
export type ReportConferencia = { rows: ReportConfRow[]; total: ReportConfRow; showTotal: boolean };
type ReportInput = {
  hub: string; period: string; shifts: string; metrics: ReportMetric[];
  missorted: { percent: number | null; above: boolean; target: number | null };
  conferencia: ReportConferencia | null;
};

/** Independent canvas composition; all values are supplied by existing dashboard readers. */
export async function createShiftSummaryPng(input: ReportInput): Promise<Blob> {
  await Promise.all([document.fonts.load('700 40px "Archivo"'), document.fonts.load('400 24px "IBM Plex Sans"')]);
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Não foi possível gerar a imagem.");
  const css = getComputedStyle(document.documentElement);
  const color = (role: string) => css.getPropertyValue(`--report-${role}`).trim();
  const font = (size: number, bold = false) => `${bold ? 700 : 400} ${size}px "${bold ? "Archivo" : "IBM Plex Sans"}", sans-serif`;
  const text = (value: string, x: number, y: number, size: number, role = "text", bold = false) => {
    g.font = font(size, bold); g.fillStyle = color(role); g.fillText(value, x, y);
  };
  const textR = (value: string, x: number, y: number, size: number, role = "text", bold = false) => {
    g.font = font(size, bold); g.fillStyle = color(role); g.fillText(value, x - g.measureText(value).width, y);
  };
  const wrap = (value: string, width: number, size: number, bold = false) => {
    g.font = font(size, bold);
    const lines: string[] = [];
    for (const paragraph of value.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (g.measureText(candidate).width <= width) { line = candidate; continue; }
        if (line) { lines.push(line); line = ""; }
        for (const char of word) {
          if (g.measureText(line + char).width > width && line) { lines.push(line); line = ""; }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const box = (x: number, y: number, w: number, h: number, border: string) => {
    g.beginPath(); g.roundRect(x, y, w, h, 8); g.fillStyle = color("surface"); g.fill();
    g.strokeStyle = color(border); g.lineWidth = 1.5; g.stroke();
  };
  // Stroke pictograms are drawn directly, so PNG generation never races image loading.
  const icon = (index: number, x: number, y: number, tone: string, size = 40) => {
    g.save(); g.translate(x, y); g.scale(size / 40, size / 40);
    g.strokeStyle = color(tone); g.lineWidth = 2.5; g.lineCap = "round"; g.lineJoin = "round";
    const path = (points: number[][]) => { g.beginPath(); points.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke(); };
    const circle = (cx: number, cy: number, r: number) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); };
    if (index === 0) { g.strokeRect(3, 9, 21, 20); path([[24, 16], [31, 16], [37, 23], [37, 29], [24, 29]]); circle(11, 31, 4); circle(30, 31, 4); }
    else if (index === 1) { path([[20, 3], [38, 35], [2, 35], [20, 3]]); path([[20, 14], [20, 23]]); circle(20, 29, 1); }
    else if (index === 2) { path([[3, 5], [21, 5], [37, 21], [21, 37], [3, 19], [3, 5]]); circle(11, 13, 2.5); }
    else if (index === 5) { path([[20, 3], [34, 9], [33, 24], [28, 32], [20, 38], [12, 32], [7, 24], [6, 9], [20, 3]]); path([[12, 20], [18, 26], [28, 14]]); }
    else if (index === 7) { circle(20, 20, 17); path([[12, 12], [28, 28]]); circle(13, 27, 3); circle(27, 13, 3); }
    else { path([[4, 11], [20, 3], [36, 11], [36, 29], [20, 37], [4, 29], [4, 11], [20, 19], [36, 11]]); path([[20, 19], [20, 37]]); if (index === 6) path([[12, 25], [18, 31], [28, 22]]); }
    g.restore();
  };
  const fmt = (v: number) => v.toLocaleString("pt-BR");
  const num = (v: number | null) => v === null ? "Sem informação" : fmt(v);

  // ---- Layout heights ----
  const W = 1920;
  const M = 48;
  const conf = input.conferencia;
  const confTableRows = conf ? conf.rows.length + (conf.showTotal ? 1 : 0) : 0;
  const confCardsH = conf ? 150 : 0;
  const confTableH = conf ? 46 + confTableRows * 46 + 14 : 64;
  const confH = 56 + confCardsH + (conf ? 24 : 0) + confTableH;

  const result = input.missorted;
  const sorting = input.metrics[1]?.value ?? null;
  const etiqueta = input.metrics[2]?.value ?? null;
  const attentionLines: string[] = [];
  if (conf) {
    for (const r of conf.rows) attentionLines.push(`${r.shift}: ${num(r.missing)} pedidos faltantes e ${num(r.missorted)} pedidos Missorted.`);
    if (conf.showTotal) attentionLines.push(`Consolidado: ${num(conf.total.missing)} pedidos faltantes e ${num(conf.total.missorted)} pedidos Missorted.`);
  } else attentionLines.push("Conferência: sem dados no período.");
  if (result.percent !== null && result.target !== null && result.above)
    attentionLines.push(`MISSORTED do Dashboard em ${formatMissorted(result.percent)}, acima da meta de ${formatMissorted(result.target)}.`);
  attentionLines.push(`Erros de sorting: ${sorting === null ? "sem dados no período" : `${fmt(sorting)} ocorrência(s) para acompanhamento`}.`);
  attentionLines.push(`Erros de etiqueta: ${etiqueta === null ? "sem dados no período" : `${fmt(etiqueta)} ocorrência(s) para acompanhamento`}.`);
  const attentionH = 56 + 28 + attentionLines.length * 36 + 28;

  const avariasSalvas = input.metrics[5]?.value ?? null;
  const onHoldTratados = input.metrics[6]?.value ?? null;
  const highlights: [string, string][] = [
    ["Rotas conferidas", conf ? fmt(conf.total.routes) : "Sem dados no período"],
    ["Tempo médio de conferência", conf ? durationLabel(conf.total.average) : "Sem dados no período"],
    ["Pedidos escaneados", conf ? num(conf.total.scanned) : "Sem dados no período"],
    ["Avarias salvas", avariasSalvas === null ? "Sem dados no período" : fmt(avariasSalvas)],
    ["Pacotes tratados do ON HOLD", onHoldTratados === null ? "Sem dados no período" : fmt(onHoldTratados)],
  ];
  const highlightsH = 56 + 120;

  const headerH = 180;
  const summaryH = 56 + 2 * 185 + 24;
  const footerH = 96;
  const H = Math.max(1080, headerH + 24 + summaryH + 40 + confH + 40 + attentionH + 40 + highlightsH + 24 + footerH);

  canvas.width = W; canvas.height = H;
  g.fillStyle = color("background"); g.fillRect(0, 0, W, H);
  g.fillStyle = color("orange"); g.fillRect(0, 0, W, 6);

  // ---- Header ----
  box(M, 39, 64, 70, "orange"); text("S", 67, 89, 42, "orange", true);
  text("SHOPEE OPERATIONS HUB", 132, 65, 19, "orange", true);
  text("Relatório Operacional Completo", 132, 111, 40, "text", true);
  text(input.hub, 132, 144, 21, "muted");
  const periodWidth = Math.max(480, ...wrap(`PERÍODO · ${input.period}`, W - 1000, 22).map(line => { g.font = font(22, true); return g.measureText(line).width + 48; }), ...wrap(input.shifts, W - 1000, 25).map(line => { g.font = font(25, true); return g.measureText(line).width + 48; }));
  box(W - periodWidth - M, 39, periodWidth, 105, "orange");
  wrap(`PERÍODO · ${input.period}`, periodWidth - 48, 22, true).forEach((line, i) => text(line, W - periodWidth - 24, 79 + i * 26, 22, "text", true));
  wrap(input.shifts, periodWidth - 48, 25, true).forEach((line, i) => text(line, W - periodWidth - 24, 118 + i * 28, 25, "orange", true));

  let y = headerH + 24;

  // ---- Resumo geral da operação ----
  text("RESUMO GERAL DA OPERAÇÃO", M, y + 27, 27, "text", true);
  const missTone = result.percent === null || result.target === null ? "muted" : result.above ? "red" : "green";
  const status = result.percent === null ? "Sem dados" : result.target === null ? "Meta indisponível" : result.above ? "Acima da meta" : "Dentro da meta";
  const cardWidth = (W - 96 - 72) / 4;
  const metrics = [...input.metrics, { label: "MISSORTED", value: result.percent, tone: missTone as Tone }];
  metrics.forEach((m, i) => {
    const x = M + (i % 4) * (cardWidth + 24), cy = y + 56 + Math.floor(i / 4) * 209;
    box(x, cy, cardWidth, 185, m.tone);
    g.fillStyle = color(m.tone); g.fillRect(x + 1, cy + 18, 3, 148);
    icon(i, x + 24, cy + 24, m.tone);
    wrap(m.label, cardWidth - 108, 21, true).forEach((line, j) => text(line, x + 82, cy + 40 + j * 26, 21, "text", true));
    const value = i === 7 ? (result.percent === null ? "Sem dados" : formatMissorted(result.percent)) : m.value === null ? "Nenhum dado disponível" : fmt(m.value);
    let size = m.value === null ? 25 : 54;
    while (size > 18 && (g.font = font(size, true), g.measureText(value).width > cardWidth - 48)) size--;
    text(value, x + 24, cy + 126, size, m.tone, true);
    const caption = i === 7 ? `Meta: ${result.target === null ? "Sem informação" : formatMissorted(result.target)} · ${status}` : m.value === null ? "Sem informação no relatório" : i === 5 || i === 6 ? "Destaque operacional" : "Período e turnos selecionados";
    text(caption, x + 24, cy + 162, 19, "muted");
  });
  y += summaryH + 40;

  // ---- Desempenho da Conferência ----
  text("DESEMPENHO DA CONFERÊNCIA", M, y + 27, 27, "text", true);
  let cy = y + 56;
  if (conf) {
    const confCards: { label: string; value: string; tone: Tone; icon: number }[] = [
      { label: "ROTAS CONFERIDAS", value: fmt(conf.total.routes), tone: "orange", icon: 0 },
      { label: "TEMPO MÉDIO", value: durationLabel(conf.total.average), tone: "blue", icon: 7 },
      { label: "COLABORADORES ÚNICOS", value: fmt(conf.total.collaborators), tone: "purple", icon: 3 },
      { label: "PEDIDOS ESCANEADOS", value: num(conf.total.scanned), tone: "cyan", icon: 6 },
      { label: "PEDIDOS FALTANTES", value: num(conf.total.missing), tone: "red", icon: 1 },
      { label: "PEDIDOS MISSORTED", value: num(conf.total.missorted), tone: "amber", icon: 2 },
    ];
    const w6 = (W - 96 - 5 * 20) / 6;
    confCards.forEach((c, i) => {
      const x = M + i * (w6 + 20);
      box(x, cy, w6, 150, c.tone);
      g.fillStyle = color(c.tone); g.fillRect(x + 1, cy + 14, 3, 122);
      icon(c.icon, x + 18, cy + 16, c.tone, 30);
      wrap(c.label, w6 - 78, 16, true).forEach((line, j) => text(line, x + 58, cy + 30 + j * 20, 16, "text", true));
      let size = 32;
      while (size > 16 && (g.font = font(size, true), g.measureText(c.value).width > w6 - 36)) size--;
      text(c.value, x + 18, cy + 118, size, c.tone, true);
    });
    cy += 150 + 24;
    const tw = W - 96;
    const colTurno = 240;
    const colN = (tw - colTurno) / 6;
    box(M, cy, tw, 46 + confTableRows * 46 + 14, "border");
    const headers = ["Turno", "Rotas", "Colaboradores", "Tempo médio", "Escaneados", "Faltantes", "Missorted"];
    text(headers[0], M + 24, cy + 31, 19, "muted", true);
    headers.slice(1).forEach((h, i) => textR(h, M + colTurno + (i + 1) * colN - 12, cy + 31, 19, "muted", true));
    g.strokeStyle = color("border"); g.lineWidth = 1; g.beginPath(); g.moveTo(M + 16, cy + 46); g.lineTo(M + tw - 16, cy + 46); g.stroke();
    const tableRows = [...conf.rows, ...(conf.showTotal ? [{ ...conf.total, shift: "Total" }] : [])];
    tableRows.forEach((r, i) => {
      const ry = cy + 46 + i * 46;
      const tone = r.shift === "AM1" ? "orange" : r.shift === "AM2" ? "blue" : r.shift === "PM1" ? "purple" : "text";
      text(r.shift, M + 24, ry + 31, 20, tone, true);
      [fmt(r.routes), fmt(r.collaborators), durationLabel(r.average), num(r.scanned), num(r.missing), num(r.missorted)]
        .forEach((v, j) => textR(v, M + colTurno + (j + 1) * colN - 12, ry + 31, 20, j >= 4 ? "amber" : "text"));
      if (i < tableRows.length - 1) { g.strokeStyle = color("border"); g.beginPath(); g.moveTo(M + 16, ry + 46); g.lineTo(M + tw - 16, ry + 46); g.stroke(); }
    });
  } else {
    box(M, cy, W - 96, 64, "border");
    text("Sem dados no período", M + 24, cy + 40, 22, "muted");
  }
  y += confH + 40;

  // ---- Principais pontos de atenção ----
  text("PRINCIPAIS PONTOS DE ATENÇÃO", M, y + 27, 27, "text", true);
  cy = y + 56;
  box(M, cy, W - 96, attentionH - 56, "red");
  g.fillStyle = color("red"); g.fillRect(M + 1, cy + 14, 3, attentionH - 56 - 28);
  attentionLines.forEach((line, i) => {
    const isMiss = line.startsWith("MISSORTED");
    text(`• ${line}`, M + 28, cy + 28 + i * 36 + 8, 22, isMiss ? "red" : "text", isMiss);
  });
  y += attentionH + 40;

  // ---- Destaques operacionais ----
  text("DESTAQUES OPERACIONAIS", M, y + 27, 27, "text", true);
  cy = y + 56;
  box(M, cy, W - 96, 120, "green");
  g.fillStyle = color("green"); g.fillRect(M + 1, cy + 14, 3, 92);
  const hw = (W - 96 - 48) / highlights.length;
  highlights.forEach(([label, value], i) => {
    const x = M + 24 + i * hw;
    wrap(label, hw - 24, 17, true).forEach((line, j) => text(line, x, cy + 34 + j * 21, 17, "muted", true));
    let size = 30;
    while (size > 15 && (g.font = font(size, true), g.measureText(value).width > hw - 24)) size--;
    text(value, x, cy + 96, size, "green", true);
  });

  // ---- Footer ----
  g.strokeStyle = color("orange"); g.lineWidth = 1; g.beginPath(); g.moveTo(M, H - 76); g.lineTo(W - M, H - 76); g.stroke();
  text("HUB LSP-36", M, H - 32, 25, "text", true);
  text("Shopee Operations Hub · Embu das Artes", 240, H - 32, 21, "muted");
  const stamp = `Gerado em ${new Date().toLocaleString("pt-BR")}`;
  g.font = font(21); text(stamp, W - M - g.measureText(stamp).width, H - 32, 21, "muted");
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível gerar o PNG.")), "image/png"));
}
