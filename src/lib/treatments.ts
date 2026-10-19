import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { filterByPeriod, type PeriodSelection } from "./period";

export type TreatmentRow = Tables<"operational_treatments">;
export const TREATMENT_SHIFTS = ["AM1", "AM2", "PM1"] as const;
export type TreatmentShift = (typeof TREATMENT_SHIFTS)[number];

export async function fetchTreatments(): Promise<TreatmentRow[]> {
  const out: TreatmentRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("operational_treatments").select("*")
      .order("operation_date", { ascending: false }).order("created_at", { ascending: false }).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const treatmentsQuery = () => queryOptions({ queryKey: ["operational_treatments"], queryFn: fetchTreatments, staleTime: 30_000 });

/** Filters by the registered operational date (not creation time) and selected shifts (empty = all). */
export function filterTreatments(rows: TreatmentRow[], period: PeriodSelection, shifts: TreatmentShift[]) {
  const dated = filterByPeriod(rows.map((r) => ({ ...r, record_date: r.operation_date })), period);
  return shifts.length ? dated.filter((r) => (shifts as string[]).includes(r.shift)) : dated;
}

export function sumTreatments(rows: TreatmentRow[]) {
  return rows.reduce((a, r) => ({ avarias: a.avarias + r.avarias_saved, onHold: a.onHold + r.on_hold_treated, entries: a.entries + 1 }), { avarias: 0, onHold: 0, entries: 0 });
}

/** Totals per operational date + shift, for the future main dashboard. */
export function treatmentsByDateShift(rows: TreatmentRow[]) {
  const m = new Map<string, { date: string; shift: string; avarias: number; onHold: number; entries: number }>();
  for (const r of rows) {
    const k = `${r.operation_date}|${r.shift}`;
    const cur = m.get(k) ?? { date: r.operation_date, shift: r.shift, avarias: 0, onHold: 0, entries: 0 };
    cur.avarias += r.avarias_saved; cur.onHold += r.on_hold_treated; cur.entries += 1;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.date.localeCompare(a.date) || a.shift.localeCompare(b.shift));
}
