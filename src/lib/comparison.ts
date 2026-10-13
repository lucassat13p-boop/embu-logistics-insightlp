import type { RecordRow } from "./data";
import type { FieldKey } from "./modules";

export const COMPARISON_EMPTY = "Nenhum dado disponível para comparação.";

export function variation(previous: number | null, current: number | null) {
  if (previous === null || current === null || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return { percent: null, label: "Sem informação", analysis: COMPARISON_EMPTY, direction: "missing" as const };
  }
  if (previous === 0) return { percent: null, label: "Não calculável", analysis: "Não calculável", direction: "baseline" as const };
  const percent = ((current - previous) / previous) * 100;
  const magnitude = Math.abs(percent).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    percent,
    label: percent === 0 ? "0%" : `${percent > 0 ? "+" : "-"}${magnitude}%`,
    analysis: percent === 0 ? "Sem alteração" : `${percent > 0 ? "Crescimento" : "Queda"} de ${magnitude}%`,
    direction: percent === 0 ? "stable" as const : percent > 0 ? "increase" as const : "decrease" as const,
  };
}

// Zero is a measured absence only when this period has real values for the dimension.
export function metricCount(rows: readonly RecordRow[], field?: FieldKey, name?: string, allowed?: readonly string[]): number | null {
  if (!rows.length) return null;
  if (!field) return rows.length;
  const real = rows.filter((row) => {
    const value = row[field];
    return value !== null && value !== undefined && String(value).trim() !== "" && (!allowed || allowed.includes(String(value)));
  });
  if (!real.length) return null;
  return real.filter((row) => String(row[field]) === name).length;
}

export function adjacentPairs(months: readonly string[]) {
  return months.slice(1).map((current, index) => ({ previous: months[index], current, previousIndex: index, currentIndex: index + 1 }));
}