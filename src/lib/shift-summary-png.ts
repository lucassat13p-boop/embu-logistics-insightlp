import { formatMissorted } from "@/lib/missorted";
import { durationLabel } from "@/lib/conferencia";

type Tone = "blue" | "red" | "amber" | "orange" | "purple" | "green" | "cyan" | "muted";
export type ReportMetric = { label: string; value: number | null; tone: Tone; note?: string };
export type ReportConfRow = { shift: string; hasData: boolean; routes: number; collaborators: number; average: number | null; scanned: number | null; missing: number | null; missorted: number | null };
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
  // Resolve any CSS color to rgba() so tints and glows work regardless of the source format.
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const pg = probe.getContext("2d")!;
  const rgba = (cssColor: string, alpha: number) => {
    pg.clearRect(0, 0, 1, 1); pg.fillStyle = cssColor; pg.fillRect(0, 0, 1, 1);
    const d = pg.getImageData(0, 0, 1, 1).data;
    return `rgba(${d[0]},${d[1]},${d[2]},${alpha})`;
  };
  const font = (size: number, bold = false) => `${bold ? 700 : 400} ${size}px "${bold ? "Archivo" : "IBM Plex Sans"}", sans-serif`;
  const text = (value: string, x: number, y: number, size: number, role = "text", bold = false) => {
    g.font = font(size, bold); g.fillStyle = color(role); g.fillText(value, x, y);
  };
  const textR = (value: string, x: number, y: number, size: number, role = "text", bold = false) => {
    g.font = font(size, bold); g.fillStyle = color(role); g.fillText(value, x - g.measureText(value).width, y);
  };
  const textC = (value: string, x: number, y: number, size: number, role = "text", bold = false) => {
    g.font = font(size, bold); g.fillStyle = color(role); g.fillText(value, x - g.measureText(value).width / 2, y);
  };
  const measure = (value: string, size: number, bold = false) => { g.font = font(size, bold); return g.measureText(value).width; };
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
  const box = (x: number, y: number, w: number, h: number, border: string, radius = 12, tint = 0) => {
    g.beginPath(); g.roundRect(x, y, w, h, radius); g.fillStyle = color("surface"); g.fill();
    if (tint > 0) { g.fillStyle = rgba(color(border), tint); g.fill(); }
    g.strokeStyle = rgba(color(border), 0.85); g.lineWidth = 2; g.stroke();
  };
  const glow = (x: number, y: number, r: number, tone: string, alpha = 0.12) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, rgba(color(tone), alpha));
    grad.addColorStop(1, rgba(color(tone), 0));
    g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
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
    else if (index === 3) { circle(13, 13, 5); path([[5, 33], [7, 26], [13, 24], [19, 26], [21, 33]]); circle(27, 15, 4); path([[23, 33], [24, 28], [29, 26], [34, 28], [35, 33]]); }
    else if (index === 4) { path([[4, 12], [4, 4], [12, 4]]); path([[28, 4], [36, 4], [36, 12]]); path([[36, 28], [36, 36], [28, 36]]); path([[12, 36], [4, 36], [4, 28]]); path([[10, 20], [30, 20]]); }
    else if (index === 5) { path([[20, 3], [34, 9], [33, 24], [28, 32], [20, 38], [12, 32], [7, 24], [6, 9], [20, 3]]); path([[12, 20], [18, 26], [28, 14]]); }
    else if (index === 7) { circle(20, 20, 17); path([[12, 12], [28, 28]]); circle(13, 27, 3); circle(27, 13, 3); }
    else if (index === 8) { circle(20, 15, 8); path([[14, 21], [10, 34], [20, 29], [30, 34], [26, 21]]); }
    else if (index === 9) { circle(20, 20, 16); path([[12, 20], [18, 26], [28, 14]]); }
    else if (index === 10) { g.strokeRect(4, 8, 32, 28); path([[4, 16], [36, 16]]); path([[12, 4], [12, 10]]); path([[28, 4], [28, 10]]); }
    else if (index === 11) { circle(20, 20, 16); path([[20, 12], [20, 20], [27, 24]]); }
    else if (index === 12) { g.strokeRect(8, 6, 24, 32); g.strokeRect(14, 3, 12, 6); path([[14, 18], [26, 18]]); path([[14, 25], [26, 25]]); }
    else { path([[4, 11], [20, 3], [36, 11], [36, 29], [20, 37], [4, 29], [4, 11], [20, 19], [36, 11]]); path([[20, 19], [20, 37]]); if (index === 6) path([[12, 25], [18, 31], [28, 22]]); }
    g.restore();
  };
  const fmt = (v: number) => v.toLocaleString("pt-BR");
  const num = (v: number | null) => v === null ? "Sem informação" : fmt(v);
  const cell = (v: number | null) => v === null ? "—" : fmt(v);

  const W = 1920;
  const M = 40;
  const conf = input.conferencia;
  const result = input.missorted;
  const sorting = input.metrics[1]?.value ?? null;
  const etiqueta = input.metrics[2]?.value ?? null;
  const avariasSalvas = input.metrics[5]?.value ?? null;
  const onHoldTratados = input.metrics[6]?.value ?? null;

  // ---- Pontos de atenção: somente turnos com registros, sem consolidado duplicado ----
  const confRowsWithData = conf ? conf.rows.filter(r => (r.missing ?? 0) > 0 || (r.missorted ?? 0) > 0) : [];
  const attentionLines: { value: string; tone: "text" | "red"; bold: boolean }[] = [];
  if (conf) {
    for (const r of confRowsWithData)
      attentionLines.push({ value: `${r.shift}: ${cell(r.missing)} pedidos faltantes e ${cell(r.missorted)} Missorted.`, tone: "text", bold: false });
    if (conf.showTotal && confRowsWithData.length > 1)
      attentionLines.push({ value: `Consolidado: ${cell(conf.total.missing)} pedidos faltantes e ${cell(conf.total.missorted)} Missorted.`, tone: "text", bold: false });
  }
  if (result.percent !== null && result.target !== null && result.above)
    attentionLines.push({ value: `MISSORTED (${formatMissorted(result.percent)}): acima da meta de ${formatMissorted(result.target)}.`, tone: "red", bold: true });
  if (sorting !== null && sorting > 0)
    attentionLines.push({ value: `${fmt(sorting)} erros de sorting registrados no período.`, tone: "text", bold: false });
  if (etiqueta !== null && etiqueta > 0)
    attentionLines.push({ value: `${fmt(etiqueta)} erros de etiqueta registrados no período.`, tone: "text", bold: false });
  if (attentionLines.length === 0)
    attentionLines.push({ value: "Nenhum ponto de atenção no período.", tone: "text", bold: false });

  // ---- Destaques operacionais ----
  const highlights: { value: string; label: string }[] = [];
  if (conf) {
    highlights.push({ value: fmt(conf.total.routes), label: "rotas conferidas" });
    highlights.push({ value: durationLabel(conf.total.average), label: "de tempo médio de conferência" });
    if (conf.total.scanned !== null) highlights.push({ value: fmt(conf.total.scanned), label: "pedidos escaneados" });
  }
  if (avariasSalvas !== null) highlights.push({ value: fmt(avariasSalvas), label: "avarias salvas" });
  if (onHoldTratados !== null) highlights.push({ value: fmt(onHoldTratados), label: "pacotes tratados do ON HOLD" });

  // ---- Métricas de layout ----
  const wL = 1130;
  const wR = W - M * 2 - wL - 20;
  const xR = M + wL + 20;

  const confTableRows = conf ? conf.rows.length + (conf.showTotal ? 1 : 0) : 0;
  const confContentH = conf
    ? 84 + 118 + 22 + (42 + confTableRows * 44 + 14) + 24
    : 84 + 64 + 24;

  const attItemH = (line: string) => wrap(line, wR - 100, 22).length * 30 + 14;
  const attBodyH = attentionLines.reduce((sum, l) => sum + attItemH(l.value), 0);
  const attH = 84 + attBodyH + 20;

  const dstItemH = (h: { value: string; label: string }) => Math.max(30, wrap(`${h.value} ${h.label}.`, wR - 110, 22).length * 30) + 12;
  const dstBodyH = highlights.length === 0 ? 40 : highlights.reduce((sum, h) => sum + dstItemH(h), 0);
  const dstH = 84 + dstBodyH + 20;

  // O painel da Conferência se estende até a base do painel Destaques Operacionais,
  // formando um bloco alinhado nas duas colunas; o espaço extra é distribuído internamente.
  const rightH = attH + 20 + dstH;
  const confH = Math.max(confContentH, rightH);
  const confGapExtra = conf ? Math.max(0, confH - confContentH) / 2 : 0;

  const headerH = 128;
  const summaryH = 2 * 150 + 20;
  const bodyY = headerH + 24 + summaryH + 32;
  const footerH = 84;
  const H = Math.max(1080, bodyY + Math.max(confH, rightH) + 24 + footerH);

  canvas.width = W; canvas.height = H;
  g.fillStyle = color("background"); g.fillRect(0, 0, W, H);
  glow(W - 120, 0, 640, "orange", 0.14);
  glow(120, H, 560, "orange", 0.08);

  // ---- Cabeçalho ----
  g.beginPath(); g.roundRect(M, 30, 76, 76, 18); g.fillStyle = color("orange"); g.fill();
  g.save(); g.fillStyle = "#ffffff"; g.font = font(44, true); g.fillText("S", M + 38 - g.measureText("S").width / 2, 82); g.restore();
  const shopeeW = measure("Shopee", 34, true);
  text("Shopee", M + 100, 84, 34, "text", true);
  const divX = M + 100 + shopeeW + 26;
  g.strokeStyle = color("border"); g.lineWidth = 2; g.beginPath(); g.moveTo(divX, 46); g.lineTo(divX, 94); g.stroke();
  text(`Operations Hub – ${input.hub}`, divX + 26, 74, 40, "text", true);
  text("Relatório Operacional Completo", divX + 26, 106, 22, "muted");
  const periodLines = wrap(`Período: ${input.period}`, 430, 20);
  const shiftLines = wrap(`Turno: ${input.shifts}`, 430, 20, true);
  const periodW = Math.max(430, ...periodLines.map(l => measure(l, 20) + 90), ...shiftLines.map(l => measure(l, 20, true) + 90));
  const periodH = 32 + periodLines.length * 26 + shiftLines.length * 26;
  box(W - M - periodW, 30, periodW, periodH, "orange", 12, 0.06);
  icon(10, W - M - periodW + 18, 30 + periodH / 2 - 16, "orange", 32);
  let py = 30 + 36;
  for (const line of periodLines) { text(line, W - M - periodW + 62, py, 20, "text"); py += 26; }
  for (const line of shiftLines) {
    const sep = line.indexOf(":");
    if (sep > 0) {
      text(`${line.slice(0, sep + 1)} `, W - M - periodW + 62, py, 20, "text");
      text(line.slice(sep + 1).trim(), W - M - periodW + 62 + measure(`${line.slice(0, sep + 1)} `, 20), py, 20, "orange", true);
    } else text(line, W - M - periodW + 62, py, 20, "orange", true);
    py += 26;
  }

  // ---- Resumo geral: 8 indicadores em 2 linhas de 4 ----
  const missTone = result.percent === null || result.target === null ? "muted" : result.above ? "red" : "green";
  const status = result.percent === null ? "Sem dados" : result.target === null ? "Meta indisponível" : result.above ? "Acima da meta" : "Dentro da meta";
  const cardW = (W - M * 2 - 3 * 20) / 4;
  const metrics = [...input.metrics, { label: "MISSORTED", value: result.percent, tone: missTone as Tone }];
  const summaryY = headerH + 24;
  metrics.forEach((m, i) => {
    const x = M + (i % 4) * (cardW + 20), cy = summaryY + Math.floor(i / 4) * 170;
    box(x, cy, cardW, 150, m.tone, 12, 0.07);
    glow(x + 60, cy + 60, 150, m.tone, 0.10);
    icon(i, x + 20, cy + 22, m.tone, 36);
    wrap(m.label, cardW - 84, 18, true).forEach((line, j) => text(line, x + 66, cy + 40 + j * 22, 18, "text", true));
    if (i === 7) {
      const value = result.percent === null ? "Sem dados" : formatMissorted(result.percent);
      let size = result.percent === null ? 26 : 52;
      while (size > 18 && measure(value, size, true) > cardW - 200) size--;
      text(value, x + 20, cy + 122, size, m.tone, true);
      const meta = `Meta: ${result.target === null ? "Sem informação" : formatMissorted(result.target)}`;
      text(meta, x + cardW - 20 - measure(status, 17, true) - 32, cy + 92, 17, "muted");
      const badgeW = measure(status, 17, true) + 24;
      g.beginPath(); g.roundRect(x + cardW - 20 - badgeW, cy + 104, badgeW, 30, 15);
      g.fillStyle = rgba(color(m.tone), result.percent === null || result.target === null ? 0.25 : 0.9); g.fill();
      g.save(); g.fillStyle = "#ffffff"; g.font = font(17, true); g.fillText(status, x + cardW - 20 - badgeW + 12, cy + 125); g.restore();
    } else {
      const value = m.value === null ? "Nenhum dado disponível" : fmt(m.value);
      let size = m.value === null ? 24 : 54;
      while (size > 18 && measure(value, size, true) > cardW - 40) size--;
      text(value, x + 20, cy + 122, size, m.tone, true);
      if (m.value === null) text("Sem informação no relatório", x + 20, cy + 140, 15, "muted");
    }
  });

  // ---- Desempenho da Conferência (coluna esquerda) ----
  box(M, bodyY, wL, confH, "orange", 14, 0);
  g.save(); g.beginPath(); g.roundRect(M, bodyY, wL, 64, [14, 14, 0, 0]); g.fillStyle = rgba(color("orange"), 0.12); g.fill(); g.restore();
  icon(12, M + 22, bodyY + 16, "orange", 32);
  text("Desempenho da Conferência", M + 66, bodyY + 42, 26, "text", true);
  if (conf) {
    const confCards: { label: string; value: string; tone: Tone; icon: number }[] = [
      { label: "Rotas Conferidas", value: fmt(conf.total.routes), tone: "cyan", icon: 0 },
      { label: "Tempo Médio", value: durationLabel(conf.total.average), tone: "orange", icon: 11 },
      { label: "Colaboradores", value: fmt(conf.total.collaborators), tone: "purple", icon: 3 },
      { label: "Pedidos Escaneados", value: num(conf.total.scanned), tone: "green", icon: 4 },
      { label: "Pedidos Faltantes", value: num(conf.total.missing), tone: "amber", icon: 1 },
      { label: "Pedidos Missorted", value: num(conf.total.missorted), tone: "red", icon: 2 },
    ];
    const w6 = (wL - 48 - 5 * 14) / 6;
    const cy = bodyY + 84;
    confCards.forEach((c, i) => {
      const x = M + 24 + i * (w6 + 14);
      box(x, cy, w6, 118, c.tone, 10, 0.08);
      icon(c.icon, x + 14, cy + 14, c.tone, 26);
      wrap(c.label, w6 - 52, 13, true).slice(0, 2).forEach((line, j) => text(line, x + 48, cy + 27 + j * 16, 13, "text", true));
      const raw = c.value;
      let size = raw === "Sem informação" ? 16 : 28;
      while (size > 13 && measure(raw, size, true) > w6 - 24) size--;
      text(raw, x + 14, cy + 96, size, c.tone, true);
    });
    // Tabela por turno (o espaço extra do painel é dividido entre o vão acima da tabela e a base)
    const ty = cy + 118 + 22 + confGapExtra;
    const tw = wL - 48;
    const colTurno = 190;
    const colN = (tw - colTurno) / 6;
    const tableH = 42 + confTableRows * 44 + 14;
    box(M + 24, ty, tw, tableH, "border", 10);
    const headers = ["Turno", "Rotas", "Colaboradores", "Tempo médio", "Escaneados", "Faltantes", "Missorted"];
    text(headers[0], M + 24 + 20, ty + 29, 17, "muted", true);
    headers.slice(1).forEach((h, i) => textR(h, M + 24 + colTurno + (i + 1) * colN - 12, ty + 29, 17, "muted", true));
    g.strokeStyle = color("border"); g.lineWidth = 1; g.beginPath(); g.moveTo(M + 24 + 12, ty + 42); g.lineTo(M + 24 + tw - 12, ty + 42); g.stroke();
    const tableRows = [...conf.rows, ...(conf.showTotal ? [{ ...conf.total, shift: "Total" }] : [])];
    tableRows.forEach((r, i) => {
      const ry = ty + 42 + i * 44;
      const isTotal = r.shift === "Total";
      if (isTotal) {
        g.save(); g.beginPath(); g.roundRect(M + 24 + 6, ry, tw - 12, 44, 8); g.fillStyle = rgba(color("orange"), 0.28); g.fill(); g.restore();
      }
      const tone = isTotal ? "orange" : r.shift === "AM1" ? "cyan" : r.shift === "AM2" ? "orange" : r.shift === "PM1" ? "purple" : "text";
      if (!isTotal) {
        g.beginPath(); g.roundRect(M + 24 + 20, ry + 9, 74, 26, 8);
        g.fillStyle = rgba(color(tone), 0.16); g.fill(); g.strokeStyle = rgba(color(tone), 0.7); g.lineWidth = 1.5; g.stroke();
        textC(r.shift, M + 24 + 20 + 37, ry + 28, 16, tone, true);
      } else text(r.shift, M + 24 + 20, ry + 29, 18, "text", true);
      if (!r.hasData) {
        text("Sem dados", M + 24 + colTurno + 12, ry + 29, 17, "muted");
      } else {
        [cell(r.routes), cell(r.collaborators), r.average === null ? "—" : durationLabel(r.average), cell(r.scanned), cell(r.missing), cell(r.missorted)]
          .forEach((v, j) => textR(v, M + 24 + colTurno + (j + 1) * colN - 12, ry + 29, 18, isTotal ? "text" : j >= 4 ? "amber" : "text", isTotal));
      }
      if (i < tableRows.length - 1) { g.strokeStyle = rgba(color("border"), 0.6); g.beginPath(); g.moveTo(M + 24 + 12, ry + 44); g.lineTo(M + 24 + tw - 12, ry + 44); g.stroke(); }
    });
  } else {
    box(M + 24, bodyY + 84, wL - 48, 64, "border", 10);
    text("Sem dados no período", M + 24 + 24, bodyY + 84 + 40, 22, "muted");
  }

  // ---- Principais Pontos de Atenção (coluna direita, topo) ----
  box(xR, bodyY, wR, attH, "red", 14, 0);
  g.save(); g.beginPath(); g.roundRect(xR, bodyY, wR, 64, [14, 14, 0, 0]); g.fillStyle = rgba(color("red"), 0.14); g.fill(); g.restore();
  icon(1, xR + 22, bodyY + 16, "red", 32);
  text("Principais Pontos de Atenção", xR + 66, bodyY + 42, 24, "text", true);
  let ay = bodyY + 84;
  for (const line of attentionLines) {
    g.beginPath(); g.arc(xR + 32, ay + 8, 5, 0, Math.PI * 2); g.fillStyle = color(line.tone === "red" ? "red" : "orange"); g.fill();
    for (const wl of wrap(line.value, wR - 100, 22)) { text(wl, xR + 52, ay + 16, 22, line.tone, line.bold); ay += 30; }
    ay += 14;
  }

  // ---- Destaques Operacionais (coluna direita, abaixo) ----
  const dy = bodyY + attH + 20;
  box(xR, dy, wR, dstH, "green", 14, 0);
  g.save(); g.beginPath(); g.roundRect(xR, dy, wR, 64, [14, 14, 0, 0]); g.fillStyle = rgba(color("green"), 0.14); g.fill(); g.restore();
  icon(8, xR + 22, dy + 16, "green", 32);
  text("Destaques Operacionais", xR + 66, dy + 42, 24, "text", true);
  let ey = dy + 84;
  if (highlights.length === 0) {
    text("Sem dados no período.", xR + 32, ey + 16, 22, "muted");
  } else {
    for (const h of highlights) {
      icon(9, xR + 26, ey - 2, "green", 26);
      const full = `${h.value} ${h.label}.`;
      const lines = wrap(full, wR - 110, 22);
      let first = true;
      for (const wl of lines) {
        if (first && wl.startsWith(h.value)) {
          text(h.value, xR + 62, ey + 16, 22, "text", true);
          text(wl.slice(h.value.length), xR + 62 + measure(h.value, 22, true), ey + 16, 22, "text");
        } else {
          text(wl, xR + 62, ey + 16, 22, "text");
        }
        first = false;
        ey += 30;
      }
      ey += 12;
    }
  }

  // ---- Rodapé ----
  g.strokeStyle = color("orange"); g.lineWidth = 2; g.beginPath(); g.moveTo(M, H - 66); g.lineTo(W - M, H - 66); g.stroke();
  text(input.hub, M, H - 28, 22, "text", true);
  text("Shopee Operations Hub – Embu das Artes", M + measure(input.hub, 22, true) + 20, H - 28, 19, "muted");
  const stamp = `Gerado em ${new Date().toLocaleString("pt-BR")}`;
  icon(11, W - M - measure(stamp, 19) - 30, H - 44, "muted", 22);
  textR(stamp, W - M, H - 28, 19, "muted");
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível gerar o PNG.")), "image/png"));
}
