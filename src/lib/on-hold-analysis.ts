import type { RecordRow } from "./data";

export type OnHoldField = "reason" | "neighborhood" | "treatment" | "delivery_attempts" | "driver_name";

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