// FULL import: base = "2 - Exportar TO em LOTE"; status source = "3 - Exportar BR em LOTE" (BR → Status only).
import { supabase } from "@/integrations/supabase/client";
import { cellText } from "./parsers";
import { normalizeHeader } from "./modules";
import { displayHubShift } from "./shifts";

export type FullBaseField = "to_number" | "order_id" | "sender_name";
export type FullStatusField = "match_br" | "br_status";
export type FullBaseMapping = Record<string, FullBaseField | "">;
export type FullStatusMapping = Record<string, FullStatusField | "">;

export const FULL_BASE_LABELS: Record<FullBaseField, string> = { to_number: "TO Number", order_id: "Pedido/BR", sender_name: "Sender Name" };
export const FULL_STATUS_LABELS: Record<FullStatusField, string> = { match_br: "BR para cruzamento", br_status: "Status do BR" };
// "LMHub_Received" is never a final status: the package arrived at the HUB and needs a justification for not leaving.
export const FULL_AUTO_STATUSES = ["Delivered", "Delivering", "OnHold", "LMHub_Assigning", "Return_LMHub_Received", "SOC_LHTransported"] as const;
export const FULL_PENDING = "Pendente de classificação";
export const FULL_LMHUB = "LMHub_Received";
export const FULL_LMHUB_MSG = "Informe por que este pacote recebido no HUB não saiu";

const BASE_ALIASES: Record<string, FullBaseField> = { "to number": "to_number", "spx tracking number": "order_id", "sender name": "sender_name" };
// "TO Status" is the TO status, never the package status — only an exact "Status" header is suggested.
const STATUS_ALIASES: Record<string, FullStatusField> = { "order id": "match_br", status: "br_status" };

export const normId = (v: unknown) => (cellText(v) ?? "").replace(/\s+/g, "").toUpperCase();
const normStatus = (v: string) => v.trim().replace(/\s+/g, "_").toLowerCase();
const cleanSheetText = (v: unknown) => {
  const s = cellText(v)?.replace(/^\uFEFF+/, "").trim();
  return s ? s : null;
};
const LH_HEADERS = new Set(["lh", "lhs", "lh s", "lh number", "lh trip", "lh trip number", "codigo lh", "codigo da lh", "linehaul", "line haul"]);
const TO_HEADERS = new Set(["to", "tos", "to s", "to's", "to number", "codigo to", "codigo da to", "codigo do to"]);
const isPlaceholder = (s: string) => s === "-" || s === "—" || s === "–";
const isLhHeader = (s: string) => isPlaceholder(s) || LH_HEADERS.has(normalizeHeader(s));
const isToHeader = (s: string) => isPlaceholder(s) || TO_HEADERS.has(normalizeHeader(s));

const asRecord = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Resolve real LH from a FULL record (lh column first, then real LH fields in extra/raw if present). Never fabricates links. */
export function resolveFullLh(r: { lh?: string | null; extra?: unknown; raw?: unknown }): string | null {
  const direct = cleanSheetText(r.lh);
  if (direct && !isLhHeader(direct)) return direct;
  const extra = asRecord(r.extra);
  if (extra) {
    for (const key of ["lh", "lh_code", "lh_number", "linehaul"]) {
      const val = cleanSheetText(extra[key]);
      if (val && !isLhHeader(val)) return val;
    }
  }
  const raw = asRecord(r.raw);
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      if (!LH_HEADERS.has(normalizeHeader(k))) continue;
      const val = cleanSheetText(v);
      if (val && !isLhHeader(val)) return val;
    }
  }
  return null;
}

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
  br_status: string | null; status_issue: string | null; key: string; lh: string | null; raw: Record<string, unknown>;
};
export type FullBuild = { rows: FullRow[]; total: number; missingBr: number; dupInFile: number; pending: number; conflicts: number; uniqueBr: number; withoutLh: number };

export type LhLink = { lh: string; to: string };
export type LhParse = { lh: string | null; lhs: string[]; tos: string[]; links: LhLink[] };
/** Aba "1 - TOs": coluna A = LH, coluna C = TOs. Vincula somente linhas que trazem LH e TO reais na mesma linha, sem preencher células vazias. */
export function parseLhSheet(rows: unknown[][]): LhParse {
  const seenLhs = new Set<string>();
  const seenTos = new Set<string>();
  const lhs: string[] = [];
  const tos: string[] = [];
  const links: LhLink[] = [];
  for (const r of rows) {
    const rawA = cleanSheetText(r?.[0]);
    const rawC = cleanSheetText(r?.[2]);
    const to = rawC && !isToHeader(rawC) ? rawC : null;
    const lhCandidate = rawA && !isLhHeader(rawA) ? rawA : null;
    const lh = lhCandidate && (!to || normId(lhCandidate) !== normId(to)) ? lhCandidate : null;
    if (lh) {
      const lk = normId(lh);
      if (lk && !seenLhs.has(lk)) { seenLhs.add(lk); lhs.push(lh); }
    }
    if (to) {
      const tk = normId(to);
      if (tk && !seenTos.has(tk)) { seenTos.add(tk); tos.push(to); }
    }
    if (lh && to) links.push({ lh, to });
  }
  return { lh: lhs[0] ?? null, lhs, tos, links };
}

/** Índice TO normalizada → LH. Conflito (mesma TO em LHs diferentes) mantém a primeira e é reportado. */
export function buildLhIndex(parse: LhParse | null): { map: Map<string, string>; conflicts: number } {
  const map = new Map<string, string>(); let conflicts = 0;
  if (!parse?.links.length) return { map, conflicts };
  for (const { lh, to } of parse.links) {
    const k = normId(to);
    if (!k) continue;
    const existing = map.get(k);
    if (existing && normId(existing) !== normId(lh)) { conflicts++; continue; }
    if (!existing) map.set(k, lh);
  }
  return { map, conflicts };
}

export function buildFullRows(base: Body, mapping: FullBaseMapping, status: Map<string, Set<string>>, lhByTo?: Map<string, string>): FullBuild {
  const brCol = colOf(mapping, "order_id"), toCol = colOf(mapping, "to_number"), snCol = colOf(mapping, "sender_name");
  const rows: FullRow[] = []; const seen = new Set<string>();
  let total = 0, missingBr = 0, dupInFile = 0, pending = 0, conflicts = 0, withoutLh = 0;
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
    const lh = to && lhByTo ? lhByTo.get(normId(to)) ?? null : null;
    if (lhByTo && !lh) withoutLh++;
    rows.push({ rowNumber: r.rowNumber, to_number: to, order_id: br, sender_name: snCol ? cellText(r.values[snCol]) : null, br_status, status_issue: issue, key, lh, raw: r.values });
  }
  return { rows, total, missingBr, dupInFile, pending, conflicts, withoutLh, uniqueBr: new Set(rows.map((x) => normId(x.order_id))).size };
}

/** Final status: manual classification wins (unless it just repeats LMHub_Received); otherwise recognized automatic status; otherwise pending. */
export function fullFinalStatus(r: { manual_status?: string | null; br_status?: string | null; status_issue?: string | null }) {
  const manual = r.manual_status?.trim();
  if (manual && normStatus(manual) !== normStatus(FULL_LMHUB)) return manual;
  // LMHub_Received is never final, even for rows imported before this rule (status_issue may be empty).
  if (r.br_status && normStatus(r.br_status) === normStatus(FULL_LMHUB)) return FULL_PENDING;
  // A recognized status wins even over "Status não reconhecido automaticamente" stored by older imports.
  const auto = autoStatus(r.br_status ?? null);
  if (auto) return auto;
  if (!r.status_issue) return r.br_status ?? FULL_PENDING;
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
  const user = u.user;
  const shift = displayHubShift(o.shift);
  const keys = o.build.rows.map((r) => fullDedupeKey(o.date, o.shift, r.key));
  const existing = await countFullExisting(keys);
  const { data: batch, error: bErr } = await supabase.from("import_batches").insert({
    module: "full", file_name: o.fileName, file_type: o.format, sheet_name: o.sheetName, user_id: u.user.id, user_email: u.user.email ?? null,
    total_rows: o.build.total, valid_rows: o.build.rows.length, error_rows: o.build.missingBr, ignored_rows: 0, duplicate_rows: o.build.dupInFile + existing,
    status: "Processando", duplicate_strategy: o.strategy, mapping: o.mapping as never, headers: o.headers,
    selected_shifts: shift ? [shift] : null,
  }).select().single();
  if (bErr || !batch) throw new Error(bErr?.message ?? "Falha ao criar lote");
  let failed: string | null = null;
  try {
    // manual_status is never sent, so re-imports keep manual classifications.
    const rows = o.build.rows.map((r) => ({
      module: "full", batch_id: batch.id, row_number: r.rowNumber, created_by: user.id,
      record_date: o.date, record_date_raw: o.date, shift, order_id: r.order_id, to_number: r.to_number, sender_name: r.sender_name,
      status: r.br_status, br_status: r.br_status, status_issue: r.status_issue, lh: r.lh, raw: r.raw as never, extra: { hub_shift: { version: 1, original: o.shift } } as never,
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
