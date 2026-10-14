import type { RecordRow } from "./data";

export const OFFICIAL_AVARIA_TYPES = ["Líquido", "Sólido", "Vidro", "Item vazio", "SOC"] as const;
export const OFFICIAL_SHIFTS = ["AM1", "AM2", "PM1"] as const;

const clean = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
const folded = (value: unknown) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");

export function normalizedShift(value: unknown): string | null {
  const compact = folded(value).replace(/\s+/g, "");
  return OFFICIAL_SHIFTS.includes(compact as (typeof OFFICIAL_SHIFTS)[number]) ? compact : null;
}

export function normalizedAvariaType(row: Pick<RecordRow, "classification" | "location">): string | null {
  if (folded(row.location) === "SOC") return "SOC";
  const value = folded(row.classification);
  return OFFICIAL_AVARIA_TYPES.find((item) => folded(item) === value) ?? null;
}

export function normalizedCollaborator(value: unknown): string | null {
  const name = clean(value);
  if (!name) return null;
  return name.toLocaleLowerCase("pt-BR").replace(/(^|[\s@._-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

export function countAvariaTypes(rows: RecordRow[]) {
  return OFFICIAL_AVARIA_TYPES.map((name) => ({ name, value: rows.filter((row) => normalizedAvariaType(row) === name).length })).filter((item) => item.value > 0);
}

export function countAvariaShifts(rows: RecordRow[]) {
  return OFFICIAL_SHIFTS.map((name) => ({ name, value: rows.filter((row) => normalizedShift(row.shift) === name).length })).filter((item) => item.value > 0);
}

export function countAvariaCollaborators(rows: RecordRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = normalizedCollaborator(row.collaborator);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}