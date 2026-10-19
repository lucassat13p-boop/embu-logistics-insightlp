// FULL import: base = "2 - Exportar TO em LOTE"; status source = "3 - Exportar BR em LOTE" (BR → Status only).
import { supabase } from "@/integrations/supabase/client";
import { cellText } from "./parsers";
import { normalizeHeader } from "./modules";

export type FullBaseField = "to_number" | "order_id" | "sender_name";
export type FullStatusField = "match_br" | "br_status";
export type FullBaseMapping = Record<string, FullBaseField | "">;
export type FullStatusMapping = Record<string, FullStatusField | "">;

export const FULL_BASE_LABELS: Record<FullBaseField, string> = { to_number: "TO Number", order_id: "Pedido/BR", sender_name: "Sender Name" };
export const FULL_STATUS_LABELS: Record<FullStatusField, string> = { match_br: "BR para cruzamento", br_status: "Status do BR" };
// "LMHub_Received" is never a final status: the package arrived at the HUB and needs a justification for not leaving.
export const FULL_AUTO_STATUSES = ["Delivered", "Delivering", "OnHold", "Return_LMHub_Received", "SOC_LHTransported"] as const;
export const FULL_PENDING = "Pendente de classificação";
export const FULL_LMHUB = "LMHub_Received";
export const FULL_LMHUB_MSG = "Informe por que este pacote recebido no HUB não saiu";

const BASE_ALIASES: Record<string, FullBaseField> = { "to number": "to_number", "spx tracking number": "order_id", "sender name": "sender_name" };
// "TO Status" is the TO status, never the package status — only an exact "Status" header is suggested.
const STATUS_ALIASES: Record<string, FullStatusField> = { "order id": "match_br", status: "br_status" };

export const normId = (v: unknown) => (cellText(v) ?? "").replace(/\s+/g, "").toUpperCase();
const normStatus = (v: string) => v.trim().replace(/\s+/g, "_").toLowerCase();

export function suggestFullBase(headers: string[]): FullBaseMapping {
  const used = new Set<string>();
  return Object.fromEntries(headers.map((h) => { const f = BASE_ALIASES[normalizeHeader(h)]; if (f && !used.has(f)) { used.add(f); return [h, f]; } return [h, ""]; }));
}
export function suggestFullStatus(headers: string[]): FullStatusMapping {
  const used = new Set<string>();
  return Object.fromEntries(headers.map((h) => { const f = STATUS_ALIASES[normalizeHeader(h)]; if (f && !used.has(f)) { used.add(f); return [h, f]; } return [h, ""]; }));
}

export function autoStatus(raw: string | null): string | null {
  if (!raw) return null;
  return FULL_AUTO_STATUSES.find((s) => normStatus(s) === normStatus(raw)) ?? null;
}

type Body = { rowNumber: number; values: Record<string, unknown>; empty: boolean }[];
const colOf = (m: Record<string, string>, f: string) => Object.entries(m).find(([, v]) => v === f)?.[0];

export function buildStatusIndex(body: Body, mapping: FullStatusMapping) {
  const br = colOf(mapping, "match_br"), st = colOf(mapping, "br_status");
  const idx = new Map<string, Set<string>>();
  if (!br || !st) return idx;
  for (const r of body) {
    if (r.empty) continue;
    const id = normId(r.values[br]);
    if (!id) continue;
    const s = cellText(r.values[st]) ?? "";
    if (!idx.has(id)) idx.set(id, new Set());
    idx.get(id)!.add(s);
  }
  return idx;
}

export type FullRow = {
  rowNumber: number; to_number: string | null; order_id: string; sender_name: string | null;
  br_status: string | null; status_issue: string | null; key: string; raw: Record<string, unknown>;
};
export type FullBuild = { rows: FullRow[]; total: number; missingBr: number; dupInFile: number; pending: number; conflicts: number; uniqueBr: number };

export function buildFullRows(base: Body, mapping: FullBaseMapping, status: Map<string, Set<string>>): FullBuild {
  const brCol = colOf(mapping, "order_id"), toCol = colOf(mapping, "to_number"), snCol = colOf(mapping, "sender_name");
  const rows: FullRow[] = []; const seen = new Set<string>();
  let total = 0, missingBr = 0, dupInFile = 0, pending = 0, conflicts = 0;
  for (const r of base) {
    if (r.empty) continue;
    total++;
    const br = brCol ? cellText(r.values[brCol]) : null;
    if (!br) { missingBr++; continue; }
    const to = toCol ? cellText(r.values[toCol]) : null;
    const key = `${normId(br)}|${normId(to)}`;
    if (seen.has(key)) { dupInFile++; continue; }
    seen.add(key);
    const found = status.get(normId(br));
    let br_status: string | null = null, issue: string | null = null;
    if (!found) issue = "BR não encontrado na fonte de status";
    else {
      const vals = [...found].filter(Boolean);
      if (vals.length > 1) { issue = `Status conflitantes: ${vals.join(" / ")}`; conflicts++; }
      else if (!vals.length) issue = "Status vazio na fonte de status";
      else { br_status = vals[0]; if (normStatus(br_status) === normStatus(FULL_LMHUB)) issue = FULL_LMHUB_MSG; else if (!autoStatus(br_status)) issue = "Status não reconhecido automaticamente"; }
    }
    if (issue) pending++;
    rows.push({ rowNumber: r.rowNumber, to_number: to, order_id: br, sender_name: snCol ? cellText(r.values[snCol]) : null, br_status, status_issue: issue, key, raw: r.values });
  }
  return { rows, total, missingBr, dupInFile, pending, conflicts, uniqueBr: new Set(rows.map((x) => normId(x.order_id))).size };
}

/** Final status: manual classification wins (unless it just repeats LMHub_Received); otherwise recognized automatic status; otherwise pending. */
export function fullFinalStatus(r: { manual_status?: string | null; br_status?: string | null; status_issue?: string | null }) {
  const manual = r.manual_status?.trim();
  if (manual && normStatus(manual) !== normStatus(FULL_LMHUB)) return manual;
  // LMHub_Received is never final, even for rows imported before this rule (status_issue may be empty).
  if (r.br_status && normStatus(r.br_status) === normStatus(FULL_LMHUB)) return FULL_PENDING;
  if (!r.status_issue) return autoStatus(r.br_status ?? null) ?? r.br_status ?? FULL_PENDING;
  return FULL_PENDING;
}

export const fullDedupeKey = (date: string | null, shift: string | null, key: string) => `${date ?? ""}|${shift ?? ""}|${key}`;

export async function countFullExisting(keys: string[]) {
  let n = 0;
  for (let i = 0; i < keys.length; i += 200) {
    const { count } = await supabase.from("records").select("id", { count: "exact", head: true }).eq("module", "full").in("dedupe_key", keys.slice(i, i + 200));
    n += count ?? 0;
  }
  return n;
}

export async function commitFullImport(o: {
  build: FullBuild; date: string | null; shift: string | null; strategy: "ignore" | "update";
  fileName: string; format: string; sheetName: string; headers: string[]; mapping: unknown;
}) {
  const t0 = performance.now();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada. Entre novamente.");
  const keys = o.build.rows.map((r) => fullDedupeKey(o.date, o.shift, r.key));
  const existing = await countFullExisting(keys);
  const { data: batch, error: bErr } = await supabase.from("import_batches").insert({
    module: "full", file_name: o.fileName, file_type: o.format, sheet_name: o.sheetName, user_id: u.user.id, user_email: u.user.email ?? null,
    total_rows: o.build.total, valid_rows: o.build.rows.length, error_rows: o.build.missingBr, ignored_rows: 0, duplicate_rows: o.build.dupInFile + existing,
    status: "Processando", duplicate_strategy: o.strategy, mapping: o.mapping as never, headers: o.headers,
    selected_shifts: o.shift ? [o.shift] : null,
  }).select().single();
  if (bErr || !batch) throw new Error(bErr?.message ?? "Falha ao criar lote");
  let failed: string | null = null;
  try {
    // manual_status is never sent, so re-imports keep manual classifications.
    const rows = o.build.rows.map((r) => ({
      module: "full", batch_id: batch.id, row_number: r.rowNumber, created_by: u.user!.id,
      record_date: o.date, record_date_raw: o.date, shift: o.shift, order_id: r.order_id, to_number: r.to_number, sender_name: r.sender_name,
      status: r.br_status, br_status: r.br_status, status_issue: r.status_issue, raw: r.raw as never, extra: {} as never,
      dedupe_key: fullDedupeKey(o.date, o.shift, r.key), updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("records").upsert(rows.slice(i, i + 500), { onConflict: "module,dedupe_key", ignoreDuplicates: o.strategy === "ignore" });
      if (error) throw error;
    }
  } catch (e) { failed = e instanceof Error ? e.message : String(e); }
  const inserted = Math.max(0, o.build.rows.length - existing);
  const status = failed ? "Erro" : o.build.missingBr || o.build.dupInFile || existing || o.build.pending ? "Concluído com avisos" : "Concluído";
  await supabase.from("import_batches").update({ status, duration_ms: Math.round(performance.now() - t0), finished_at: new Date().toISOString(), inserted_rows: failed ? 0 : inserted, updated_rows: failed || o.strategy === "ignore" ? 0 : existing }).eq("id", batch.id);
  if (failed) throw new Error(failed);
  return { batchId: batch.id, inserted, existing, status };
}
