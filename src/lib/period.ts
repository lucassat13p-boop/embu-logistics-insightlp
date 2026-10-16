type DatedRow = { record_date: string | null };

export type PeriodKind = "day" | "week" | "month" | "custom";
export type PeriodSelection = { kind: PeriodKind; date: string; week: string; months: string[]; start: string; end: string };

export const PERIOD_EMPTY = "Nenhum dado disponível para o período selecionado.";
export const EMPTY_PERIOD: PeriodSelection = { kind: "month", date: "", week: "", months: [], start: "", end: "" };

// Call after hydration so today's date follows the user's system clock, not SSR UTC.
export function currentSystemDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

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

export function weekRange(week: string): { start: string; end: string } | null {
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const number = Number(match[2]);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7) + (number - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

export function periodRange(period: PeriodSelection): { start: string; end: string } | null {
  if (period.kind === "day") return period.date ? { start: period.date, end: period.date } : null;
  if (period.kind === "week") return weekRange(period.week);
  if (period.kind === "custom") return period.start && period.end ? { start: period.start, end: period.end } : null;
  return null;
}

export function filterByPeriod<T extends DatedRow>(rows: T[], period: PeriodSelection): T[] {
  if (period.kind === "month") return filterByMonths(rows, period.months);
  const range = periodRange(period);
  if (!range) return rows;
  return rows.filter((row) => !!row.record_date && row.record_date >= range.start && row.record_date <= range.end);
}

export function periodLabel(period: PeriodSelection): string {
  if (period.kind === "day") return period.date ? formatDate(period.date) : "Selecione uma data";
  if (period.kind === "week") {
    const range = weekRange(period.week);
    return range ? `${period.week.replace("-W", " · Semana ")} (${formatDate(range.start)}–${formatDate(range.end)})` : "Selecione uma semana";
  }
  if (period.kind === "custom") return period.start && period.end ? `${formatDate(period.start)}–${formatDate(period.end)}` : "Selecione as datas";
  if (!period.months.length) return "Todos os meses";
  return period.months.map(monthLabel).join(" + ");
}

const formatDate = (value: string) => value.split("-").reverse().join("/");