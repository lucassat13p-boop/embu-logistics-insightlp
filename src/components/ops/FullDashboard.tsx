import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, Kpi, PageHeader, Panel } from "@/components/ops/blocks";
import { PieBlock } from "@/components/ops/PieBlock";
import { FullLhBoard, LH_NONE } from "./FullLhBoard";
import { supabase } from "@/integrations/supabase/client";
import { HUB_NAME } from "@/lib/modules";
import { formatDateBR } from "@/lib/parsers";
import type { RecordRow } from "@/lib/data";
import { FULL_LMHUB, FULL_LMHUB_MSG, FULL_PENDING, fullFinalStatus, normId } from "@/lib/full-import";

import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { FullStatusPicker } from "./FullStatusPicker";
import { FullBulkDialog } from "./FullBulkDialog";
import { fullBrList, fullManualError } from "@/lib/full-selection";

const PAGE = 50;
const classOf = (r: RecordRow) => r.manual_status?.trim() ? "manual" : fullFinalStatus(r) === FULL_PENDING ? "pending" : "auto";

export function FullDashboard({ allRows }: { allRows: RecordRow[] }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("__all");
  const [dateF, setDateF] = useState("");
  const [shiftF, setShiftF] = useState("__all");
  const [classF, setClassF] = useState("__all");
  const [lhF, setLhF] = useState("__all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  useEffect(() => { setSelected(new Set()); setBulkOpen(false); }, [q, statusF, dateF, shiftF, classF, lhF]);
  useEffect(() => { setSelected((ids) => new Set([...ids].filter((id) => allRows.some((r) => r.id === id)))); }, [allRows]);
  const refreshFull = async () => {
    await qc.invalidateQueries({ predicate: (query) =>
      (query.queryKey[0] === "records" && ["full", "all"].includes(String(query.queryKey[1]))) ||
      (query.queryKey[0] === "search" && ["full", "all"].includes(String(query.queryKey[2]))) });
  };
  async function copyBrs(source: RecordRow[]) {
    const list = fullBrList(source);
    if (!list.length) { toast.info("Nenhum BR disponível para copiar."); return; }
    try { await navigator.clipboard.writeText(list.join("\n")); toast.success(`${list.length} BRs copiados`); }
    catch { setCopyFallback(list); }
  }
  const toggleIds = (ids: string[], checked: boolean) => setSelected((previous) => {
    const next = new Set(previous); ids.forEach((id) => checked ? next.add(id) : next.delete(id)); return next;
  });

  const rows = useMemo(() => allRows.filter((r) =>
    (!dateF || r.record_date === dateF) && (shiftF === "__all" || r.shift === shiftF) &&
    (statusF === "__all" || fullFinalStatus(r) === statusF) &&
    (classF === "__all" || classOf(r) === classF) &&
    (!q || [r.order_id, r.to_number, r.sender_name].some((v) => v?.toLowerCase().includes(q.toLowerCase())))
  ), [allRows, q, statusF, dateF, shiftF, classF]);
  const scoped = useMemo(() => allRows.filter((r) => (!dateF || r.record_date === dateF) && (shiftF === "__all" || r.shift === shiftF)), [allRows, dateF, shiftF]);
  const pendingRows = scoped.filter((r) => classOf(r) === "pending").length;
  const clearFilters = () => { setQ(""); setStatusF("__all"); setClassF("__all"); setPage(0); };

  // Packages counted by unique BR; status per BR uses its first linked row's final status.
  const byBr = useMemo(() => { const m = new Map<string, RecordRow>(); rows.forEach((r) => { const k = normId(r.order_id); if (k && !m.has(k)) m.set(k, r); }); return m; }, [rows]);
  const statusCounts = useMemo(() => { const c = new Map<string, number>(); byBr.forEach((r) => { const s = fullFinalStatus(r); c.set(s, (c.get(s) ?? 0) + 1); }); return [...c].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value); }, [byBr]);
  const allStatuses = useMemo(() => [...new Set(allRows.map(fullFinalStatus))].sort(), [allRows]);
  const dates = useMemo(() => [...new Set(allRows.map((r) => r.record_date).filter(Boolean) as string[])].sort().reverse(), [allRows]);
  const pending = [...byBr.values()].filter((r) => fullFinalStatus(r) === FULL_PENDING).length;

  async function save(v: string | null) {
    if (!editing || savingLock.current) return;
    if (v !== null) { const error = fullManualError(v); if (error) { toast.error(error); return; } }
    savingLock.current = true; setSaving(true);
    try {
      const { data: u, error: authError } = await supabase.auth.getUser();
      if (authError || !u.user) throw new Error("Sessão expirada. Entre novamente.");
      const { data, error } = await supabase.from("records").update({ manual_status: v, manual_status_by: v ? u.user.id : null, manual_status_at: v ? new Date().toISOString() : null }).eq("id", editing.id).eq("module", "full").select("id");
      if (error) throw error;
      if (data?.length !== 1) throw new Error("Registro não encontrado ou sem permissão para editar.");
      toast.success(v ? "Classificação salva." : "Classificação removida; regra automática restaurada.");
      setEditing(null); await refreshFull();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar a classificação."); }
    finally { savingLock.current = false; setSaving(false); }
  }

  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE) - 1));
  const slice = rows.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const pageChecked = slice.length > 0 && slice.every((r) => selected.has(r.id));
  const pagePartial = !pageChecked && slice.some((r) => selected.has(r.id));
  return (
    <div className="space-y-5">
      <PageHeader title="FULL" subtitle={`${HUB_NAME} · Justificativa FULL`} action={<Button asChild><Link to="/importar" search={{ modulo: "full" }}><Upload className="mr-1 h-4 w-4" />Importar relatório FULL</Link></Button>} />
      <div className="flex flex-wrap items-end gap-3">
        <div><p className="text-xs text-muted-foreground">Data</p><Select value={dateF || "__all"} onValueChange={(v) => { setDateF(v === "__all" ? "" : v); setPage(0); }}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all">Todas</SelectItem>{dates.map((d) => <SelectItem key={d} value={d}>{formatDateBR(d)}</SelectItem>)}</SelectContent></Select></div>
        <div><p className="text-xs text-muted-foreground">Turno</p><Select value={shiftF} onValueChange={(v) => { setShiftF(v); setPage(0); }}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all">Todos</SelectItem>{["AM1", "AM2", "PM1"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
        <div><p className="text-xs text-muted-foreground">Status final</p><Select value={statusF} onValueChange={(v) => { setStatusF(v); setPage(0); }}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all">Todos</SelectItem>{allStatuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
        <div><p className="text-xs text-muted-foreground">Classificação</p><Select value={classF} onValueChange={(v) => { setClassF(v); setPage(0); }}><SelectTrigger className="w-60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all">Todos</SelectItem><SelectItem value="pending">Pendentes de classificação</SelectItem><SelectItem value="auto">Classificados automaticamente</SelectItem><SelectItem value="manual">Classificados manualmente</SelectItem></SelectContent></Select></div>
        <Input className="w-64" placeholder="Buscar Pedido/BR, TO Number ou Sender Name" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <Button variant={classF === "pending" ? "default" : "outline"} onClick={() => { setClassF(classF === "pending" ? "__all" : "pending"); setPage(0); }}>Pendentes de classificação ({pendingRows})</Button>
        <Button variant="ghost" onClick={clearFilters}>Limpar filtros</Button>
      </div>

      {!allRows.length ? <div className="rounded-lg border border-dashed bg-card p-6"><Empty hint="Importe um relatório FULL para visualizar os indicadores." /></div> : <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi accent label="Pacotes (BR único)" value={byBr.size} />
          <Kpi label="TOs distintas" value={new Set(rows.map((r) => r.to_number).filter(Boolean)).size} />
          <Kpi label="Pendentes de classificação" value={pending} />
        </div>
        <Panel title="Pacotes por status final"><BarBlock data={statusCounts} horizontal yAxisWidth={170} valueName="Pacotes" /></Panel>
        <Panel title="Registros FULL" subtitle={`${rows.length} resultados`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => void copyBrs(rows)}><Copy className="mr-1 h-4 w-4" />Copiar BRs filtrados</Button>
            <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>Selecionar todos os resultados filtrados ({rows.length})</Button>
            {selectedRows.length > 0 && <>
              <span className="text-sm">{selectedRows.length} registros · {fullBrList(selectedRows).length} BRs únicos selecionados</span>
              <Button size="sm" onClick={() => setBulkOpen(true)}>Classificar selecionados</Button>
              <Button size="sm" variant="outline" onClick={() => void copyBrs(selectedRows)}><Copy className="mr-1 h-4 w-4" />Copiar BRs selecionados</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
            </>}
          </div>
          {!rows.length ? <Empty /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="w-10 py-2"><Checkbox aria-label="Selecionar página atual" checked={pagePartial ? "indeterminate" : pageChecked} onCheckedChange={(v) => toggleIds(slice.map((r) => r.id), v === true)} /></th><th className="py-2">TO Number</th><th>Pedido/BR</th><th>Sender Name</th><th>Status final</th><th>Status original</th><th>Pendência</th><th /></tr></thead>
            <tbody>{slice.map((r) => { const fs = fullFinalStatus(r); const isLmhub = r.br_status === FULL_LMHUB; const issue = r.status_issue ?? (isLmhub ? FULL_LMHUB_MSG : null); return (
              <tr key={r.id} className="border-t">
                <td><Checkbox aria-label={`Selecionar ${r.order_id ?? "registro"} TO ${r.to_number ?? "sem TO"}`} checked={selected.has(r.id)} onCheckedChange={(v) => toggleIds([r.id], v === true)} /></td>
                <td className="py-1.5">{r.to_number ?? "—"}</td><td className="font-medium">{r.order_id}</td><td>{r.sender_name ?? "—"}</td>
                <td className={fs === FULL_PENDING ? "font-semibold text-destructive" : "font-semibold"}>{fs}{r.manual_status && fs !== FULL_PENDING && <span className="ml-1 text-xs font-normal text-muted-foreground">(manual)</span>}</td>
                <td className="text-muted-foreground">{r.br_status ?? "Sem informação"}</td>
                <td className="text-xs text-muted-foreground">{issue ?? "—"}</td>
                <td>{(issue || r.manual_status || fs === FULL_PENDING) && <Button size="sm" variant="outline" onClick={() => { setEditing(r); setValue(r.manual_status ?? ""); }}>{r.manual_status ? "Editar" : "Classificar"}</Button>}</td>
              </tr>); })}</tbody>
          </table>
          <div className="mt-3 flex items-center justify-end gap-2 text-xs"><Button size="sm" variant="outline" disabled={!safePage} onClick={() => setPage(safePage - 1)}>Anterior</Button><span>{safePage + 1} / {Math.max(1, Math.ceil(rows.length / PAGE))}</span><Button size="sm" variant="outline" disabled={(safePage + 1) * PAGE >= rows.length} onClick={() => setPage(safePage + 1)}>Próxima</Button></div></div>}
        </Panel>
      </>}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o && !saving) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Classificação manual · {editing?.order_id}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Status original: {editing?.br_status ?? "Sem informação"} · {editing?.status_issue ?? (editing?.br_status === FULL_LMHUB ? FULL_LMHUB_MSG : "—")}</p>
          {editing?.br_status === FULL_LMHUB && <p className="rounded-md border border-primary/40 bg-primary/5 p-2 text-sm">{FULL_LMHUB_MSG} (ex.: Avaria, Reversa, Pacote Retirado).</p>}
          <FullStatusPicker value={value} onChange={setValue} disabled={saving} />
          {editing?.br_status && editing.br_status !== FULL_LMHUB && <Button variant="outline" size="sm" className="self-start" onClick={() => setValue(editing.br_status ?? "")}>Usar status original: {editing.br_status}</Button>}
          <div className="flex justify-between gap-2">
            {editing?.manual_status ? <Button disabled={saving} variant="ghost" onClick={() => save(null)}>Remover classificação</Button> : <span />}
            <Button disabled={saving || !!fullManualError(value)} onClick={() => save(value.trim())}>{saving ? "Salvando…" : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {bulkOpen && selectedRows.length > 0 && <FullBulkDialog allRows={allRows} selected={new Set(selectedRows.map((r) => r.id))} onClose={() => setBulkOpen(false)} onSaved={async () => { setSelected(new Set()); await refreshFull(); }} />}
      <Dialog open={copyFallback !== null} onOpenChange={(open) => { if (!open) setCopyFallback(null); }}><DialogContent><DialogHeader><DialogTitle>Copiar BRs · {copyFallback?.length ?? 0} BRs</DialogTitle></DialogHeader><Textarea aria-label="Lista de BRs para cópia manual" readOnly value={copyFallback?.join("\n") ?? ""} className="h-72 font-mono" onFocus={(e) => e.currentTarget.select()} /><Button variant="outline" onClick={() => setCopyFallback(null)}>Fechar</Button></DialogContent></Dialog>
    </div>
  );
}
