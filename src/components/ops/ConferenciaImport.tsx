import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "./blocks";
import { parseFile } from "@/lib/parsers";
import { prepareAudit, type AuditPrepared } from "@/lib/conferencia";
import { supabase } from "@/integrations/supabase/client";
import { invalidateImportQueries } from "@/lib/import-cache";

export function ConferenciaImport() {
  const qc = useQueryClient();
  const [prep, setPrep] = useState<AuditPrepared | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ inserted: number; updated: number; ignored: number } | null>(null);
  async function load(file: File) {
    setPrep(null); setDone(null); setError(""); setName(file.name);
    if (!/\.csv$/i.test(file.name)) { setError("Selecione o relatório de auditoria em CSV (.csv)."); return; }
    setBusy(true);
    try { const parsed = await parseFile(file); const sheet = parsed.sheets[0]; if (!sheet) throw new Error("Arquivo vazio."); setPrep(prepareAudit(sheet)); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o CSV."); } finally { setBusy(false); }
  }
  async function save() {
    if (!prep || busy) return;
    setBusy(true); setError("");
    try {
      const { data, error: failure } = await supabase.rpc("import_conferencia", { p_rows: JSON.parse(JSON.stringify(prep.rows)), p_file_name: name, p_headers: prep.headers, p_ignored: prep.ignored });
      if (failure) throw failure;
      const result = data as { batchId: string; inserted: number; updated: number; ignored: number };
      await invalidateImportQueries(qc, { module: "conferencia", batchId: result.batchId }); setDone(result); toast.success("Relatório de Conferência importado.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a importação."); } finally { setBusy(false); }
  }
  return <div className="space-y-4"><Panel title="Arquivo de Conferência"><p className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary-soft p-3 text-sm"><Info className="h-4 w-4 shrink-0 text-primary" />Formato recomendado: CSV (.csv) — auditoria de rotas/ATs</p><label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-sm"><FileUp className="h-5 w-5 text-primary" /><span className="min-w-0 truncate">{name || "Selecionar arquivo (.csv)"}</span><input className="hidden" type="file" accept=".csv" aria-label="Relatório CSV de Conferência" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void load(file); e.target.value = ""; }} /></label>{busy && <p className="mt-3 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Processando…</p>}{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</Panel>
    {prep && !done && <Panel title="Prévia das conferências" subtitle={`${prep.rows.length} registros válidos · ${prep.ignored} ignorados no arquivo`}><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">AT/TO</th><th className="p-2">Data operacional</th><th className="p-2">Turno</th><th className="p-2">Colaborador</th></tr></thead><tbody>{prep.rows.slice(0, 8).map((r) => <tr key={r.dedupe_key} className="border-b"><td className="p-2 whitespace-nowrap">{r.route}</td><td className="p-2">{r.record_date?.split("-").reverse().join("/") ?? "Sem informação"}</td><td className="p-2">{r.shift}</td><td className="p-2">{r.collaborator ?? "Sem informação"}</td></tr>)}</tbody></table></div>{prep.warnings.length > 0 && <details className="mt-3 text-sm text-muted-foreground"><summary>{prep.warnings.length} avisos de leitura</summary>{prep.warnings.map((w) => <p key={w}>{w}</p>)}</details>}<div className="mt-4 flex justify-end"><Button disabled={busy || !prep.rows.length} onClick={save}><FileUp className="h-4 w-4" />Confirmar importação</Button></div></Panel>}
    {done && <Panel title="Importação concluída"><p className="text-sm">{done.inserted} importados · {done.updated} atualizados · {done.ignored} ignorados</p><Button asChild variant="outline" className="mt-3"><Link to="/m/$slug" params={{ slug: "conferencia" }}>Ver Conferência</Link></Button></Panel>}
  </div>;
}