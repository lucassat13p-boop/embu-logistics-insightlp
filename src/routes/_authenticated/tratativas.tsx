import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Empty, Kpi, PageHeader, Panel } from "@/components/ops/blocks";
import { PeriodFilter } from "@/components/ops/PeriodFilter";
import { useInitialTodayPeriod } from "@/hooks/use-initial-today-period";
import { supabase } from "@/integrations/supabase/client";
import { HUB_NAME } from "@/lib/modules";
import { currentSystemDate, EMPTY_PERIOD, type PeriodSelection } from "@/lib/period";
import { filterTreatedImports, sumTreatedImports, treatedImportsQuery } from "@/lib/on-hold-treated";
import { filterTreatments, sumTreatments, TREATMENT_SHIFTS, treatmentsQuery, type TreatmentRow, type TreatmentShift } from "@/lib/treatments";

export const Route = createFileRoute("/_authenticated/tratativas")({
  head: () => ({
    meta: [
      { title: "Tratativas Operacionais — Shopee Operations Hub" },
      { name: "description", content: "Lançamentos de avarias salvas e pacotes ON HOLD tratados por turno no HUB LSP-36." },
      { property: "og:title", content: "Tratativas Operacionais — Shopee Operations Hub" },
      { property: "og:description", content: "Resultados das tratativas realizadas nos turnos operacionais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TratativasPage,
});

type Form = { id?: string; date: string; shift: TreatmentShift | ""; avarias: string; onHold: string; notes: string };
const PAGE = 20;
const fmt = (d: string) => d.split("-").reverse().join("/");
const validInt = (v: string) => /^\d+$/.test(v.trim());

function TratativasPage() {
  const qc = useQueryClient();
  const { data: all = [], isLoading } = useQuery(treatmentsQuery());
  const { data: imported = [] } = useQuery(treatedImportsQuery());
  const [period, setPeriod] = useInitialTodayPeriod();
  const [comparison, setComparison] = useState<PeriodSelection>({ ...EMPTY_PERIOD });
  const [shifts, setShifts] = useState<TreatmentShift[]>([]);
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<Form | null>(null);
  const [view, setView] = useState<TreatmentRow | null>(null);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => filterTreatments(all, period, shifts), [all, period, shifts]);
  const totals = sumTreatments(rows);
  const importedTotals = sumTreatedImports(filterTreatedImports(imported, period, shifts));
  const months = useMemo(() => [...new Set(all.map((r) => r.operation_date.slice(0, 7)))].sort(), [all]);
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));

  const openNew = () => setForm({ date: currentSystemDate(), shift: "", avarias: "", onHold: "0", notes: "" });
  const openEdit = (r: TreatmentRow) => setForm({ id: r.id, date: r.operation_date, shift: r.shift as TreatmentShift, avarias: String(r.avarias_saved), onHold: String(r.on_hold_treated), notes: r.notes ?? "" });

  async function save() {
    if (!form || saving) return;
    if (!form.date || !form.shift) { toast.error("Informe a data e o turno."); return; }
    if (!validInt(form.avarias)) { toast.error("Informe números inteiros não negativos."); return; }
    setSaving(true);
    const payload = { operation_date: form.date, shift: form.shift, avarias_saved: Number(form.avarias), on_hold_treated: form.id ? Number(form.onHold) : 0, notes: form.notes.trim() || null };
    let error;
    if (form.id) ({ error } = await supabase.from("operational_treatments").update(payload).eq("id", form.id));
    else {
      const { data: u } = await supabase.auth.getUser();
      ({ error } = await supabase.from("operational_treatments").insert({ ...payload, created_by: u.user?.id, created_by_email: u.user?.email ?? null, source: "manual" }));
    }
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar: " + error.message); return; }
    toast.success(form.id ? "Lançamento atualizado." : "Lançamento registrado.");
    setForm(null);
    qc.invalidateQueries({ queryKey: ["operational_treatments"] });
    qc.invalidateQueries({ queryKey: ["official_treatments"] });
  }

  const allShifts = shifts.length === 0;
  return (
    <div className="space-y-5">
      <PageHeader title="Tratativas Operacionais" subtitle={HUB_NAME} action={<Button onClick={openNew}><Plus className="h-4 w-4" />Novo lançamento</Button>} />
      <PeriodFilter months={months} period={period} onChange={(p) => { setPeriod(p); setPage(0); }} mode="single" onModeChange={() => {}} comparison={comparison} onComparisonChange={setComparison} onClear={() => { setPeriod({ ...EMPTY_PERIOD }); setShifts([]); setPage(0); }} />
      <div><Label>Turnos</Label><div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={allShifts ? "default" : "outline"} onClick={() => { setShifts([]); setPage(0); }}>Todos</Button>
        <ToggleGroup type="multiple" variant="outline" size="sm" value={shifts} onValueChange={(v) => { setShifts(v.filter((s): s is TreatmentShift => (TREATMENT_SHIFTS as readonly string[]).includes(s))); setPage(0); }}>
          {TREATMENT_SHIFTS.map((s) => <ToggleGroupItem key={s} value={s}>{s}</ToggleGroupItem>)}
        </ToggleGroup>
      </div></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi accent label="Avarias salvas" value={totals.entries ? totals.avarias : null} hint={totals.entries ? undefined : "Sem lançamento registrado"} />
        <Kpi label="Pacotes tratados do ON HOLD (automático)" value={importedTotals.entries ? importedTotals.total : null} hint={importedTotals.entries ? "Importado do relatório ON HOLD" : "Sem importação no período"} />
        <Kpi label="Total de lançamentos" value={totals.entries} />
      </div>
      <Panel title="Histórico dos lançamentos" subtitle={`${rows.length} lançamentos`}>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : !rows.length ? <Empty text="Sem lançamento registrado para o período selecionado." /> : <>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="p-2">Data operacional</th><th className="p-2">Turno</th><th className="p-2 text-right">Avarias salvas</th><th className="p-2 text-right">ON HOLD tratados (manual, histórico)</th><th className="p-2">Responsável</th><th className="p-2">Observações</th><th className="p-2 text-right">Ações</th>
            </tr></thead>
            <tbody>{pageRows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="p-2 whitespace-nowrap">{fmt(r.operation_date)}</td><td className="p-2">{r.shift}</td>
                <td className="p-2 text-right font-semibold tabular-nums">{r.avarias_saved}</td><td className="p-2 text-right font-semibold tabular-nums">{r.on_hold_treated}</td>
                <td className="p-2 text-muted-foreground">{r.created_by_email ?? "—"}</td><td className="max-w-xs truncate p-2 text-muted-foreground">{r.notes ?? "—"}</td>
                <td className="p-2 text-right whitespace-nowrap"><Button size="icon" variant="ghost" aria-label="Visualizar" onClick={() => setView(r)}><Eye className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Editar" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button></td>
              </tr>))}</tbody>
          </table></div>
          {pages > 1 && <div className="mt-3 flex items-center justify-end gap-2 text-sm"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button><span>{page + 1} / {pages}</span><Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Próxima</Button></div>}
        </>}
      </Panel>

      <Dialog open={!!form} onOpenChange={(o) => !o && !saving && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar lançamento" : "Novo lançamento"}</DialogTitle></DialogHeader>
          {form && <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data da operação</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Turno</Label><Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v as TreatmentShift })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{TREATMENT_SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Avarias salvas</Label><Input type="number" min={0} step={1} inputMode="numeric" value={form.avarias} onChange={(e) => setForm({ ...form, avarias: e.target.value })} /></div>
              <div><Label>Pacotes tratados do ON HOLD</Label><Input value={form.id ? `${form.onHold} (manual, histórico)` : "Automático"} disabled /><p className="mt-1 text-xs text-muted-foreground">Agora vem da importação ON HOLD.</p></div>
            </div>
            <div><Label>Observações (opcional)</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>}
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setForm(null)}>Cancelar</Button><Button disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lançamento</DialogTitle></DialogHeader>
          {view && <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Data operacional</dt><dd>{fmt(view.operation_date)}</dd>
            <dt className="text-muted-foreground">Turno</dt><dd>{view.shift}</dd>
            <dt className="text-muted-foreground">Avarias salvas</dt><dd>{view.avarias_saved}</dd>
            <dt className="text-muted-foreground">ON HOLD tratados</dt><dd>{view.on_hold_treated}</dd>
            <dt className="text-muted-foreground">Responsável</dt><dd>{view.created_by_email ?? "—"}</dd>
            <dt className="text-muted-foreground">Criado em</dt><dd>{new Date(view.created_at).toLocaleString("pt-BR")}</dd>
            <dt className="text-muted-foreground">Atualizado em</dt><dd>{new Date(view.updated_at).toLocaleString("pt-BR")}</dd>
            <dt className="text-muted-foreground">Observações</dt><dd className="whitespace-pre-wrap">{view.notes ?? "—"}</dd>
          </dl>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
