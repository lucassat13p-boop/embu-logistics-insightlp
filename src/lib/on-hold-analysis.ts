import type { RecordRow } from "./data";

export type OnHoldField = "reason" | "neighborhood" | "treatment" | "delivery_attempts" | "driver_name";
export type OnHoldShift = "all" | "AM1" | "AM2" | "PM1";

export function normalizeOnHoldShift(value: unknown) {
  const text = String(value ?? "").toUpperCase();
  const found = new Set<Exclude<OnHoldShift, "all">>();
  if (/(^|[^A-Z0-9])AM\s*1(?=$|[^A-Z0-9])/.test(text)) found.add("AM1");
  if (/(^|[^A-Z0-9])AM\s*2(?=$|[^A-Z0-9])/.test(text)) found.add("AM2");
  if (/(^|[^A-Z0-9])PM\s*1(?=$|[^A-Z0-9])/.test(text)) found.add("PM1");
  return found.size === 1 ? [...found][0] : null;
}

function sourceShift(row: RecordRow) {
  const direct = normalizeOnHoldShift(row.shift);
  if (direct) return direct;
  if (!row.raw || typeof row.raw !== "object" || Array.isArray(row.raw)) return null;
  const found = new Set(Object.values(row.raw).map(normalizeOnHoldShift).filter((value): value is Exclude<OnHoldShift, "all"> => value !== null));
  return found.size === 1 ? [...found][0] : null;
}

export function filterOnHoldByShift(rows: RecordRow[], shift: OnHoldShift) {
  return shift === "all" ? rows : rows.filter((row) => sourceShift(row) === shift);
}

export function countOnHold(rows: RecordRow[], field: OnHoldField) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[field];
    if (value === null || value === undefined || String(value).trim() === "") continue;
    const name = String(value).trim();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}

export function uniqueDrivers(rows: RecordRow[]) {
  return new Set(rows.map((row) => row.driver_id?.trim() || row.driver_name?.trim()).filter((value): value is string => !!value)).size;
}

export function driverRanking(rows: RecordRow[]) {
  const map = new Map<string, { name: string; driverId: string | null; value: number }>();
  for (const row of rows) {
    const name = row.driver_name?.trim();
    const driverId = row.driver_id?.trim() || null;
    if (!name && !driverId) continue;
    const key = driverId || name || "";
    const current = map.get(key);
    if (current) current.value += 1;
    else map.set(key, { name: name || driverId || "Sem informação", driverId, value: 1 });
  }
  return [...map.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}

export function percentage(value: number, total: number) {
  return total ? `${((value / total) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "0%";
}