import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type MissortedEntry = Tables<"missorted_entries">;
export const INITIAL_MISSORTED_TARGET = 0.68;
export const missortedQuery = () => queryOptions({
  queryKey: ["missorted_entries"], staleTime: 30_000,
  queryFn: async () => {
    const rows: MissortedEntry[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("missorted_entries").select("*")
        .order("operation_date", { ascending: false }).order("shift").range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  },
});
export const missortedTargetQuery = () => queryOptions({
  queryKey: ["missorted_target"], staleTime: 30_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("missorted_settings").select("target_percent").eq("id", true).maybeSingle();
    if (error) throw error;
    return data?.target_percent ?? INITIAL_MISSORTED_TARGET;
  },
});
export function missortedResult(rows: Pick<MissortedEntry, "incorrect_packages" | "processed_packages">[], target: number) {
  const incorrect = rows.reduce((sum, row) => sum + row.incorrect_packages, 0);
  const processed = rows.reduce((sum, row) => sum + row.processed_packages, 0);
  const percent = rows.length && processed > 0 ? incorrect / processed * 100 : null;
  return { percent, above: percent !== null && incorrect * 100 > target * processed };
}
export const formatMissorted = (value: number) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export function validMissortedCounts(incorrect: string, processed: string) {
  return [incorrect, processed].every((v) => /^\d+$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) <= 2147483647) && Number(incorrect) <= Number(processed);
}