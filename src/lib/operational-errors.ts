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