import { shiftLabel } from "@/lib/shifts";

export type ReportTone = "orange" | "blue" | "red" | "amber" | "purple" | "green" | "cyan" | "muted";
export type ModuleReportDatum = { name: string; value: number };
export type ModuleReportMetric = { label: string; value: number | string | null; tone: ReportTone };
export type ModuleReportDonut = { title: string; data: ModuleReportDatum[]; total: number; categories: string[]; includeMissing?: boolean };
export type ModuleReportGroup = { title: string; data: ModuleReportDatum[] };
export type ModuleReportInput = {
  kind: "avaria" | "floating";
  hub: string;
  title: string;
  period: string;
  shifts: string;
  details?: string[];
  metrics: ModuleReportMetric[];
  donuts: ModuleReportDonut[];
  evolution: { title: string; data: { label: string; value: number }[] };
  bars?: ModuleReportGroup;
  rankings: ModuleReportGroup[];
  collaborators: { title: string; mode: "general" | "shift"; groups: ModuleReportGroup[] };
};

const fmt = (value: number) => value.toLocaleString("pt-BR");
const percent = (value: number, total: number) => `${(value / total * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Independent, themed canvas reports composed only from the active module's filtered readers. */
export async function createModuleReportPng(input: ModuleReportInput): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  const roles = ["background", "surface", "border", "text", "muted", "orange", "blue", "red", "amber", "purple", "green", "cyan", "on-accent"];
  const palette = new Map(roles.map((role) => [role, css.getPropertyValue(`--report-${role}`).trim()]));
  const pieColors = Array.from({ length: 10 }, (_, index) => css.getPropertyValue(`--pie-${index + 1}`).trim());
  const missingColor = css.getPropertyValue("--pie-missing").trim();
  const color = (role: string) => palette.get(role) || palette.get("text") || "";
  await Promise.all([document.fonts.load('700 40px "Archivo"'), document.fonts.load('400 24px "IBM Plex Sans"')]);
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Não foi possível gerar a imagem.");
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const pg = probe.getContext("2d");
  if (!pg) throw new Error("Não foi possível preparar as cores da imagem.");
  const rgba = (cssColor: string, alpha: number) => {
    pg.clearRect(0, 0, 1, 1); pg.fillStyle = cssColor; pg.fillRect(0, 0, 1, 1);
    const d = pg.getImageData(0, 0, 1, 1).data;
    return `rgba(${d[0]},${d[1]},${d[2]},${alpha})`;
  };
  const font = (size: number, bold = false) => `${bold ? 700 : 400} ${size}px "${bold ? "Archivo" : "IBM Plex Sans"}", sans-serif`;
  const measure = (value: string, size: number, bold = false) => { g.font = font(size, bold); return g.measureText(shiftLabel(value)).width; };
  const text = (value: string, x: number, y: number, size: number, role = "text", bold = false) => {
    g.font = font(size, bold); g.fillStyle = color(role); g.fillText(shiftLabel(value), x, y);
  };
  const textR = (value: string, x: number, y: number, size: number, role = "text", bold = false) => text(value, x - measure(value, size, bold), y, size, role, bold);
  const textC = (value: string, x: number, y: number, size: number, role = "text", bold = false) => text(value, x - measure(value, size, bold) / 2, y, size, role, bold);
  const wrap = (value: string, width: number, size: number, bold = false) => {
    g.font = font(size, bold);
    const lines: string[] = [];
    for (const paragraph of shiftLabel(value).split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (g.measureText(candidate).width <= width) { line = candidate; continue; }
        if (line) { lines.push(line); line = ""; }
        for (const char of word) {
          if (line && g.measureText(line + char).width > width) { lines.push(line); line = ""; }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines.length ? lines : [""];
  };
  const box = (x: number, y: number, w: number, h: number, border: ReportTone | "border" = "border", tint = 0, radius = 12) => {
    g.beginPath(); g.roundRect(x, y, w, h, radius); g.fillStyle = color("surface"); g.fill();
    if (tint) { g.fillStyle = rgba(color(border), tint); g.fill(); }
    g.strokeStyle = rgba(color(border), 0.85); g.lineWidth = 2; g.stroke();
  };
  const icon = (index: number, x: number, y: number, tone: string, size = 36) => {
    g.save(); g.translate(x, y); g.scale(size / 40, size / 40);
    g.strokeStyle = color(tone); g.lineWidth = 2.5; g.lineCap = "round"; g.lineJoin = "round";
    const path = (points: number[][]) => { g.beginPath(); points.forEach(([px, py], i) => i ? g.lineTo(px!, py!) : g.moveTo(px!, py!)); g.stroke(); };
    const circle = (cx: number, cy: number, r: number) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); };
    if (index === 0) { path([[4, 11], [20, 3], [36, 11], [36, 29], [20, 37], [4, 29], [4, 11], [20, 19], [36, 11]]); path([[20, 19], [20, 37]]); }
    else if (index === 1) { path([[4, 32], [14, 20], [23, 25], [36, 8]]); path([[27, 8], [36, 8], [36, 17]]); }
    else if (index === 2) { circle(20, 20, 16); path([[20, 11], [20, 21], [28, 25]]); }
    else if (index === 3) { circle(20, 15, 8); path([[7, 36], [10, 27], [20, 23], [30, 27], [33, 36]]); }
    else if (index === 4) { g.strokeRect(5, 5, 30, 30); path([[11, 27], [11, 19], [18, 19], [18, 27]]); path([[23, 27], [23, 12], [30, 12], [30, 27]]); }
    else if (index === 5) { g.strokeRect(8, 6, 24, 32); g.strokeRect(14, 3, 12, 6); path([[14, 18], [26, 18]]); path([[14, 25], [26, 25]]); }
    else if (index === 6) { circle(20, 20, 16); path([[12, 20], [18, 26], [29, 14]]); }
    else { g.strokeRect(4, 8, 32, 28); path([[4, 16], [36, 16]]); path([[12, 4], [12, 10]]); path([[28, 4], [28, 10]]); }
    g.restore();
  };
  const panel = (x: number, y: number, w: number, h: number, title: string, tone: ReportTone = "orange") => {
    box(x, y, w, h, tone);
    g.save(); g.beginPath(); g.roundRect(x, y, w, 64, [12, 12, 0, 0]); g.fillStyle = rgba(color(tone), 0.12); g.fill(); g.restore();
    text(title, x + 24, y + 41, 25, "text", true);
  };
  const noData = (x: number, y: number, w: number) => {
    box(x + 20, y + 84, w - 40, 64, "border");
    text("Nenhum dado disponível", x + 40, y + 124, 21, "muted");
  };
  const rowHeight = (name: string, width: number) => Math.max(58, wrap(name, width, 19).length * 25 + 34);
  const groupHeight = (group: ModuleReportGroup, width: number, limit: number) => 84 + Math.max(64, group.data.slice(0, limit).reduce((sum, item) => sum + rowHeight(item.name, width - 150), 0)) + 20;
  const drawGroup = (group: ModuleReportGroup, x: number, y: number, w: number, h: number, limit: number, tone: ReportTone = "orange") => {
    panel(x, y, w, h, group.title, tone);
    const items = group.data.slice(0, limit);
    if (!items.length) { noData(x, y, w); return; }
    const max = Math.max(...items.map((item) => item.value), 1);
    let ry = y + 88;
    items.forEach((item, index) => {
      const rh = rowHeight(item.name, w - 150);
      g.beginPath(); g.arc(x + 38, ry + 13, 16, 0, Math.PI * 2); g.fillStyle = rgba(color(tone), index === 0 ? 0.28 : 0.12); g.fill();
      textC(String(index + 1), x + 38, ry + 20, 17, tone, true);
      const lines = wrap(item.name, w - 150, 19);
      lines.forEach((line, lineIndex) => text(line, x + 68, ry + 20 + lineIndex * 25, 19));
      textR(fmt(item.value), x + w - 24, ry + 20, 21, "text", true);
      const by = ry + Math.max(34, lines.length * 25 + 8);
      g.beginPath(); g.roundRect(x + 68, by, w - 92, 8, 4); g.fillStyle = rgba(color("muted"), 0.25); g.fill();
      g.beginPath(); g.roundRect(x + 68, by, Math.max(4, (w - 92) * item.value / max), 8, 4); g.fillStyle = color(tone); g.fill();
      ry += rh;
    });
  };
  const donutSlices = (donut: ModuleReportDonut) => {
    const known = donut.data.reduce((sum, item) => sum + item.value, 0);
    return [...donut.data, ...(donut.includeMissing !== false && known < donut.total ? [{ name: "Sem informação", value: donut.total - known }] : [])];
  };
  const donutColor = (donut: ModuleReportDonut, name: string) => {
    if (name === "Sem informação") return missingColor || color("muted");
    const extras = donut.data.map((item) => item.name).filter((name) => !donut.categories.includes(name)).sort();
    const category = donut.categories.indexOf(name);
    const index = category < 0 ? donut.categories.length + extras.indexOf(name) : category;
    return pieColors[index % pieColors.length] || color("orange");
  };
  const donutHeight = (donut: ModuleReportDonut, width: number) => {
    const legend = donutSlices(donut).reduce((sum, item) => sum + Math.max(58, wrap(item.name, width - 510, 18).length * 23 + 35), 0);
    return Math.max(390, 100 + legend);
  };
  const drawDonut = (donut: ModuleReportDonut, x: number, y: number, w: number, h: number) => {
    panel(x, y, w, h, donut.title);
    const slices = donutSlices(donut);
    const total = slices.reduce((sum, item) => sum + item.value, 0);
    if (!slices.length || !total) { noData(x, y, w); return; }
    const cx = x + 190, cy = y + h / 2 + 25, outer = 128, inner = 82;
    let angle = -Math.PI / 2;
    for (const item of slices) {
      const next = angle + item.value / total * Math.PI * 2;
      g.beginPath(); g.arc(cx, cy, outer, angle, next); g.arc(cx, cy, inner, next, angle, true); g.closePath();
      g.fillStyle = donutColor(donut, item.name); g.fill(); g.strokeStyle = color("surface"); g.lineWidth = 3; g.stroke(); angle = next;
    }
    textC(fmt(total), cx, cy + 5, 36, "text", true); textC("Total", cx, cy + 34, 17, "muted");
    let ly = y + 94;
    for (const item of slices) {
      g.beginPath(); g.roundRect(x + 370, ly - 13, 14, 14, 3); g.fillStyle = donutColor(donut, item.name); g.fill();
      const lines = wrap(item.name, w - 510, 18);
      lines.forEach((line, index) => text(line, x + 396, ly + index * 23, 18));
      textR(fmt(item.value), x + w - 24, ly, 19, "text", true);
      textR(percent(item.value, total), x + w - 24, ly + 24, 16, "muted");
      ly += Math.max(58, lines.length * 23 + 35);
    }
  };
  const drawEvolution = (x: number, y: number, w: number, h: number) => {
    panel(x, y, w, h, input.evolution.title, "blue");
    const data = input.evolution.data;
    if (!data.length) { noData(x, y, w); return; }
    const left = x + 80, right = x + w - 45, top = y + 100, bottom = y + h - 70;
    const max = Math.max(...data.map((item) => item.value), 1);
    g.strokeStyle = rgba(color("border"), 0.75); g.lineWidth = 1;
    for (let step = 0; step <= 4; step++) {
      const gy = top + (bottom - top) * step / 4;
      g.beginPath(); g.moveTo(left, gy); g.lineTo(right, gy); g.stroke();
      textR(fmt(Math.round(max * (4 - step) / 4)), left - 14, gy + 6, 15, "muted");
    }
    const point = (index: number) => ({ x: data.length === 1 ? (left + right) / 2 : left + (right - left) * index / (data.length - 1), y: bottom - (bottom - top) * data[index]!.value / max });
    g.beginPath(); data.forEach((_, index) => { const p = point(index); if (index) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
    g.strokeStyle = color("orange"); g.lineWidth = 4; g.stroke();
    data.forEach((item, index) => {
      const p = point(index); g.beginPath(); g.arc(p.x, p.y, 6, 0, Math.PI * 2); g.fillStyle = color("orange"); g.fill(); g.strokeStyle = color("surface"); g.lineWidth = 3; g.stroke();
      if (data.length <= 16 || index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 14) === 0) textC(item.label, p.x, bottom + 32, 15, "muted");
      if (data.length <= 12) textC(fmt(item.value), p.x, p.y - 16, 15, "text", true);
    });
  };
  const drawBars = (group: ModuleReportGroup, x: number, y: number, w: number, h: number) => {
    panel(x, y, w, h, group.title, "purple");
    if (!group.data.length) { noData(x, y, w); return; }
    const max = Math.max(...group.data.map((item) => item.value), 1);
    let by = y + 94;
    group.data.forEach((item) => {
      const lines = wrap(item.name, 390, 18);
      lines.forEach((line, index) => text(line, x + 24, by + index * 23, 18));
      const bx = x + 440, bw = w - 540;
      g.beginPath(); g.roundRect(bx, by - 15, bw, 22, 6); g.fillStyle = rgba(color("muted"), 0.22); g.fill();
      g.beginPath(); g.roundRect(bx, by - 15, Math.max(5, bw * item.value / max), 22, 6); g.fillStyle = color("purple"); g.fill();
      textR(fmt(item.value), x + w - 24, by + 3, 19, "text", true);
      by += Math.max(54, lines.length * 23 + 25);
    });
  };

  const W = 1920, M = 40, G = 24, contentW = W - M * 2;
  const halfW = (contentW - G) / 2;
  const metricH = 142;
  const metricRows = Math.ceil(input.metrics.length / 6);
  const donutHs = input.donuts.map((donut) => donutHeight(donut, halfW));
  const donutH = Math.max(...donutHs, 390);
  const evolutionH = 360;
  const barsH = input.bars ? Math.max(210, 104 + input.bars.data.reduce((sum, item) => sum + Math.max(54, wrap(item.name, 390, 18).length * 23 + 25), 0)) : 0;
  const rankingLimits = input.rankings.map(() => 8);
  const rankingHs = input.rankings.map((group) => groupHeight(group, halfW, 8));
  const rankingsH = input.rankings.length ? Math.max(...rankingHs) : 0;
  const collabLimit = input.collaborators.mode === "general" ? (input.kind === "floating" ? 10 : 8) : 5;
  const collabCols = input.collaborators.mode === "general" ? 1 : Math.max(1, input.collaborators.groups.length);
  const collabW = (contentW - G * (collabCols - 1)) / collabCols;
  const collabGroupHs = input.collaborators.groups.map((group) => groupHeight(group, collabW, collabLimit));
  const collabH = 84 + (input.collaborators.mode === "shift" ? 24 : 0) + Math.max(80, ...collabGroupHs.map((height) => height - 84)) + 20;
  const reportDetails = [`Período: ${input.period}`, `Turno: ${input.shifts}`, ...(input.details ?? [])];
  const reportDetailLines = reportDetails.flatMap((line) => wrap(line, 400, 18));
  const reportPeriodH = 28 + reportDetailLines.length * 24;
  const headerH = Math.max(146, 52 + Math.max(76, reportPeriodH));
  let cursor = headerH + metricRows * (metricH + 16) + 8;
  const donutY = cursor; cursor += donutH + G;
  const evolutionY = cursor; cursor += evolutionH + G;
  const barsY = cursor; if (input.bars) cursor += barsH + G;
  const rankingsY = cursor; if (input.rankings.length) cursor += rankingsH + G;
  const collabY = cursor; cursor += collabH + 28;
  const H = cursor + 74;

  canvas.width = W; canvas.height = H;
  g.fillStyle = color("background"); g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W - 80, 0, 0, W - 80, 0, 620);
  glow.addColorStop(0, rgba(color("orange"), 0.14)); glow.addColorStop(1, rgba(color("orange"), 0));
  g.fillStyle = glow; g.fillRect(W - 700, 0, 700, 620);

  g.beginPath(); g.roundRect(M, 28, 72, 72, 17); g.fillStyle = color("orange"); g.fill();
  textC("S", M + 36, 78, 43, "on-accent", true);
  text("Shopee", M + 94, 78, 32, "text", true);
  const dividerX = M + 94 + measure("Shopee", 32, true) + 24;
  g.strokeStyle = color("border"); g.lineWidth = 2; g.beginPath(); g.moveTo(dividerX, 43); g.lineTo(dividerX, 91); g.stroke();
  text(`Operations Hub – ${input.hub}`, dividerX + 24, 66, 36, "text", true);
  text(input.title, dividerX + 24, 99, 23, "muted");
  const details = reportDetails;
  const periodW = 510, periodH = reportPeriodH;
  box(W - M - periodW, 28, periodW, Math.max(76, periodH), "orange", 0.06);
  icon(7, W - M - periodW + 18, 50, "orange", 30);
  let py = 58;
  details.forEach((detail, detailIndex) => {
    wrap(detail, 400, 18).forEach((line) => {
      const separator = line.indexOf(":");
      if (separator > 0) {
        text(`${line.slice(0, separator + 1)} `, W - M - periodW + 60, py, 18, "text");
        text(line.slice(separator + 1).trim(), W - M - periodW + 60 + measure(`${line.slice(0, separator + 1)} `, 18), py, 18, "orange", true);
      } else text(line, W - M - periodW + 60, py, 18, detailIndex === 0 ? "text" : "orange", detailIndex > 0);
      py += 24;
    });
  });

  const metricW = (contentW - (Math.min(6, input.metrics.length) - 1) * 16) / Math.min(6, input.metrics.length);
  input.metrics.forEach((metric, index) => {
    const columns = Math.min(6, input.metrics.length);
    const x = M + (index % columns) * (metricW + 16), y = headerH + Math.floor(index / columns) * (metricH + 16);
    box(x, y, metricW, metricH, metric.tone, 0.07);
    icon(index % 7, x + 18, y + 18, metric.tone, 32);
    wrap(metric.label, metricW - 76, 16, true).slice(0, 2).forEach((line, lineIndex) => text(line, x + 60, y + 35 + lineIndex * 20, 16, "text", true));
    const value = metric.value === null ? "Nenhum dado disponível" : typeof metric.value === "number" ? fmt(metric.value) : metric.value;
    let size = metric.value === null ? 20 : 42;
    while (size > 16 && measure(value, size, true) > metricW - 36) size--;
    text(value, x + 18, y + 116, size, metric.tone, true);
  });

  input.donuts.forEach((donut, index) => drawDonut(donut, M + index * (halfW + G), donutY, input.donuts.length === 1 ? contentW : halfW, donutH));
  drawEvolution(M, evolutionY, contentW, evolutionH);
  if (input.bars) drawBars(input.bars, M, barsY, contentW, barsH);
  input.rankings.forEach((group, index) => drawGroup(group, M + index * (halfW + G), rankingsY, input.rankings.length === 1 ? contentW : halfW, rankingsH, rankingLimits[index] ?? 8, index === 0 ? "orange" : "red"));

  panel(M, collabY, contentW, collabH, input.collaborators.title, "green");
  input.collaborators.groups.forEach((group, index) => {
    const x = M + index * (collabW + G);
    if (input.collaborators.mode === "shift") text(group.title, x + 24, collabY + 94, 21, "green", true);
    const innerY = collabY + (input.collaborators.mode === "shift" ? 108 : 72);
    const items = group.data.slice(0, collabLimit);
    if (!items.length) { text("Nenhum dado disponível", x + 24, innerY + 42, 19, "muted"); return; }
    const max = Math.max(...items.map((item) => item.value), 1);
    let ry = innerY + 20;
    items.forEach((item, itemIndex) => {
      const rh = rowHeight(item.name, collabW - 150);
      g.beginPath(); g.arc(x + 38, ry + 10, 16, 0, Math.PI * 2); g.fillStyle = rgba(color("green"), itemIndex === 0 ? 0.28 : 0.12); g.fill();
      textC(String(itemIndex + 1), x + 38, ry + 17, 17, "green", true);
      const lines = wrap(item.name, collabW - 150, 19);
      lines.forEach((line, lineIndex) => text(line, x + 68, ry + 17 + lineIndex * 25, 19));
      textR(fmt(item.value), x + collabW - 24, ry + 17, 21, "text", true);
      const by = ry + Math.max(31, lines.length * 25 + 5);
      g.beginPath(); g.roundRect(x + 68, by, collabW - 92, 8, 4); g.fillStyle = rgba(color("muted"), 0.25); g.fill();
      g.beginPath(); g.roundRect(x + 68, by, Math.max(4, (collabW - 92) * item.value / max), 8, 4); g.fillStyle = color("green"); g.fill();
      ry += rh;
    });
  });

  g.strokeStyle = color("orange"); g.lineWidth = 2; g.beginPath(); g.moveTo(M, H - 62); g.lineTo(W - M, H - 62); g.stroke();
  text(input.hub, M, H - 25, 21, "text", true);
  text("Shopee Operations Hub – Embu das Artes", M + measure(input.hub, 21, true) + 20, H - 25, 18, "muted");
  textR(`Gerado em ${new Date().toLocaleString("pt-BR")}`, W - M, H - 25, 18, "muted");
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar o PNG.")), "image/png"));
}

export function downloadModuleReport(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
