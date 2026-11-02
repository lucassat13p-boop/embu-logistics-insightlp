import { formatMissorted } from "@/lib/missorted";

type Tone = "blue" | "red" | "amber" | "orange" | "purple" | "green" | "cyan" | "muted";
export type ReportMetric = { label: string; value: number | null; tone: Tone; note?: string };
export type ReportShift = { shift: string; av: number; oh: number; entries: number; notes: { date: string; text: string }[] };
type ReportInput = {
  hub: string; period: string; shifts: string; metrics: ReportMetric[]; attention: ReportShift[];
  missorted: { percent: number | null; above: boolean; target: number | null };
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
  const noteLines = (s: ReportShift, width: number) => s.notes.flatMap(n => wrap(`${n.date.split("-").reverse().join("/")} · ${n.text}`, width, 23));
  const columns = Math.max(input.attention.length, 1);
  const initialWidth = (1920 - 96 - (columns - 1) * 24) / columns;
  const longestNotes = Math.max(0, ...input.attention.map(s => noteLines(s, initialWidth - 48).length));
  // Expand the 16:9 canvas only for unusually long real observations; never omit or clip them.
  const H = Math.max(1080, 875 + longestNotes * 31);
  const W = Math.ceil(H * 16 / 9);
  canvas.width = W; canvas.height = H;
  g.fillStyle = color("background"); g.fillRect(0, 0, W, H);
  g.fillStyle = color("orange"); g.fillRect(0, 0, W, 6);
  box(48, 39, 64, 70, "orange"); text("S", 67, 89, 42, "orange", true);
  text("SHOPEE OPERATIONS HUB", 132, 65, 19, "orange", true);
  text("Resumo Operacional do Turno", 132, 111, 40, "text", true);
  text(`${input.hub} · Embu das Artes`, 132, 144, 21, "muted");
  const periodWidth = Math.max(480, ...wrap(input.period, W - 1000, 25).map(line => { g.font = font(25); return g.measureText(line).width + 48; }));
  box(W - periodWidth - 48, 39, periodWidth, 105, "orange");
  text(`PERÍODO · ${input.period}`, W - periodWidth - 24, 79, 22, "text", true);
  text(input.shifts, W - periodWidth - 24, 118, 25, "orange", true);

  const result = input.missorted;
  const missTone = result.percent === null || result.target === null ? "muted" : result.above ? "red" : "green";
  const status = result.percent === null ? "Sem dados" : result.target === null ? "Meta indisponível" : result.above ? "Acima da meta" : "Dentro da meta";
  const cardWidth = (W - 96 - 72) / 4;
  const metrics = [...input.metrics, { label: "MISSORTED", value: result.percent, tone: missTone as Tone }];
  metrics.forEach((m, i) => {
    const x = 48 + (i % 4) * (cardWidth + 24), y = 185 + Math.floor(i / 4) * 209;
    box(x, y, cardWidth, 185, m.tone);
    g.fillStyle = color(m.tone); g.fillRect(x + 1, y + 18, 3, 148);
    icon(i, x + 24, y + 24, m.tone);
    wrap(m.label, cardWidth - 108, 21, true).forEach((line, j) => text(line, x + 82, y + 40 + j * 26, 21, "text", true));
    const value = i === 7 ? (result.percent === null ? "Sem dados" : formatMissorted(result.percent)) : m.value === null ? "Nenhum dado disponível" : fmt(m.value);
    let size = m.value === null ? 25 : 54;
    while (size > 18 && (g.font = font(size, true), g.measureText(value).width > cardWidth - 48)) size--;
    text(value, x + 24, y + 126, size, m.tone, true);
    const caption = i === 7 ? `Meta: ${result.target === null ? "Sem informação" : formatMissorted(result.target)} · ${status}` : m.value === null ? "Sem informação no relatório" : i === 5 || i === 6 ? "Destaque operacional" : "Período e turnos selecionados";
    text(caption, x + 24, y + 162, 19, "muted");
  });
  text("PONTOS DE ATENÇÃO E DESTAQUES DO TURNO", 48, 651, 27, "text", true);
  text("Tratativas Operacionais · registros do período selecionado", 48, 684, 21, "muted");
  const attentionWidth = (W - 96 - (columns - 1) * 24) / columns;
  input.attention.forEach((s, i) => {
    const x = 48 + i * (attentionWidth + 24), y = 711;
    const tone = s.shift === "AM1" ? "orange" : s.shift === "AM2" ? "blue" : "purple";
    box(x, y, attentionWidth, H - y - 108, "border");
    text(s.shift, x + 24, y + 42, 28, tone, true);
    text(s.entries ? `${fmt(s.entries)} lançamento(s)` : "Sem lançamento no período.", x + 24, y + 78, 22, "muted");
    if (!s.entries) return;
    const statWidth = (attentionWidth - 48) / 2;
    text(fmt(s.av), x + 24, y + 122, 32, "green", true);
    text(fmt(s.oh), x + 24 + statWidth, y + 122, 32, "cyan", true);
    text("Avarias salvas", x + 24, y + 151, 20, "muted");
    text("ON HOLD tratados", x + 24 + statWidth, y + 151, 20, "muted");
    noteLines(s, attentionWidth - 48).forEach((line, j) => text(line, x + 24, y + 193 + j * 31, 23));
  });
  g.strokeStyle = color("orange"); g.lineWidth = 1; g.beginPath(); g.moveTo(48, H - 76); g.lineTo(W - 48, H - 76); g.stroke();
  text("HUB LSP-36", 48, H - 32, 25, "text", true);
  text("Shopee Operations Hub · Embu das Artes", 240, H - 32, 21, "muted");
  const stamp = `Gerado em ${new Date().toLocaleString("pt-BR")}`;
  g.font = font(21); text(stamp, W - 48 - g.measureText(stamp).width, H - 32, 21, "muted");
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível gerar o PNG.")), "image/png"));
}