type DatedRow = { record_date: string | null };

export const PERIOD_EMPTY = "Nenhum dado disponível para este período.";

export function recordMonth(date: string | null): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return date.slice(0, 7);
}

export function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return month;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function availableMonths<T extends DatedRow>(rows: T[]): string[] {
  return [...new Set(rows.map((row) => recordMonth(row.record_date)).filter((month): month is string => month !== null))].sort();
}

export function filterByMonths<T extends DatedRow>(rows: T[], months: string[]): T[] {
  if (!months.length) return rows;
  const selected = new Set(months);
  return rows.filter((row) => {
    const month = recordMonth(row.record_date);
    return month !== null && selected.has(month);
  });
}