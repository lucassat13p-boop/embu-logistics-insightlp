import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const PART_SIZE = 300;

type UploadRow = Record<string, unknown>;
type UploadIssue = { row_number: number; column_name: string | null; kind: string; message: string; raw: unknown };
export type StagedImportResult = { batchId: string; inserted: number; existing: number; updated: number; status: string };

/** Requires the staged import Supabase migration. No records become visible before finalization. */
export async function publishStagedImport(options: {
  module: string;
  metadata: Record<string, unknown>;
  rows: UploadRow[];
  issues: UploadIssue[];
}): Promise<StagedImportResult> {
  const parts: { rows: UploadRow[]; issues: UploadIssue[] }[] = [];
  const total = Math.max(options.rows.length, options.issues.length);
  for (let offset = 0; offset < total; offset += PART_SIZE) {
    parts.push({ rows: options.rows.slice(offset, offset + PART_SIZE), issues: options.issues.slice(offset, offset + PART_SIZE) });
  }
  if (!parts.length) throw new Error("Nenhum registro válido para importar.");
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sessão expirada. Entre novamente.");

  const { data: upload, error: uploadError } = await supabase.from("import_uploads").insert({
    user_id: auth.user.id,
    module: options.module,
    expected_parts: parts.length,
    metadata: { ...options.metadata, valid_rows: options.rows.length, issues_total: options.issues.length } as Json,
  }).select("id").single();
  if (uploadError || !upload) throw new Error(uploadError?.message ?? "Não foi possível iniciar a importação.");
  try {
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      const { error } = await supabase.from("import_upload_parts").insert({
        upload_id: upload.id,
        part_index: index,
        rows: part.rows as Json,
        issues: part.issues as Json,
      });
      if (error) throw new Error(`Falha ao enviar parte ${index + 1}/${parts.length}: ${error.message}`);
    }
    const { data, error } = await supabase.rpc("finalize_staged_import", { p_upload_id: upload.id });
    if (error) throw new Error(error.message);
    const result = data as StagedImportResult | null;
    if (!result || result.batchId !== upload.id || typeof result.inserted !== "number" ||
        typeof result.existing !== "number" || typeof result.updated !== "number" ||
        !["Concluído", "Concluído com avisos"].includes(result.status)) {
      throw new Error("Resultado da importação não confirmado; consulte o histórico antes de repetir.");
    }
    return result;
  } catch (error) {
    // On a network error finalization may have committed: never delete the published batch.
    // Unpublished staging is safe to remove; owner-only RLS prevents cross-user deletion.
    const { data: committed } = await supabase.from("import_batches").select("id").eq("id", upload.id).maybeSingle();
    if (!committed) await supabase.from("import_uploads").delete().eq("id", upload.id);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Não foi possível confirmar a importação: ${message}. Confira o histórico antes de tentar novamente.`);
  }
}
