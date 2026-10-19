import type { RecordRow } from "./data";
import type { TreatmentRow } from "./treatments";
import { normalizedShift, normalizedAvariaType } from "./avaria-analysis";
import { normalizeOnHoldShift } from "./on-hold-analysis";
import { parseRetidosTime, retidosShift, summarizedRetidosReason } from "./retidos-analysis";
import { errorShift, errorCategory, isBacklog } from "./operational-errors";
import { fullFinalStatus } from "./full-import";
import { currentSystemDate, weekRange } from "./period";

export const DASH_SHIFTS = ["AM1", "AM2", "PM1"] as const;
export type DashShift = (typeof DASH_SHIFTS)[number];
export type Range = { start: string; end: string };
export type Preset = "today" | "yesterday" | "7d" | "30d" | "day" | "week" | "month" | "custom";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);

export function presetRange(p: Preset, v: { date: string; week: string; month: string; start: string; end: string }, today = currentSystemDate()): Range | null {
  if (!today) return null;
  if (p === "today") return { start: today, end: today };
  if (p === "yesterday") { const y = addDays(today, -1); return { start: y, end: y }; }
  if (p === "7d") return { start: addDays(today, -6), end: today };
  if (p === "30d") return { start: addDays(today, -29), end: today };
  if (p === "day") return v.date ? { start: v.date, end: v.date } : null;
  if (p === "week") return weekRange(v.week);
  if (p === "month") {
    if (!/^\d{4}-\d{2}$/.test(v.month)) return null;
    const [y, m] = v.month.split("-").map(Number);
    return { start: `${v.month}-01`, end: iso(new Date(y, m, 0)) };
  }
  return v.start && v.end && v.start <= v.end ? { start: v.start, end: v.end } : null;
}

/** Equivalent previous period: same number of days immediately before the range. */
export function previousRange(r: Range): Range {
  const len = diffDays(r.start, r.end) + 1;
  return { start: addDays(r.start, -len), end: addDays(r.start, -1) };
}

/** Uniform view of a module row: real date, reliable shift (or null), and source. */
export type Item = { date: string | null; shift: DashShift | null; row?: RecordRow; t?: TreatmentRow };
export type SourceKey = "on_hold" | "avaria" | "retidos_veiculos" | "erros_operacionais" | "auto_add" | "full" | "tratativas";
/** Whether the source has a reliable shift association at all. */
export const SHIFT_SUPPORT: Record<SourceKey, boolean> = { on_hold: true, avaria: true, retidos_veiculos: true, erros_operacionais: true, auto_add: false, full: true, tratativas: true };

const asShift = (v: unknown): DashShift | null => (DASH_SHIFTS as readonly string[]).includes(String(v)) ? (v as DashShift) : null;
function onHoldShift(row: RecordRow) {
  const direct = normalizeOnHoldShift(row.shift);
  if (direct) return direct;
  if (!row.raw || typeof row.raw !== "object" || Array.isArray(row.raw)) return null;
  const found = new Set(Object.values(row.raw).map(normalizeOnHoldShift).filter(Boolean));
  return found.size === 1 ? asShift([...found][0]) : null;
}

export function toItems(source: SourceKey, rows: RecordRow[], treatments: TreatmentRow[] = []): Item[] {
  switch (source) {
    case "avaria": return rows.map((row) => ({ row, date: row.record_date, shift: asShift(normalizedShift(row.shift)) }));
    case "on_hold": return rows.map((row) => ({ row, date: row.record_date, shift: asShift(onHoldShift(row)) }));
    case "retidos_veiculos": return rows.map((row) => ({ row, date: parseRetidosTime(row.create_time).date ?? row.record_date, shift: retidosShift(row) }));
    case "erros_operacionais": return rows.filter((row) => !isBacklog(row)).map((row) => ({ row, date: row.record_date, shift: errorShift(row.shift) }));
    case "auto_add": return rows.map((row) => ({ row, date: row.record_date, shift: null }));
    case "full": return rows.map((row) => ({ row, date: row.record_date, shift: asShift(normalizedShift(row.shift)) }));
    case "tratativas": return treatments.map((t) => ({ t, date: t.operation_date, shift: asShift(t.shift) }));
  }
}

export function filterItems(items: Item[], range: Range | null, shifts: DashShift[]) {
  const allShifts = !shifts.length || shifts.length === DASH_SHIFTS.length;
  return items.filter((i) => (!range || (!!i.date && i.date >= range.start && i.date <= range.end)) && (allShifts || (i.shift !== null && shifts.includes(i.shift))));
}

export const sumT = (items: Item[], k: "avarias_saved" | "on_hold_treated") => items.reduce((a, i) => a + (i.t?.[k] ?? 0), 0);

export function countBy(items: Item[], key: (i: Item) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const i of items) { const k = key(i); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}
export function sumBy(items: Item[], key: (i: Item) => string | null, val: (i: Item) => number) {
  const m = new Map<string, number>();
  for (const i of items) { const k = key(i); if (k) m.set(k, (m.get(k) ?? 0) + val(i)); }
  return [...m].map(([name, value]) => ({ name, value }));
}
export function evolution(items: Item[], val: (i: Item) => number = () => 1) {
  const m = new Map<string, number>();
  for (const i of items) if (i.date) m.set(i.date, (m.get(i.date) ?? 0) + val(i));
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([d, value]) => ({ label: `${d.slice(8, 10)}/${d.slice(5, 7)}`, value }));
}
export const shiftKey = (i: Item) => i.shift;
export const avariaTypeKey = (i: Item) => (i.row ? normalizedAvariaType(i.row) : null);
export const onHoldReasonKey = (i: Item) => i.row?.reason?.trim() || null;
export const retidosReasonKey = (i: Item) => (i.row ? summarizedRetidosReason(i.row.reason) : null);
export const errorTypeKey = (i: Item) => (i.row ? errorCategory(i.row) ?? (i.row.reason?.trim() || null) : null);
export const fullStatusKey = (i: Item) => (i.row ? fullFinalStatus(i.row) : null);
export const errorCategoryOf = (i: Item) => (i.row ? errorCategory(i.row) : null);

/** Variation: null when previous is zero (no misleading percentage). */
export function variation(cur: number, prev: number) {
  return { diff: cur - prev, pct: prev === 0 ? null : ((cur - prev) / prev) * 100 };
}
