import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchTreatments, type TreatmentRow } from "./treatments";
import { filterByPeriod, type PeriodSelection } from "./period";
import type { Sheet } from "./parsers";

export const TREATED_SHEET = "Pacotes Tratados Não MEXER";
export type TreatedImportRow = Tables<"on_hold_treated_imports">;
export type TreatedPreview = { sheetName: string; analyzed: number; matched: number } | { error: string };

const norm = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** Tolerant sheet-name match: collapses spaces and removes separators like "/", so the real
 *  sheet "Pacotes Tratados Não MEXER" (and variants with an extra "/" or stray spaces) match. */
function isTreatedSheet(name: string) {
  const key = (v: string) => v.normalize("NFC").replace(/\s+/g, " ").replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return key(name) === key(TREATED_SHEET);
}

/** Counts rows where OnHoldReason, Status and Calculation Status match exactly; no BR dedupe. */
export function countTreatedSheet(sheets: Sheet[]): TreatedPreview {
  const sheet = sheets.find((s) => s.name.trim() === TREATED_SHEET);
  if (!sheet) return { error: `Aba "${TREATED_SHEET}" não encontrada no arquivo.` };
  const need = ["OnHoldReason", "Status", "Calculation Status"];
  let hIdx = -1, cols: number[] = [];
  for (let i = 0; i < Math.min(sheet.rows.length, 20); i++) {
    const r = (sheet.rows[i] ?? []).map(norm);
    const idx = need.map((n) => r.indexOf(n));
    if (idx.every((x) => x >= 0)) { hIdx = i; cols = idx; break; }
  }
  if (hIdx < 0) return { error: `Cabeçalhos obrigatórios ausentes na aba "${TREATED_SHEET}": ${need.join(", ")}.` };
  let analyzed = 0, matched = 0;
  for (const row of sheet.rows.slice(hIdx + 1)) {
    const r = row ?? [];
    if (r.every((c) => norm(c) === "")) continue;
    analyzed++;
    const calc = r[cols[2]];
    const calcZero = calc === 0 || norm(calc) === "0";
    if (norm(r[cols[0]]) === "Cannot find address" && norm(r[cols[1]]) === "LMHub_Received" && calcZero) matched++;
  }
  return { sheetName: sheet.name, analyzed, matched };
}

export async function fetchTreatedImports(): Promise<TreatedImportRow[]> {
  const { data, error } = await supabase.from("on_hold_treated_imports").select("*").order("operation_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export const treatedImportsQuery = () => queryOptions({ queryKey: ["on_hold_treated_imports"], queryFn: fetchTreatedImports, staleTime: 30_000 });

/** Replaces the result of the same date + shift (controlled re-import, never summed twice). */
export async function saveTreatedImport(p: { date: string; shift: string; preview: { sheetName: string; analyzed: number; matched: number }; fileName: string; batchId: string | null }) {
  const { error } = await supabase.from("on_hold_treated_imports").upsert({
    operation_date: p.date, shift: p.shift, quantity: p.preview.matched, rows_analyzed: p.preview.analyzed, sheet_name: p.preview.sheetName,
    file_name: p.fileName, batch_id: p.batchId, processed_at: new Date().toISOString(),
  }, { onConflict: "operation_date,shift" });
  if (error) throw error;
}

export function filterTreatedImports(rows: TreatedImportRow[], period: PeriodSelection, shifts: string[]) {
  const dated = filterByPeriod(rows.map((r) => ({ ...r, record_date: r.operation_date })), period);
  return shifts.length ? dated.filter((r) => shifts.includes(r.shift)) : dated;
}
export const sumTreatedImports = (rows: TreatedImportRow[]) => ({ total: rows.reduce((a, r) => a + r.quantity, 0), entries: rows.length });

export type OfficialTreatment = TreatmentRow & { origin: "manual" | "import" };

/** Manual entries keep only Avarias Salvas; ON HOLD treated comes exclusively from imports. */
export function mergeOfficial(manual: TreatmentRow[], imports: TreatedImportRow[]): OfficialTreatment[] {
  return [
    ...manual.map((t) => ({ ...t, on_hold_treated: 0, origin: "manual" as const })),
    ...imports.map((r) => ({ id: `imp-${r.id}`, operation_date: r.operation_date, shift: r.shift, avarias_saved: 0, on_hold_treated: r.quantity, notes: null, created_at: r.created_at, updated_at: r.processed_at, created_by: r.created_by, origin: "import" as const }) as unknown as OfficialTreatment),
  ];
}
export const officialTreatmentsQuery = () => queryOptions({
  queryKey: ["official_treatments"], staleTime: 30_000,
  queryFn: async () => { const [m, i] = await Promise.all([fetchTreatments(), fetchTreatedImports()]); return mergeOfficial(m, i); },
});
export const isImport = (t: unknown) => (t as { origin?: string } | undefined)?.origin === "import";
