/** Idempotent name correspondence only; never changes operational times or dates. */
export const HUB_SHIFTS = ["AM1", "AM2", "PM1"] as const;
export type HubShift = (typeof HUB_SHIFTS)[number];
const names: Record<string, HubShift> = { PM2: "AM1", AM: "AM2", PM1: "PM1", AM1: "AM1", AM2: "AM2" };
export function normalizeHubShift(value: unknown): HubShift | null {
  return names[String(value ?? "").trim().toUpperCase().replace(/\s+/g, "")] ?? null;
}
export function displayHubShift(value: string | null): string | null {
  return normalizeHubShift(value) ?? (value?.trim() || null);
}
/** Standalone names in source text; conflicts stay unidentified. */
export function hubShiftMarkers(value: unknown): HubShift[] {
  return [...new Set([...String(value ?? "").toUpperCase().matchAll(/(?:^|[^A-Z0-9])(AM\s*[12]|PM\s*[12]|AM)(?=$|[^A-Z0-9])/g)]
    .flatMap((match) => { const shift = normalizeHubShift(match[1]); return shift ? [shift] : []; }))];
}
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
/** Stored official labels are retained unless explicit original shift evidence exists. */
export function interpretRecordShift<T extends { shift: string | null; module: string; raw: unknown; extra: unknown }>(row: T): T {
  const extra = object(row.extra);
  const evidence = object(extra.hub_shift);
  let original: unknown = row.shift;
  if (evidence.version === 1) original = evidence.original;
  else if (row.module !== "conferencia" && row.module !== "retidos_veiculos") {
    const raw = object(row.raw);
    // Responsibility comes from the block, never its conflicting Turno original.
    const responsible = raw["Turno responsável"];
    const explicit = responsible !== undefined ? [responsible] : Object.entries(raw)
      .filter(([key]) => /^(turno|shift|turno oficial|turno do hub)$/i.test(key.trim())).map(([, value]) => value);
    const shifts = new Set(explicit.map(normalizeHubShift).filter((s): s is HubShift => s !== null));
    if (shifts.size === 1) original = [...shifts][0];
  }
  const shift = displayHubShift(typeof original === "string" ? original : row.shift);
  return shift === row.shift ? row : { ...row, shift, extra: { ...extra, hub_shift_stored: extra.hub_shift_stored ?? row.shift } };
}