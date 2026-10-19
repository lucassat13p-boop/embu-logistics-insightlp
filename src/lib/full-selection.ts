import type { RecordRow } from "./data";
import { FULL_LMHUB, normId } from "./full-import";

export function fullOperationKey(r: RecordRow) {
  const br = normId(r.order_id);
  if (!br) return JSON.stringify(["row", r.id]);
  // Incomplete operational identity never links unrelated import batches.
  return JSON.stringify([r.record_date, r.shift, br, r.record_date && r.shift?.trim() ? null : r.batch_id]);
}

export function fullSelectionScope(allRows: RecordRow[], selected: Set<string>, overwrite: boolean) {
  const chosen = allRows.filter((r) => selected.has(r.id));
  const keys = new Set(chosen.map(fullOperationKey));
  const linked = allRows.filter((r) => keys.has(fullOperationKey(r)));
  const protectedKeys = new Set(linked.filter((r) => r.manual_status?.trim()).map(fullOperationKey));
  const affected = linked.filter((r) => overwrite || !protectedKeys.has(fullOperationKey(r)));
  return { chosen, linked, affected, preserved: linked.length - affected.length,
    existingManual: linked.filter((r) => r.manual_status?.trim()).length };
}

export function fullBrList(rows: RecordRow[]) {
  const unique = new Map<string, string>();
  for (const r of rows) {
    const key = normId(r.order_id);
    if (key && !unique.has(key)) unique.set(key, r.order_id?.trim() ?? "");
  }
  return [...unique.values()];
}

export function fullManualError(value: string) {
  if (!value.trim()) return "Informe uma classificação válida.";
  if (value.trim().replace(/\s+/g, "_").toLowerCase() === FULL_LMHUB.toLowerCase())
    return "LMHub_Received não resolve a pendência. Informe por que este pacote recebido no HUB não saiu.";
  return null;
}