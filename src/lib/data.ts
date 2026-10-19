import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { FieldKey, ModuleKey } from "./modules";

export type RecordRow = Tables<"records">;
export type BatchRow = Tables<"import_batches">;

const MAX = 50000;

export async function fetchRecords(module?: ModuleKey) {
  const out: RecordRow[] = [];
  for (let from = 0; module === "retidos_veiculos" || module === "full" || from < MAX; from += 1000) {
    let q = supabase.from("records").select("*").order("record_date", { ascending: false, nullsFirst: false }).range(from, from + 999);
    if (module) q = q.eq("module", module);
    if (module === "retidos_veiculos" || module === "full") q = q.order("id", { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const recordsQuery = (module?: ModuleKey) =>
  queryOptions({ queryKey: ["records", module ?? "all"], queryFn: () => fetchRecords(module), staleTime: 30_000 });

export const batchesQuery = () =>
  queryOptions({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("import_batches").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

export const errorsQuery = (batchId?: string) =>
  queryOptions({
    queryKey: ["import_errors", batchId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("import_errors").select("*").order("row_number").limit(5000);
      if (batchId) q = q.eq("batch_id", batchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

export function countBy(rows: RecordRow[], f: FieldKey) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = r[f as keyof RecordRow];
    if (v === null || v === undefined || v === "") continue;
    const k = String(v);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}

export function byDate(rows: RecordRow[]) {
  const m = new Map<string, number>();
  for (const r of rows) if (r.record_date) m.set(r.record_date, (m.get(r.record_date) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, label: date.slice(8, 10) + "/" + date.slice(5, 7), value }));
}

export const hasField = (rows: RecordRow[], f: FieldKey) => rows.some((r) => { const v = r[f as keyof RecordRow]; return v !== null && v !== undefined && v !== ""; });
