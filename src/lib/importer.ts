import { supabase } from "@/integrations/supabase/client";
import type { FieldKey, ModuleDef } from "./modules";
import { FIELD_LABELS } from "./modules";
import { cellText, parseDate } from "./parsers";
import { parseRetidosTime } from "./retidos-analysis";
import { recordMonth } from "./period";
import { parseOperationalDate } from "./operational-import-layout";
import { publishStagedImport } from "./staged-import";

export type Mapping = Record<string, FieldKey | "">;
export type RowIssue = { rowNumber: number; column: string | null; message: string; kind: "erro" | "ignorado" | "duplicado"; raw?: Record<string, unknown> };
export type ValidRow = {
  rowNumber: number;
  fields: Partial<Record<FieldKey, string | number | null>>;
  record_date_raw: string | null;
  extra: Record<string, unknown>;
  raw: Record<string, unknown>;
  dedupe_key: string;
};
export type ValidationResult = { total: number; valid: ValidRow[]; issues: RowIssue[]; errorCount: number; ignoredCount: number; dupInFile: number };

export function validate(mod: ModuleDef, body: { rowNumber: number; values: Record<string, unknown>; empty: boolean }[], mapping: Mapping): ValidationResult {
  const inv = new Map<FieldKey, string>();
  Object.entries(mapping).forEach(([col, f]) => f && inv.set(f, col));
  const issues: RowIssue[] = [];
  const valid: ValidRow[] = [];
  const seen = new Set<string>();
  let errorCount = 0, ignoredCount = 0, dupInFile = 0, total = 0;

  for (const row of body) {
    if (row.empty) { ignoredCount++; continue; } // completely empty rows are ignored silently
    total++;
    const fields: ValidRow["fields"] = {};
    let rowError = false;
    let dateRaw: string | null = null;
    for (const [f, col] of inv) {
      const v = row.values[col];
      if (f === "record_date") {
        const d = mod.key === "erros_operacionais" ? parseOperationalDate(v) : parseDate(v);
        dateRaw = d.raw;
        if (d.raw && !d.iso && mod.key !== "erros_operacionais") {
          issues.push({ rowNumber: row.rowNumber, column: col, message: `Data inválida "${d.raw}" na coluna "${col}"`, kind: "erro", raw: row.values });
          rowError = true;
        }
        fields.record_date = mod.key === "erros_operacionais" && !recordMonth(d.iso) ? null : d.iso;
      } else if (f === "quantity") {
        const t = cellText(v);
        if (t !== null) {
          const n = Number(t.replace(/\./g, "").replace(",", "."));
          if (Number.isNaN(n)) { issues.push({ rowNumber: row.rowNumber, column: col, message: `Valor numérico inválido "${t}" na coluna "${col}"`, kind: "erro", raw: row.values }); rowError = true; }
          else fields.quantity = n;
        }
      } else fields[f] = cellText(v);
    }
    for (const req of mod.required) {
      if (fields[req] === null || fields[req] === undefined || fields[req] === "") {
        const col = inv.get(req);
        issues.push({ rowNumber: row.rowNumber, column: col ?? null, message: col ? `Campo obrigatório "${FIELD_LABELS[req]}" vazio (coluna "${col}")` : `Campo obrigatório "${FIELD_LABELS[req]}" não mapeado`, kind: "erro", raw: row.values });
        rowError = true;
      }
    }
    if (rowError) { errorCount++; continue; }
    const extra: Record<string, unknown> = {};
    Object.entries(mapping).forEach(([col, f]) => { if (!f) extra[col] = row.values[col]; });
    if (mod.key === "retidos_veiculos") {
      dateRaw = cellText(fields.create_time);
      fields.record_date = parseRetidosTime(fields.create_time).date;
    }
    const keyParts = mod.dedupe.map((f) => String(fields[f] ?? ""));
    // Retidos: stable per-source-row key — a reimport of the same file is ignored, while
    // legitimate repeated occurrences (different rows/moments) are always kept.
    const dedupe_key = mod.appendOnly
      ? mod.key === "retidos_veiculos"
        ? (["tracking_number", "exception_order_id", "reason", "follow_up_action", "status", "create_time"] as const).map((f) => String(fields[f] ?? "")).join("|") + `|${row.rowNumber}`
        : crypto.randomUUID()
      : keyParts.every((p) => p === "") ? JSON.stringify(row.values) : keyParts.join("|");
    if (!mod.appendOnly && seen.has(dedupe_key)) {
      dupInFile++;
      issues.push({ rowNumber: row.rowNumber, column: null, message: "Registro duplicado dentro do próprio arquivo", kind: "duplicado", raw: row.values });
      continue;
    }
    seen.add(dedupe_key);
    valid.push({ rowNumber: row.rowNumber, fields, record_date_raw: dateRaw, extra, raw: row.values, dedupe_key });
  }
  return { total, valid, issues, errorCount, ignoredCount, dupInFile };
}

export type DupStrategy = "ignore" | "update";

export type AvariaImportOptions = { shifts: string[]; includeSoc: boolean; found: { AM1: number; AM2: number; PM1: number; missing: number; soc: number }; excluded: number };

export async function countExisting(mod: ModuleDef, keys: string[]) {
  if (mod.appendOnly && mod.key !== "retidos_veiculos") return 0;
  let n = 0;
  for (let i = 0; i < keys.length; i += 200) {
    const { count, error } = await supabase.from("records").select("id", { count: "exact", head: true }).eq("module", mod.key).in("dedupe_key", keys.slice(i, i + 200));
    if (error) throw new Error(`Não foi possível conferir os registros existentes: ${error.message}`);
    if (count === null) throw new Error("Não foi possível conferir a quantidade de registros existentes.");
    n += count;
  }
  return n;
}

export async function commitImport(opts: {
  mod: ModuleDef; fileName: string; format: string; sheetName: string; headers: string[];
  mapping: Mapping; result: ValidationResult; strategy: DupStrategy; avariaOptions?: AvariaImportOptions;
}) {
  const t0 = performance.now();
  const { mod, result } = opts;
  const rows = result.valid.map((v) => ({
    row_number: v.rowNumber,
    record_date: (v.fields.record_date as string) ?? null, record_date_raw: v.record_date_raw,
    month: (v.fields.month as string) ?? null, location: (v.fields.location as string) ?? null,
    order_id: (v.fields.order_id as string) ?? null, status: (v.fields.status as string) ?? null,
    collaborator: (v.fields.collaborator as string) ?? null, product: (v.fields.product as string) ?? null,
    shift: (v.fields.shift as string) ?? null, route: (v.fields.route as string) ?? null, lh: (v.fields.lh as string) ?? null,
    reason: (v.fields.reason as string) ?? null, classification: (v.fields.classification as string) ?? null,
    quantity: (v.fields.quantity as number) ?? null, extra: v.extra, raw: v.raw,
    tracking_number: (v.fields.tracking_number as string) ?? null,
    product_code: (v.fields.product_code as string) ?? null, treatment: (v.fields.treatment as string) ?? null,
    delivery_attempts: (v.fields.delivery_attempts as string) ?? null, aging: (v.fields.aging as string) ?? null,
    driver_name: (v.fields.driver_name as string) ?? null, driver_id: (v.fields.driver_id as string) ?? null,
    carrier_3pl: (v.fields.carrier_3pl as string) ?? null, neighborhood: (v.fields.neighborhood as string) ?? null,
    exception_order_id: (v.fields.exception_order_id as string) ?? null,
    follow_up_action: (v.fields.follow_up_action as string) ?? null,
    create_time: (v.fields.create_time as string) ?? null,
    eha_inbound_time: (v.fields.eha_inbound_time as string) ?? null,
    resolve_time: (v.fields.resolve_time as string) ?? null,
    dedupe_key: v.dedupe_key,
  }));
  const issues = result.issues.map((i) => ({
    row_number: i.rowNumber, column_name: i.column,
    kind: i.kind, message: i.message, raw: i.raw ?? null,
  }));
  return publishStagedImport({
    module: mod.key,
    rows,
    issues,
    metadata: {
      file_name: opts.fileName,
      file_type: opts.format,
      sheet_name: opts.sheetName,
      total_rows: result.total,
      error_rows: result.errorCount,
      ignored_rows: result.ignoredCount,
      duplicates_in_file: result.dupInFile,
      strategy: opts.strategy,
      append_only: mod.appendOnly ?? false,
      mapping: opts.mapping, headers: opts.headers,
      selected_shifts: opts.avariaOptions?.shifts ?? null,
      include_soc: opts.avariaOptions?.includeSoc ?? null,
      soc_rows: opts.avariaOptions?.found.soc ?? null,
      duration_ms: Math.round(performance.now() - t0),
    },
  });
}

export const headerSignature = (headers: string[]) => headers.map((h) => h.trim().toLowerCase()).sort().join("|");
