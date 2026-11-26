import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchTreatments, type TreatmentRow } from "./treatments";
import { filterByPeriod, type PeriodSelection } from "./period";
import type { Sheet } from "./parsers";
import { displayHubShift } from "./shifts";

export const TREATED_SHEET = "Pacotes Tratados Não MEXER";
export type TreatedImportRow = Tables<"on_hold_treated_imports">;
export type TreatedPreview = ({ sheetName: string; analyzed: number; matched: number } | { error: string }) & { sheetNames: string[] };

const norm = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** Comparison-only key: removes accents, case, spaces and separators like "/", "-", "_". */
const nameKey = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Finds the treated-packages sheet in the real workbook sheet list: exact key first, then a sheet
 *  whose key contains "pacotestratados" (e.g. real name "Pacotes Tratados  Não MEXER"). */
function findTreatedSheet(sheets: Sheet[]) {
  const target = nameKey(TREATED_SHEET);
  return sheets.find((s) => nameKey(s.name) === target)
    ?? sheets.find((s) => nameKey(s.name).includes("pacotestratados"));
}

/** Counts unique valid SLS tracking numbers in column B, independently of secondary fields. */
export function countTreatedSheet(sheets: Sheet[]): TreatedPreview {
  const sheetNames = sheets.map((s) => s.name);
  const res = countIn(sheets);
  return { ...res, sheetNames };
}

function countIn(sheets: Sheet[]): { sheetName: string; analyzed: number; matched: number } | { error: string } {
  const sheet = findTreatedSheet(sheets);
  if (!sheet) return { error: `Aba "${TREATED_SHEET}" não encontrada no arquivo.` };
  if (nameKey(norm(sheet.rows[0]?.[1])) !== nameKey("SLS Tracking Number")) {
    return { error: `Cabeçalho obrigatório ausente na coluna B da aba "${sheet.name}": SLS Tracking Number.` };
  }
  let analyzed = 0;
  const trackingNumbers = new Set<string>();
  for (const row of sheet.rows.slice(1)) {
    const r = row ?? [];
    if (r.every((c) => norm(c) === "")) continue;
    analyzed++;
    const tracking = norm(r[1]).toUpperCase();
    if (/^[A-Z0-9]+(?:[-_][A-Z0-9]+)*$/.test(tracking) && /\d/.test(tracking) && !/^0+$/.test(tracking)) {
      trackingNumbers.add(tracking);
    }
  }
  return { sheetName: sheet.name, analyzed, matched: trackingNumbers.size };
}

export async function fetchTreatedImports(): Promise<TreatedImportRow[]> {
  const out: TreatedImportRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("on_hold_treated_imports").select("*")
      .order("operation_date", { ascending: false }).order("id", { ascending: true }).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []).map((r) => ({ ...r, shift: displayHubShift(r.shift) ?? r.shift })));
    if (!data || data.length < 1000) return out;
  }
}
export const treatedImportsQuery = () => queryOptions({ queryKey: ["on_hold_treated_imports"], queryFn: fetchTreatedImports, staleTime: 30_000 });

/** Replaces the result of the same date + shift (controlled re-import, never summed twice). */
export async function saveTreatedImport(p: { date: string; shift: string; preview: { sheetName: string; analyzed: number; matched: number }; fileName: string; batchId: string | null }) {
  const { error } = await supabase.from("on_hold_treated_imports").upsert({
    operation_date: p.date, shift: displayHubShift(p.shift) ?? p.shift, quantity: p.preview.matched, rows_analyzed: p.preview.analyzed, sheet_name: p.preview.sheetName,
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
