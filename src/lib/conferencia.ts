import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RecordRow } from "./data";
import { buildTable, type Sheet } from "./parsers";

export const AUDIT_HEADERS = ["AT/TO", "Corridor/Cage", "Total Initial Orders Inside AT/TO", "Total Final Orders Inside AT/TO", "Total Scanned Orders", "Missorted Orders", "Missing Orders", "Validation Start Time", "Validation End Time", "Validation Operator", "Revalidation Operator", "Revalidated Count", "AT/TO Validation Status", "Remark"];
const text = (v: unknown) => v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim();
const count = (v: unknown) => { const s = text(v); return s !== null && /^\d+$/.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : null; };
export function auditTime(value: unknown) {
  const raw = text(value);
  const match = raw?.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, h, min, s] = match;
  const ms = Date.UTC(+y, +m - 1, +d, +h, +min, +s);
  const iso = new Date(ms).toISOString().slice(0, 19);
  if (iso !== `${y}-${m}-${d}T${h}:${min}:${s}`) return null;
  return { iso, ms, date: iso.slice(0, 10), seconds: +h * 3600 + +min * 60 + +s };
}
export function auditShift(value: unknown) {
  const time = auditTime(value);
  if (!time) return { shift: "Fora de turno", date: null };
  const n = time.seconds;
  if (n >= 21 * 3600) return { shift: "AM1", date: new Date(time.ms + 86400000).toISOString().slice(0, 10) };
  if (n <= 4 * 3600 + 30 * 60) return { shift: "AM1", date: time.date };
  if (n >= 5 * 3600 && n <= 12 * 3600) return { shift: "AM2", date: time.date };
  if (n >= 12 * 3600 + 5 * 60 && n <= 20 * 3600) return { shift: "PM1", date: time.date };
  return { shift: "Fora de turno", date: time.date };
}
export function auditOperator(value: unknown) {
  const raw = text(value);
  const match = raw?.match(/^\[([^\]]+)\]\s*(.*)$/);
  const login = match?.[1]?.trim() || null;
  const name = match ? match[2]?.trim() || null : raw;
  return { login, name, key: (login || name)?.toLocaleLowerCase("pt-BR") ?? null, label: name || login || "Sem informação" };
}
export function prepareAudit(sheet: Sheet) {
  const headerIndex = sheet.rows.findIndex((r) => r.some((v) => String(v ?? "").replace(/^\uFEFF/, "").trim() === "AT/TO"));
  if (headerIndex < 0) throw new Error("Cabeçalho AT/TO não encontrado.");
  const clean = sheet.rows.map((row, i) => i === headerIndex ? row.map((v) => String(v ?? "").replace(/^\uFEFF/, "").trim()) : row);
  const table = buildTable(clean, headerIndex);
  const missing = AUDIT_HEADERS.filter((h) => !table.headers.includes(h));
  if (missing.length) throw new Error(`Colunas ausentes: ${missing.join(", ")}.`);
  const unique = new Map<string, ReturnType<typeof convert>>();
  let ignored = 0;
  const warnings: string[] = [];
  function convert(raw: Record<string, unknown>, rowNumber: number) {
    const route = text(raw["AT/TO"]);
    const start = auditTime(raw["Validation Start Time"]);
    const operational = auditShift(raw["Validation Start Time"]);
    const operator = auditOperator(raw["Validation Operator"]);
    const key = JSON.stringify([route, start?.iso ?? text(raw["Validation Start Time"])]);
    return { route, row_number: rowNumber, record_date: operational.date, record_date_raw: text(raw["Validation Start Time"]), shift: operational.shift, location: text(raw["Corridor/Cage"]), collaborator: operator.label === "Sem informação" ? null : operator.label, create_time: text(raw["Validation Start Time"]), resolve_time: text(raw["Validation End Time"]), status: text(raw["AT/TO Validation Status"]), dedupe_key: `audit:${key}`, extra: { login: operator.login, name: operator.name, scanned: count(raw["Total Scanned Orders"]), missing: count(raw["Missing Orders"]), missorted: count(raw["Missorted Orders"]), initial: count(raw["Total Initial Orders Inside AT/TO"]), final: count(raw["Total Final Orders Inside AT/TO"]), revalidation_operator: text(raw["Revalidation Operator"]), revalidated: count(raw["Revalidated Count"]), remark: text(raw.Remark) }, raw };
  }
  for (const row of table.body) {
    if (row.empty) { ignored++; continue; }
    const converted = convert(row.values, row.rowNumber);
    if (!converted.route) { ignored++; warnings.push(`Linha ${row.rowNumber}: AT/TO ausente.`); continue; }
    if (!converted.record_date) warnings.push(`Linha ${row.rowNumber}: início inválido; sem data operacional e sem duração.`);
    if (unique.has(converted.dedupe_key)) ignored++;
    unique.set(converted.dedupe_key, converted);
  }
  return { rows: [...unique.values()], ignored, warnings, headers: table.headers };
}
export type AuditPrepared = ReturnType<typeof prepareAudit>;
export type AuditRow = ReturnType<typeof auditFromRecord>;
export function auditFromRecord(row: RecordRow) {
  const raw = row.raw && typeof row.raw === "object" && !Array.isArray(row.raw) ? row.raw : {};
  const operator = auditOperator(raw["Validation Operator"]);
  const start = auditTime(row.create_time), end = auditTime(row.resolve_time);
  return { id: row.id, route: row.route ?? "Sem informação", date: row.record_date, record_date: row.record_date, shift: row.shift ?? "Fora de turno", location: row.location ?? "Sem informação", operator, start: row.create_time, end: row.resolve_time, duration: start && end && end.ms >= start.ms ? (end.ms - start.ms) / 1000 : null, scanned: count(raw["Total Scanned Orders"]), missing: count(raw["Missing Orders"]), missorted: count(raw["Missorted Orders"]), status: row.status ?? "Sem informação" };
}
export const auditQuery = () => queryOptions({ queryKey: ["records", "conferencia"], staleTime: 30_000, queryFn: async () => {
  const rows: RecordRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("records").select("*").eq("module", "conferencia").order("record_date", { ascending: false, nullsFirst: false }).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
} });
export const meanDuration = (rows: AuditRow[]) => { const values = rows.flatMap((r) => r.duration === null ? [] : [r.duration]); return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; };
export const durationLabel = (n: number | null) => { if (n === null) return "Sem informação"; const seconds = Math.round(n); return `${Math.floor(seconds / 60)}min ${String(seconds % 60).padStart(2, "0")}s`; };
export function auditRanking(rows: AuditRow[], speed = false) {
  const groups = new Map<string, AuditRow[]>();
  for (const row of rows) { if (!row.operator.key) continue; const group = groups.get(row.operator.key) ?? []; group.push(row); groups.set(row.operator.key, group); }
  return [...groups].map(([key, group]) => ({ key, name: group[0]?.operator.label ?? "Sem informação", routes: new Set(group.map((r) => r.route)).size, average: meanDuration(group) }))
    .filter((r) => !speed || (r.routes >= 3 && r.average !== null))
    .sort((a, b) => (speed ? (a.average ?? Infinity) - (b.average ?? Infinity) : b.routes - a.routes) || a.name.localeCompare(b.name, "pt-BR")).slice(0, 5);
}