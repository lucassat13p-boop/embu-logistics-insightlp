import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Save, Trash2, PackageX, TriangleAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Panel } from "./blocks";
import { currentSystemDate } from "@/lib/period";
import { DASH_SHIFTS, type DashShift, type Range } from "@/lib/main-dashboard";
import { formatMissorted, missortedQuery, missortedResult, missortedTargetQuery, validMissortedCounts, type MissortedEntry } from "@/lib/missorted";

type Form = { id?: string; date: string; shift: string; incorrect: string; processed: string };

export function MissortedCard({ range, shifts }: { range: Range | null; shifts: DashShift[] }) {
  const entries = useQuery(missortedQuery());
  const target = useQuery(missortedTargetQuery());
  const [open, setOpen] = useState(false);
  const filtered = range ? (entries.data ?? []).filter((row) => row.operation_date >= range.start && row.operation_date <= range.end && (!shifts.length || shifts.includes(row.shift as DashShift))) : [];
  const result = missortedResult(filtered, target.data ?? 0.68);
  const unavailable = entries.isError || target.isError || entries.isLoading || target.isLoading;
  const percent = unavailable ? null : result.percent;
  const tone = percent === null ? "neutral" : result.above ? "red" : "green";
  return <>
    <div className={`summary-tone-${tone} missorted-summary-card h-full min-w-0`}>
      <Button variant="ghost" className="summary-metric missorted-metric w-full text-left whitespace-normal font-normal" onClick={() => setOpen(true)} aria-label="Consultar e lançar MISSORTED">
        <div className="summary-metric-heading w-full"><span className="summary-metric-icon"><PackageX className="h-6 w-6" /></span><p className="summary-metric-label">MISSORTED</p></div>
        <div className="w-full"><p className={percent === null ? "summary-metric-empty" : "summary-metric-value"}>{unavailable ? entries.isError || target.isError ? "Não disponível" : "Carregando…" : percent === null ? "Sem dados" : formatMissorted(percent)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Meta: {target.isError ? "Não disponível" : formatMissorted(target.data ?? 0.68)}</p>
          {percent !== null && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-summary-accent">{result.above ? <TriangleAlert className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{result.above ? "Acima da meta" : "Dentro da meta"}</p>}
        </div>
      </Button>
    </div>
    <MissortedEntries open={open} onOpenChange={setOpen} />
  </>;
}

function MissortedEntries({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const qc = useQueryClient();
  const { data: rows = [], isError } = useQuery(missortedQuery());
  const [userId, setUserId] = useState<string>();
  useEffect(() => { if (open) void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id)); }, [open]);
  const [form, setForm] = useState<Form | null>(null);
  const [view, setView] = useState<MissortedEntry | null>(null);
  const [remove, setRemove] = useState<MissortedEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const refresh = () => qc.invalidateQueries({ queryKey: ["missorted_entries"] });
  async function save() {
    if (!form || saving) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !(DASH_SHIFTS as readonly string[]).includes(form.shift)) { toast.error("Informe data e turno válidos."); return; }
    if (!validMissortedCounts(form.incorrect, form.processed)) { toast.error("Use inteiros não negativos; pacotes incorretos não podem superar o total processado."); return; }
    setSaving(true);
    try {
      const payload = { operation_date: form.date, shift: form.shift, incorrect_packages: Number(form.incorrect), processed_packages: Number(form.processed) };
      const response = form.id ? await supabase.from("missorted_entries").update(payload).eq("id", form.id).select("id").single() : await supabase.from("missorted_entries").insert(payload).select("id").single();
      if (response.error) { toast.error(response.error.code === "23505" ? "Já existe lançamento nesta data e turno. Edite o lançamento existente." : "Não foi possível salvar o lançamento."); return; }
      setForm(null); await refresh(); toast.success("Lançamento MISSORTED salvo.");
    } catch { toast.error("Não foi possível salvar o lançamento."); } finally { setSaving(false); }
  }
  async function deleteEntry() {
    if (!remove || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("missorted_entries").delete().eq("id", remove.id).select("id").single();
      if (error) { toast.error("Não foi possível excluir o lançamento."); return; }
      setRemove(null); setPage(0); await refresh(); toast.success("Lançamento excluído.");
    } catch { toast.error("Não foi possível excluir o lançamento."); } finally { setSaving(false); }
  }
  const edit = (row: MissortedEntry) => setForm({ id: row.id, date: row.operation_date, shift: row.shift, incorrect: String(row.incorrect_packages), processed: String(row.processed_packages) });
  return <>
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Lançamentos MISSORTED</DialogTitle></DialogHeader>
      <div><Button onClick={() => setForm({ date: currentSystemDate(), shift: "", incorrect: "", processed: "" })}><Plus className="h-4 w-4" />Novo lançamento MISSORTED</Button></div>
      {isError ? <p className="text-sm text-destructive">Não foi possível consultar os lançamentos.</p> : !rows.length ? <p className="text-sm text-muted-foreground">Sem lançamento registrado.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Data</th><th className="p-2">Turno</th><th className="p-2 text-right">Incorretos</th><th className="p-2 text-right">Processados</th><th className="p-2 text-right">Ações</th></tr></thead><tbody>{rows.slice(page * 20, page * 20 + 20).map((row) => <tr className="border-b" key={row.id}><td className="p-2 whitespace-nowrap">{row.operation_date.split("-").reverse().join("/")}</td><td className="p-2">{row.shift}</td><td className="p-2 text-right">{row.incorrect_packages.toLocaleString("pt-BR")}</td><td className="p-2 text-right">{row.processed_packages.toLocaleString("pt-BR")}</td><td className="p-2 text-right whitespace-nowrap"><Button size="icon" variant="ghost" aria-label="Consultar MISSORTED" onClick={() => setView(row)}><Eye className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Editar MISSORTED" onClick={() => edit(row)}><Pencil className="h-4 w-4" /></Button>{row.created_by === userId && <Button size="icon" variant="ghost" aria-label="Excluir MISSORTED" onClick={() => setRemove(row)}><Trash2 className="h-4 w-4" /></Button>}</td></tr>)}</tbody></table></div>}
      {rows.length > 20 && <div className="flex justify-end items-center gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><span className="text-sm">{page + 1} / {Math.ceil(rows.length / 20)}</span><Button variant="outline" size="sm" disabled={(page + 1) * 20 >= rows.length} onClick={() => setPage(page + 1)}>Próxima</Button></div>}
    </DialogContent></Dialog>
    <Dialog open={!!form} onOpenChange={(value) => { if (!value && !saving) setForm(null); }}><DialogContent><DialogHeader><DialogTitle>{form?.id ? "Editar MISSORTED" : "Novo lançamento MISSORTED"}</DialogTitle></DialogHeader>
      {form && <div className="grid gap-3"><div><Label htmlFor="missorted-date">Data operacional</Label><Input id="missorted-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div><div><Label>Turno</Label><Select value={form.shift} onValueChange={(shift) => setForm({ ...form, shift })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{DASH_SHIFTS.map((shift) => <SelectItem value={shift} key={shift}>{shift}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="missorted-incorrect">Pacotes com classificação incorreta</Label><Input id="missorted-incorrect" type="number" min={0} step={1} value={form.incorrect} onChange={(e) => setForm({ ...form, incorrect: e.target.value })} /></div><div><Label htmlFor="missorted-processed">Total de pacotes processados</Label><Input id="missorted-processed" type="number" min={0} step={1} value={form.processed} onChange={(e) => setForm({ ...form, processed: e.target.value })} /></div></div>}
      <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setForm(null)}>Cancelar</Button><Button disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!view} onOpenChange={(value) => { if (!value) setView(null); }}><DialogContent><DialogHeader><DialogTitle>Consulta MISSORTED</DialogTitle></DialogHeader>{view && <dl className="grid grid-cols-2 gap-2 text-sm"><dt>Data operacional</dt><dd>{view.operation_date.split("-").reverse().join("/")}</dd><dt>Turno</dt><dd>{view.shift}</dd><dt>Pacotes incorretos</dt><dd>{view.incorrect_packages}</dd><dt>Total processado</dt><dd>{view.processed_packages}</dd><dt>Atualizado em</dt><dd>{new Date(view.updated_at).toLocaleString("pt-BR")}</dd></dl>}</DialogContent></Dialog>
    <Dialog open={!!remove} onOpenChange={(value) => { if (!value && !saving) setRemove(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir lançamento MISSORTED?</DialogTitle></DialogHeader><p className="text-sm">{remove?.operation_date.split("-").reverse().join("/")} · {remove?.shift}. Esta ação não pode ser desfeita.</p><DialogFooter><Button variant="outline" disabled={saving} onClick={() => setRemove(null)}>Cancelar</Button><Button variant="destructive" disabled={saving} onClick={deleteEntry}>Excluir lançamento</Button></DialogFooter></DialogContent></Dialog>
  </>;
}

export function MissortedTargetSettings() {
  const qc = useQueryClient();
  const target = useQuery(missortedTargetQuery());
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const value = draft ?? (target.data ?? 0.68).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  async function save() {
    if (saving) return;
    const normalized = value.trim().replace(",", ".");
    const number = Number(normalized);
    if (!/^\d+(\.\d+)?$/.test(normalized) || !Number.isFinite(number) || number < 0 || number > 100) { toast.error("Informe uma meta entre 0% e 100%."); return; }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { toast.error("Entre novamente para salvar a meta."); return; }
      const { error } = await supabase.from("missorted_settings").upsert({ id: true, target_percent: number, updated_by: auth.user.id, updated_at: new Date().toISOString() });
      if (error) { toast.error("Não foi possível salvar a meta."); return; }
      await qc.invalidateQueries({ queryKey: ["missorted_target"] }); setDraft(null); toast.success("Meta de MISSORTED salva.");
    } catch { toast.error("Não foi possível salvar a meta."); } finally { setSaving(false); }
  }
  return <Panel title="Meta de MISSORTED (%)"><form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); if (!target.isLoading && !target.isError) void save(); }}><div className="min-w-0"><Label htmlFor="missorted-target" className="font-semibold">Meta de MISSORTED (%)</Label><div className="mt-2 flex items-center gap-2"><Input id="missorted-target" className="w-40 text-base tabular-nums" inputMode="decimal" value={value} onChange={(e) => setDraft(e.target.value)} /><span className="text-sm text-muted-foreground" aria-hidden="true">%</span></div></div><Button type="submit" disabled={saving || target.isLoading || target.isError}><Save className="h-4 w-4" />{saving ? "Salvando…" : "Salvar meta"}</Button></form>{target.isError && <p className="mt-2 text-sm text-destructive">Não foi possível consultar a meta.</p>}</Panel>;
}