import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { RecordRow } from "./data";
import { normalizeHeader } from "./modules";
import { buildTable, cellText, parseDate, type ParsedFile } from "./parsers";

export const FLOATING_COLUMNS = [
  ["record_date", "Data"], ["order_id", "BR"], ["aging", "Aging"], ["route", "Cluster"],
  ["driver_id", "Driver ID"], ["driver_name", "Motorista"], ["carrier_3pl", "3PL"],
  ["to_number", "AT"], ["product", "Produto (DESCRIÇÃO)"], ["collaborator", "Email - OPS"],
  ["quantity", "Valor"], ["shift", "Turno"], ["function", "Função"], ["mapping", "Mapeamento"],
] as const;
export const brKey = (value: string) => value.trim().toUpperCase();
export const floatingShift = (value: string | null) => {
  const normalized = value?.trim().toUpperCase().replace(/\s+/g, "");
  return normalized && ["AM1", "AM2", "PM1"].includes(normalized) ? normalized : "Não identificado";
};
export function floatingMapping(row: Pick<RecordRow, "extra">) {
  const value = row.extra && typeof row.extra === "object" && !Array.isArray(row.extra) ? row.extra.mapping : null;
  const normalized = typeof value === "string" ? normalizeHeader(value) : "";
  return normalized === "expedicao" ? "Expedição" : normalized === "recebimento" ? "Recebimento" : "Não identificado";
}
export function floatingValue(row: RecordRow, key: string): string | number | null {
  if (key === "function" || key === "mapping") {
    const extra = row.extra;
    const value = extra && typeof extra === "object" && !Array.isArray(extra) ? extra[key] : null;
    return typeof value === "string" ? value : null;
  }
  const value = row[key as keyof RecordRow];
  return typeof value === "string" || typeof value === "number" ? value : null;
}
export function parseFloatingMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  let text = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (text.includes(",")) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)) return null;
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  else if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const result = Number(text);
  return Number.isFinite(result) ? result : null;
}
function floatingDate(value: unknown) {
  const result = parseDate(value);
  if (!result.iso) return result;
  const date = new Date(`${result.iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === result.iso ? result : { iso: null, raw: result.raw };
}
export type FloatingImportRow = {
  row_number: number; record_date: string | null; record_date_raw: string | null; order_id: string;
  aging: string | null; route: string | null; driver_id: string | null; driver_name: string | null;
  carrier_3pl: string | null; to_number: string | null; product: string | null; collaborator: string | null;
  quantity: number | null; shift: string | null; extra: { function: string | null; mapping: string | null }; raw: Record<string, Json>;
};
export function prepareFloatingFile(parsed: ParsedFile) {
  if (parsed.format !== "xlsx") throw new Error("Pacotes Flutuantes utiliza Excel (.xlsx), com a aba Perdidos.");
  const sheets = parsed.sheets.filter((sheet) => normalizeHeader(sheet.name) === "perdidos");
  if (sheets.length !== 1) throw new Error(`Aba Perdidos ${sheets.length ? "ambígua" : "não encontrada"}. Abas detectadas: ${parsed.sheets.map((s) => s.name).join(", ")}. A base atual foi preservada.`);
  const sheet = sheets[0];
  if (!sheet) throw new Error("Aba Perdidos não encontrada.");
  const headerIndex = sheet.rows.findIndex((row) => row.some((cell) => typeof cell === "string" && normalizeHeader(cell) === "br"));
  if (headerIndex < 0) throw new Error("A coluna BR é obrigatória. A base atual foi preservada.");
  const table = buildTable(sheet.rows, headerIndex);
  const headers = new Map<string, string>();
  for (const header of table.headers) {
    const normalized = normalizeHeader(header.replace(/ \(\d+\)$/, ""));
    if (headers.has(normalized)) throw new Error(`Coluna repetida ou ambígua: ${header}. A base atual foi preservada.`);
    headers.set(normalized, header);
  }
  const cell = (values: Record<string, unknown>, name: string) => values[headers.get(normalizeHeader(name)) ?? ""];
  const rows: FloatingImportRow[] = [];
  const seen = new Map<string, string>();
  let duplicates = 0, invalidDates = 0, invalidValues = 0;
  for (const row of table.body) {
    if (row.empty) continue;
    const br = cellText(cell(row.values, "BR"));
    if (!br) throw new Error(`Linha ${row.rowNumber}: BR ausente. Corrija o arquivo antes de substituir a base.`);
    const date = floatingDate(cell(row.values, "Data"));
    const money = parseFloatingMoney(cell(row.values, "Valor"));
    if (date.raw && !date.iso) invalidDates++;
    if (cellText(cell(row.values, "Valor")) && money === null) invalidValues++;
    const raw = Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, value === null || value === undefined ? null : typeof value === "number" || typeof value === "boolean" ? value : String(value)]));
    const next: FloatingImportRow = {
      row_number: row.rowNumber, record_date: date.iso, record_date_raw: date.raw, order_id: br,
      aging: cellText(cell(row.values, "Aging")), route: cellText(cell(row.values, "Cluster")),
      driver_id: cellText(cell(row.values, "Driver ID")), driver_name: cellText(cell(row.values, "Motorista")),
      carrier_3pl: cellText(cell(row.values, "3PL")), to_number: cellText(cell(row.values, "AT")),
      product: cellText(cell(row.values, "Produto (DESCRIÇÃO)")), collaborator: cellText(cell(row.values, "Email - OPS")),
      quantity: money, shift: cellText(cell(row.values, "Turno")),
      extra: { function: cellText(cell(row.values, "Função")), mapping: cellText(cell(row.values, "Mapeamento")) }, raw,
    };
    const signature = JSON.stringify({ ...next, row_number: undefined, order_id: brKey(br), raw: undefined });
    const existing = seen.get(brKey(br));
    if (existing !== undefined) {
      if (existing !== signature) throw new Error(`BR ${br}: linhas com dados diferentes. Corrija a correspondência antes de substituir a base.`);
      duplicates++; continue;
    }
    seen.set(brKey(br), signature); rows.push(next);
  }
  if (!rows.length) throw new Error("A aba Perdidos está vazia. A base atual foi preservada.");
  return { rows, sheetName: sheet.name, headers: table.headers, duplicates, invalidDates, invalidValues, missing: FLOATING_COLUMNS.map(([, name]) => name).filter((name) => !headers.has(normalizeHeader(name))) };
}
export function floatingDiff(previous: { order_id: string | null }[], next: { order_id: string }[]) {
  const before = new Set(previous.flatMap((r) => r.order_id ? [brKey(r.order_id)] : []));
  const after = new Set(next.map((r) => brKey(r.order_id)));
  return { new: [...after].filter((br) => !before.has(br)).length, remain: [...after].filter((br) => before.has(br)).length, leave: [...before].filter((br) => !after.has(br)).length };
}
export async function fetchFloatingActive() {
  const { data: pointer, error } = await supabase.from("floating_active_snapshot").select("batch_id,updated_at").eq("id", true).maybeSingle();
  if (error) throw error;
  const rows: RecordRow[] = [];
  if (pointer) for (let from = 0; ; from += 1000) {
    const { data, error: readError } = await supabase.from("records").select("*").eq("module", "pacotes_flutuantes").eq("batch_id", pointer.batch_id).order("record_date", { ascending: false, nullsFirst: false }).order("id").range(from, from + 999);
    if (readError) throw readError;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { batchId: pointer?.batch_id ?? null, updatedAt: pointer?.updated_at ?? null, rows };
}
export const floatingActiveQuery = () => queryOptions({ queryKey: ["records", "pacotes_flutuantes", "active"], queryFn: fetchFloatingActive, staleTime: 30_000 });
