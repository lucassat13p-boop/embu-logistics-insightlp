import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Panel } from "./blocks";
import { parseFile } from "@/lib/parsers";
import { fmtWall, prepareLhFile, type LhPrepared } from "@/lib/lh-schedule";
import { supabase } from "@/integrations/supabase/client";
import { invalidateImportQueries } from "@/lib/import-cache";

export function LhImport() {
  const qc = useQueryClient();
  const [prep, setPrep] = useState<LhPrepared | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function load(file: File) {
    setFileName(file.name); setPrep(null); setDone(false); setError("");
    if (!/\.xlsx?$/i.test(file.name)) { setError("Este relatório exige um arquivo Excel (.xlsx) com a aba 'LTS PENDENTES A CHEGAR'."); return; }
    setBusy(true);
    try { setPrep(prepareLhFile((await parseFile(file)).sheets)); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!prep || busy) return;
    setBusy(true); setError("");
    const t0 = performance.now();
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada. Entre novamente.");
      const { data: batch, error: bErr } = await supabase.from("import_batches").insert({
        module: "rotas", file_name: fileName, file_type: "xlsx", sheet_name: "LTS PENDENTES A CHEGAR", user_id: u.user.id, user_email: u.user.email ?? null,
        total_rows: prep.rows.length + prep.duplicates, valid_rows: prep.rows.length, duplicate_rows: prep.duplicates, status: "Processando", duplicate_strategy: "update", headers: prep.headers,
      }).select().single();
      if (bErr || !batch) throw new Error(bErr?.message ?? "Falha ao criar a importação.");
      const now = new Date().toISOString();
      const rows = prep.rows.map((r, i) => ({
        module: "rotas", batch_id: batch.id, row_number: i + 2, created_by: u.user!.id, lh: r.lh, route: r.origin, driver_name: r.driver, shift: r.shift,
        record_date: r.scheduledAt?.slice(0, 10) ?? null, record_date_raw: r.scheduledAt, create_time: r.scheduledAt, status: r.arrived ? "Chegou" : "Pendente",
        extra: { plate: r.plate, scheduled_at: r.scheduledAt, arrived_at: r.arrivedAt, orders: r.orders } as never, raw: r as never, dedupe_key: `lh:${r.lh}`, updated_at: now,
      }));
      let failed: string | null = null;
      for (let i = 0; i < rows.length && !failed; i += 500) {
        const { error: e } = await supabase.from("records").upsert(rows.slice(i, i + 500), { onConflict: "module,dedupe_key" });
        if (e) failed = e.message;
      }
      await supabase.from("import_batches").update({ status: failed ? "Erro" : "Concluído", inserted_rows: failed ? 0 : rows.length, duration_ms: Math.round(performance.now() - t0), finished_at: new Date().toISOString() }).eq("id", batch.id);
      if (failed) throw new Error(failed);
      await invalidateImportQueries(qc, { module: "rotas", batchId: batch.id });
      setDone(true); toast.success("Programação de LHs importada.");
    } catch (e) { setError(e instanceof Error ? e.message : "A importação não foi concluída."); }
    finally { setBusy(false); }
  }

  const arrived = prep?.rows.filter((r) => r.arrived).length ?? 0;
  return <div className="space-y-4">
    <Panel title="Arquivo de LHs / Rotas">
      <p className="mb-3 flex items-start gap-2 rounded-md border border-primary/30 bg-primary-soft p-2 text-xs">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span><span className="font-semibold">Formato recomendado: Excel (.xlsx)</span><br /><span className="text-muted-foreground">A programação vem da aba 'LTS PENDENTES A CHEGAR'. As abas 'SPX (Importar)' e 'LHs' são usadas apenas para confirmar chegadas reais.</span></span>
      </p>
      <label className={cn("flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-sm hover:border-primary", busy && "pointer-events-none opacity-50")}>
        <FileUp className="h-5 w-5 text-primary" />
        <span className="truncate">{fileName || "Selecionar arquivo (.xlsx)"}</span>
        <input type="file" className="hidden" accept=".xlsx,.xls" disabled={busy} aria-label="Arquivo de LHs" onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ""; }} />
      </label>
      {busy && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Processando…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </Panel>
    {prep && !done && <Panel title="Prévia da programação" subtitle={`${fileName} · Abas detectadas: ${prep.sheetNames.join(", ")}`}>
      <div className="grid gap-3 sm:grid-cols-3">{[["LHs únicas", prep.rows.length], ["Com chegada confirmada", arrived], ["Linhas repetidas da mesma LH", prep.duplicates]].map(([l, v]) => <div key={l} className="rounded-md border p-3"><p className="text-sm text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-bold tabular-nums">{Number(v).toLocaleString("pt-BR")}</p></div>)}</div>
      {!prep.arrivalSource.length && <p className="mt-2 text-xs text-muted-foreground">Sem abas de chegada no arquivo: todas as LHs ficarão como Pendente.</p>}
      <div className="mt-4 overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted text-left"><tr><th className="p-2">LH</th><th className="p-2">Origem</th><th className="p-2">Previsto</th><th className="p-2">Status</th></tr></thead><tbody>{prep.rows.slice(0, 8).map((r) => <tr key={r.lh} className="border-t"><td className="p-2">{r.lh}</td><td className="p-2">{r.origin ?? "Sem informação"}</td><td className="p-2">{fmtWall(r.scheduledAt)}</td><td className="p-2">{r.arrived ? "Chegou" : "Pendente"}</td></tr>)}</tbody></table></div>
      <div className="mt-4 flex justify-end"><Button disabled={busy} onClick={save}><FileUp className="h-4 w-4" />Confirmar importação</Button></div>
    </Panel>}
    {done && <Panel title="Importação concluída"><p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />{prep?.rows.length} LHs salvas. Reimportar o arquivo atualiza o status das mesmas LHs.</p><Button asChild className="mt-3" variant="outline"><Link to="/m/$slug" params={{ slug: "rotas" }}>Ver LHs / Rotas</Link></Button></Panel>}
  </div>;
}
