import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Panel } from "./blocks";
import { parseFile } from "@/lib/parsers";
import { fetchFloatingActive, floatingDiff, prepareFloatingFile } from "@/lib/floating-packages";
import { supabase } from "@/integrations/supabase/client";
import { invalidateImportQueries } from "@/lib/import-cache";

export function FloatingImport() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<ReturnType<typeof prepareFloatingFile> | null>(null);
  const [previous, setPrevious] = useState<Awaited<ReturnType<typeof fetchFloatingActive>> | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const diff = preview && previous ? floatingDiff(previous.rows, preview.rows) : null;
  async function load(file: File) {
    setBusy(true); setPreview(null); setPrevious(null); setDone(false); setError(""); setFileName(file.name);
    try {
      const prepared = prepareFloatingFile(await parseFile(file));
      const active = await fetchFloatingActive();
      setPrevious(active); setPreview(prepared);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo. A base atual foi preservada."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!preview || !previous || busy) return;
    setBusy(true); setError("");
    try {
      // Generated RPC types omit SQL parameter nullability; null means no prior snapshot.
      const { data, error: saveError } = await supabase.rpc("replace_floating_snapshot", { p_rows: preview.rows, p_file_name: fileName, p_sheet_name: preview.sheetName, p_expected_batch: previous.batchId as string, p_headers: preview.headers });
      if (saveError) throw saveError;
      const batchId = data && typeof data === "object" && !Array.isArray(data) && typeof data.batchId === "string" ? data.batchId : null;
      if (!batchId) throw new Error("Não foi possível confirmar a atualização.");
      await invalidateImportQueries(qc, { module: "pacotes_flutuantes", batchId });
      setDone(true); toast.success("Lista ativa de Pacotes Flutuantes atualizada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "A atualização não foi concluída. A base anterior foi preservada.");
      try { setPrevious(await fetchFloatingActive()); } catch { setPrevious(null); }
    } finally { setBusy(false); setConfirm(false); }
  }
  return <div className="space-y-4"><Panel title="Arquivo de Pacotes Flutuantes">
    <p className="mb-3 text-sm text-muted-foreground">Excel (.xlsx) · Aba Perdidos · Lista completa e atual</p>
    <Input type="file" accept=".xlsx" disabled={busy} aria-label="Arquivo de Pacotes Flutuantes" onChange={(event) => { const file = event.target.files?.[0]; if (file) void load(file); event.target.value = ""; }} />
    {busy && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Processando…</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </Panel>
  {preview && diff && !done && <Panel title="Resumo da atualização" subtitle={`${fileName} · ${preview.sheetName}`}>
    <div className="grid gap-3 sm:grid-cols-3">{[["Novos", diff.new], ["Permanecem", diff.remain], ["Saem da lista", diff.leave]].map(([label, value]) => <div key={label} className="rounded-md border p-3"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{Number(value).toLocaleString("pt-BR")}</p></div>)}</div>
    <p className="mt-3 text-sm">{preview.rows.length.toLocaleString("pt-BR")} pacotes na nova lista ativa.</p>
    {preview.missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Colunas não informadas: {preview.missing.join(", ")}.</p>}
    {(preview.invalidDates > 0 || preview.invalidValues > 0) && <p className="mt-2 text-xs text-muted-foreground">Datas inválidas: {preview.invalidDates} · Valores inválidos: {preview.invalidValues}. Permanecem como não informados.</p>}
    {preview.duplicates > 0 && <p className="mt-2 text-xs text-muted-foreground">Linhas repetidas idênticas ignoradas: {preview.duplicates}.</p>}
    <div className="mt-4 overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-2">BR</th><th className="p-2">Data</th><th className="p-2">Motorista</th><th className="p-2">Cluster</th></tr></thead><tbody>{preview.rows.slice(0, 8).map((row) => <tr key={row.order_id} className="border-t"><td className="p-2">{row.order_id}</td><td className="p-2">{row.record_date?.split("-").reverse().join("/") ?? "Sem informação"}</td><td className="p-2">{row.driver_name ?? "Sem informação"}</td><td className="p-2">{row.route ?? "Sem informação"}</td></tr>)}</tbody></table></div>
    <div className="mt-4 flex justify-end"><Button disabled={busy} onClick={() => setConfirm(true)}><FileUp className="h-4 w-4" />Confirmar atualização</Button></div>
  </Panel>}
  {done && <div className="flex flex-wrap items-center gap-3 rounded-md border border-success/40 bg-success/10 p-4"><CheckCircle2 className="h-5 w-5 text-success" /><p className="flex-1 text-sm font-semibold">Lista ativa atualizada com sucesso.</p><Button asChild><Link to="/m/$slug" params={{ slug: "pacotes-flutuantes" }}>Abrir Pacotes Flutuantes</Link></Button></div>}
  <AlertDialog open={confirm} onOpenChange={(open) => { if (!busy) setConfirm(open); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Substituir a lista ativa?</AlertDialogTitle><AlertDialogDescription>Novos: {diff?.new} · Permanecem: {diff?.remain} · Saem da lista: {diff?.leave}. Os dados dos pacotes que permanecem serão atualizados. A lista anterior ficará somente no histórico técnico.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); void save(); }}>{busy ? "Atualizando…" : "Aplicar nova base completa"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
