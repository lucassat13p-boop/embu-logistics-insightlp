import { normalizeHeader, type FieldKey } from "./modules";
import { buildTable, cellText } from "./parsers";
import type { RecordRow } from "./data";
import { recordMonth, periodRange, type PeriodSelection } from "./period";

export const ERROR_SHIFTS = ["AM1", "AM2", "PM1"] as const;
export type ErrorShift = (typeof ERROR_SHIFTS)[number];
export function errorShift(value: unknown): ErrorShift | null {
  const text = cellText(value)?.toUpperCase().replace(/\s+/g, "");
  return ERROR_SHIFTS.find((shift) => shift === text) ?? null;
}
const aliases: Partial<Record<FieldKey, string[]>> = {
  reason: ["erro", "motivo", "erro/motivo", "erro / motivo", "tipo de erro", "erros", "error", "reason"],
  shift: ["turno", "shift"], order_id: ["br", "pedido", "pedido/br", "pedido / br"],
  collaborator: ["login", "log", "usuario", "colaborador"],
  record_date: ["data", "date", "data do erro", "data da ocorrencia"],
  classification: ["classificacao", "categoria", "operacao", "processo"],
};
function identify(header: string) {
  const normalized = normalizeHeader(header).replace(/\s*\(\d+\)$/, "");
  const markers = [...normalized.matchAll(/\b(am\s*[12]|pm\s*1)\b/g)].map((match) => errorShift(match[0]));
  const shifts = [...new Set(markers.filter((shift): shift is ErrorShift => shift !== null))];
  const base = normalized.replace(/\b(am\s*[12]|pm\s*1)\b/g, "").replace(/[():|]/g, " ").replace(/\s+/g, " ").trim();
  const field = (Object.entries(aliases) as [FieldKey, string[]][]).find(([, names]) => names.includes(base))?.[0];
  return { header, field, shift: shifts.length === 1 ? shifts[0] : null, ambiguous: shifts.length > 1 };
}

/** Expand only explicitly named shift blocks; never associate repeated columns by position. */
export function buildOperationalTable(rows: unknown[][]) {
  const source = buildTable(rows, 1);
  const identified = source.headers.map(identify).filter((item) => item.field);
  if (identified.some((item) => item.ambiguous)) throw new Error("Cabeçalho com múltiplos turnos: identifique um único turno por campo.");
  const groups = [...new Set(identified.map((item) => item.shift).filter((shift): shift is ErrorShift => shift !== null))];
  const blocks: (ErrorShift | null)[] = groups.length ? groups : [null];
  const labels: Partial<Record<FieldKey, string>> = { reason: "Erro/Motivo", shift: "Turno", order_id: "BR", collaborator: "Login", record_date: "Data", classification: "Classificação" };
  const fields = [...new Set(identified.map((item) => item.field).filter((field): field is FieldKey => !!field))];
  if (groups.length && !fields.includes("shift")) fields.push("shift");
  if (!fields.length) throw new Error("Nenhum campo identificado com segurança nos cabeçalhos da linha 2.");
  const headers = fields.map((field) => labels[field] ?? field);
  const body: ReturnType<typeof buildTable>["body"] = [];
  for (const row of source.body) {
    if (row.empty) continue;
    for (const block of blocks) {
      const local = identified.filter((item) => item.shift === block);
      if (block && !local.some((item) => cellText(row.values[item.header]))) continue;
      const values: Record<string, unknown> = { __original: row.values, __block: block };
      for (const field of fields) {
        let matches = local.filter((item) => item.field === field);
        if (!matches.length && block && (field === "record_date" || field === "classification")) matches = identified.filter((item) => !item.shift && item.field === field);
        if (matches.length > 1) throw new Error(`Campo ${labels[field]} repetido sem identificação segura de turno. Identifique o turno no cabeçalho de cada bloco.`);
        const match = matches[0];
        values[labels[field] ?? field] = match ? row.values[match.header] : null;
      }
      if (block) {
        const actual = cellText(values.Turno);
        if (actual && errorShift(actual) !== block) throw new Error(`Turno conflitante com o cabeçalho na linha ${row.rowNumber}.`);
        if (!actual) values.Turno = block;
      }
      if (!headers.some((header) => cellText(values[header]))) continue;
      body.push({ rowNumber: row.rowNumber, values, empty: false });
    }
  }
  return { headers, body };
}
/** Backlog é identificado apenas por marcador explícito "backlog" nos valores reais do registro. */
export function isBacklog(row: RecordRow): boolean {
  const text = normalizeHeader([row.classification, row.reason].filter(Boolean).join(" "));
  return /\bbacklog\b/.test(text);
}
export function filterBacklog(rows: RecordRow[], includeBacklog: boolean) {
  return includeBacklog ? rows : rows.filter((row) => !isBacklog(row));
}
export function filterErrorShifts(rows: RecordRow[], shifts: ErrorShift[]) {
  return shifts.length ? rows.filter((row) => { const shift = errorShift(row.shift); return shift !== null && shifts.includes(shift); }) : rows;
}
export function errorCategory(row: RecordRow): string | null {
  const text = normalizeHeader(row.classification ?? row.reason ?? "");
  const categories = ["ETIQUETAGEM", "SORTING"].filter((name) => new RegExp(`\\b${name.toLowerCase()}\\b`).test(text));
  return categories.length === 1 ? categories[0] ?? null : null;
}
export function countErrorCategories(rows: RecordRow[]) {
  const counts = new Map<string, number>();
  rows.forEach((row) => { const category = errorCategory(row); if (category) counts.set(category, (counts.get(category) ?? 0) + 1); });
  return [...counts].map(([name, value]) => ({ name, value }));
}
export function definedErrorPeriod(period: PeriodSelection) {
  if (period.kind === "month") return period.months.length === 1 && !!recordMonth(`${period.months[0]}-01`);
  const range = periodRange(period);
  return !!range && !!recordMonth(range.start) && !!recordMonth(range.end) && range.start <= range.end;
}
type Sheetish = { name: string; rows: unknown[][] };
type Body = ReturnType<typeof buildTable>["body"];
const OP_LABELS: Partial<Record<FieldKey, string>> = { order_id: "BR", collaborator: "Login", reason: "Erro/Motivo", shift: "Turno", record_date: "Data", classification: "Classificação" };
function sheetShift(name: string): ErrorShift | null {
  const found = [...new Set([...normalizeHeader(name).matchAll(/\b(am\s*[12]|pm\s*1)\b/g)].map((m) => errorShift(m[0])).filter(Boolean))];
  return found.length === 1 ? (found[0] as ErrorShift) : null;
}
function markersIn(value: unknown): ErrorShift[] {
  const text = cellText(value); if (!text) return [];
  return [...new Set([...normalizeHeader(text).matchAll(/\b(am\s*[12]|pm\s*1)\b/g)].map((m) => errorShift(m[0])).filter((s): s is ErrorShift => !!s))];
}
const colName = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** Reads side-by-side record blocks (BR/Login/Erro/Turno) from one sheet; summaries without BR are skipped. */
function readBlocks(sheet: Sheetish, defaultShift: ErrorShift | null, fields: Set<FieldKey>, body: Body) {
  const rows = sheet.rows;
  let headerIdx = -1, best = 0;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const ids = (rows[i] ?? []).map((c) => (cellText(c) ? identify(String(c)) : null));
    const score = ids.filter((x) => x?.field).length;
    if (ids.some((x) => x?.field === "order_id") && score > best) { best = score; headerIdx = i; }
  }
  if (headerIdx < 0) return 0;
  const header = rows[headerIdx] ?? [];
  // contiguous non-empty header ranges = blocks
  const blocks: { start: number; end: number }[] = [];
  header.forEach((c, j) => { if (!cellText(c)) return; const last = blocks[blocks.length - 1]; if (last && last.end === j - 1) last.end = j; else blocks.push({ start: j, end: j }); });
  let count = 0;
  for (const b of blocks) {
    const cols: { j: number; field: FieldKey }[] = [];
    let headerShift: ErrorShift | null = null;
    for (let j = b.start; j <= b.end; j++) {
      const id = identify(String(header[j]));
      if (id.ambiguous) throw new Error(`Aba "${sheet.name}", coluna ${colName(j)}, linha ${headerIdx + 1}: cabeçalho com múltiplos turnos.`);
      if (id.shift) headerShift = headerShift && headerShift !== id.shift ? (() => { throw new Error(`Aba "${sheet.name}", coluna ${colName(j)}, linha ${headerIdx + 1}: turnos diferentes no mesmo bloco.`); })() : id.shift;
      if (!id.field) continue;
      if (cols.some((c) => c.field === id.field)) throw new Error(`Aba "${sheet.name}", coluna ${colName(j)}, linha ${headerIdx + 1}: campo "${OP_LABELS[id.field] ?? id.field}" repetido dentro do mesmo bloco.`);
      cols.push({ j, field: id.field });
    }
    if (!cols.some((c) => c.field === "order_id")) continue; // ranking/resumo/totais
    // superior header rows identify the block's shift
    let aboveShift: ErrorShift | null = null;
    for (let i = headerIdx - 1; i >= 0 && !aboveShift; i--) {
      const r = rows[i] ?? [];
      const found = new Set<ErrorShift>();
      for (let j = b.start; j <= b.end; j++) markersIn(r[j]).forEach((s) => found.add(s));
      if (found.size > 1) throw new Error(`Aba "${sheet.name}", linha ${i + 1}: mais de um turno identificado acima do mesmo bloco (colunas ${colName(b.start)}–${colName(b.end)}).`);
      if (found.size === 1) aboveShift = [...found][0];
    }
    const blockShift = headerShift ?? aboveShift ?? defaultShift;
    cols.forEach((c) => fields.add(c.field));
    if (blockShift) fields.add("shift");
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const cells = cols.map((c) => ({ ...c, v: r[c.j] ?? null }));
      if (cells.every((c) => !cellText(c.v))) break; // fim do bloco de registros
      const first = cellText(r[b.start]) ?? "";
      if (/^(total|soma|ranking|resumo)\b/i.test(normalizeHeader(first))) break;
      const values: Record<string, unknown> = { __original: Object.fromEntries(cols.map((c) => [String(header[c.j]).trim(), r[c.j] ?? null])), __sheet: sheet.name, __block: blockShift };
      for (const c of cells) values[OP_LABELS[c.field] ?? c.field] = c.v;
      if (blockShift) {
        const actual = cellText(values.Turno);
        if (actual && errorShift(actual) !== blockShift) throw new Error(`Aba "${sheet.name}", coluna ${colName(cols.find((c) => c.field === "shift")!.j)}, linha ${i + 1}: turno "${actual}" conflita com o turno ${blockShift} do bloco.`);
        if (!actual) values.Turno = blockShift;
      }
      body.push({ rowNumber: i + 1, values, empty: false });
      count++;
    }
  }
  return count;
}

const FIXED_BLOCKS: { shift: ErrorShift; start: number; letters: string }[] = [
  { shift: "AM1", start: 0, letters: "A–D" }, { shift: "AM2", start: 4, letters: "E–H" }, { shift: "PM1", start: 8, letters: "I–L" },
];
const normSheet = (n: string) => normalizeHeader(n).replace(/\s+/g, "");

/** Fixed TABELAS layout (XLSX tab or CSV export): blocks A–D/E–H/I–L = AM1/AM2/PM1; row 1 labels, row 2 headers, data from row 3. Responsible shift comes only from the block. */
export function buildOperationalImport(sheets: Sheetish[], format: string) {
  let sheetIdx = 0;
  if (format !== "csv") {
    sheetIdx = sheets.findIndex((s) => normSheet(s.name) === "tabelas");
    if (sheetIdx < 0) throw new Error(`XLSX: aba "TABELAS" não encontrada. Abas disponíveis: ${sheets.map((s) => s.name).join(", ")}.`);
  }
  const rows = sheets[sheetIdx]?.rows ?? [];
  const body: Body = [];
  for (const b of FIXED_BLOCKS) {
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const br = cellText(r[b.start]);
      if (!br) continue;
      const original = r[b.start + 3] ?? null;
      body.push({ rowNumber: i + 1, empty: false, values: {
        BR: r[b.start] ?? null, Login: r[b.start + 1] ?? null, "Erro/Motivo": r[b.start + 2] ?? null,
        "Turno responsável": b.shift, "Turno original": original, "Bloco de origem": `${b.shift} (${b.letters})`, "Linha de origem": i + 1,
      } });
    }
  }
  if (!body.length) throw new Error(`${format === "csv" ? "CSV" : "XLSX (aba TABELAS)"}: nenhuma ocorrência com BR preenchido nas colunas A, E ou I a partir da linha 3.`);
  return { headers: ["BR", "Login", "Erro/Motivo", "Turno responsável", "Turno original", "Bloco de origem", "Linha de origem"], body, sheetIdx };
}
