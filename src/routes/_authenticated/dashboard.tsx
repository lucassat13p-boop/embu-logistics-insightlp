import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Download, Eye, EyeOff, Info, Settings2, TrendingDown, TrendingUp, Truck, TriangleAlert, Tags, Package, PackageOpen, ShieldCheck, PackageCheck, ClipboardCheck, type LucideIcon } from "lucide-react";
import { ShiftIcon } from "@/components/ops/ShiftIcon";
import { BarBlock, Empty, LineBlock, PageHeader, Panel } from "@/components/ops/blocks";
import { PieBlock } from "@/components/ops/PieBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { recordsQuery } from "@/lib/data";
import { isImport, officialTreatmentsQuery } from "@/lib/on-hold-treated";
import { HUB_NAME, moduleByKey } from "@/lib/modules";
import { OFFICIAL_AVARIA_TYPES } from "@/lib/avaria-analysis";
import { currentSystemDate } from "@/lib/period";
import { normId } from "@/lib/full-import";
import {
  DASH_SHIFTS, SHIFT_SUPPORT, avariaTypeKey, countBy, errorCategoryOf, errorTypeKey, evolution, filterItems, fullStatusKey, onHoldReasonKey,
  presetRange, previousRange, retidosReasonKey, shiftKey, sumBy, sumT, toItems, variation, type DashShift, type Item, type Preset, type Range, type SourceKey,
} from "@/lib/main-dashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Operacional — Shopee Operations Hub" },
      { name: "description", content: "Resumo do turno, pontos de atenção e análises dos módulos do HUB LSP-36." },
      { property: "og:title", content: "Dashboard Operacional — Shopee Operations Hub" },
      { property: "og:description", content: "Resumo do turno, pontos de atenção e análises dos módulos do HUB LSP-36." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Hoje" }, { value: "yesterday", label: "Ontem" }, { value: "7d", label: "Últimos 7 dias" }, { value: "30d", label: "Últimos 30 dias" },
  { value: "day", label: "Dia específico" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }, { value: "custom", label: "Personalizado" },
];
const SOURCE_LABEL: Record<SourceKey, string> = { on_hold: "ON HOLD", avaria: "AVARIA", retidos_veiculos: "RETIDOS DE VEÍCULOS", erros_operacionais: "ERROS OPERACIONAIS", auto_add: "AUTO ADD", full: "FULL", tratativas: "TRATATIVAS OPERACIONAIS" };
const SOURCES: SourceKey[] = ["on_hold", "avaria", "retidos_veiculos", "erros_operacionais", "auto_add", "full", "tratativas"];

type ChartKind = "pie" | "bar" | "line";
type ChartDef = { id: string; source: SourceKey; title: string; kind: ChartKind; data: (items: Item[]) => { name?: string; label?: string; value: number }[]; categories?: string[] };
const tVal = (k: "avarias_saved" | "on_hold_treated") => (i: Item) => i.t?.[k] ?? 0;
const CHARTS: ChartDef[] = [
  { id: "oh-reasons", source: "on_hold", title: "ON HOLD · Top 5 motivos", kind: "bar", data: (i) => countBy(i, onHoldReasonKey).slice(0, 5) },
  { id: "oh-evo", source: "on_hold", title: "ON HOLD · Evolução diária", kind: "line", data: (i) => evolution(i) },
  { id: "oh-shift", source: "on_hold", title: "ON HOLD · Distribuição por turno", kind: "pie", data: (i) => countBy(i, shiftKey), categories: [...DASH_SHIFTS] },
  { id: "av-type", source: "avaria", title: "AVARIA · Tipo de avaria", kind: "pie", data: (i) => countBy(i, avariaTypeKey), categories: [...OFFICIAL_AVARIA_TYPES] },
  { id: "av-shift", source: "avaria", title: "AVARIA · Distribuição por turno", kind: "pie", data: (i) => countBy(i, shiftKey), categories: [...DASH_SHIFTS] },
  { id: "av-evo", source: "avaria", title: "AVARIA · Evolução diária", kind: "line", data: (i) => evolution(i) },
  { id: "rt-shift", source: "retidos_veiculos", title: "RETIDOS · Ocorrências por turno", kind: "pie", data: (i) => countBy(i, shiftKey), categories: [...DASH_SHIFTS] },
  { id: "rt-evo", source: "retidos_veiculos", title: "RETIDOS · Evolução diária", kind: "line", data: (i) => evolution(i) },
  { id: "rt-reasons", source: "retidos_veiculos", title: "RETIDOS · Motivos de retenção", kind: "bar", data: (i) => countBy(i, retidosReasonKey) },
  { id: "er-types", source: "erros_operacionais", title: "ERROS · Top tipos de erro", kind: "bar", data: (i) => countBy(i, errorTypeKey).slice(0, 8) },
  { id: "er-evo", source: "erros_operacionais", title: "ERROS · Evolução diária", kind: "line", data: (i) => evolution(i) },
  { id: "er-shift", source: "erros_operacionais", title: "ERROS · Distribuição por turno", kind: "pie", data: (i) => countBy(i, shiftKey), categories: [...DASH_SHIFTS] },
  { id: "aa-evo", source: "auto_add", title: "AUTO ADD · Evolução por período", kind: "line", data: (i) => evolution(i) },
  { id: "fu-status", source: "full", title: "FULL · Pacotes por status final", kind: "bar", data: (i) => countBy(i, fullStatusKey) },
  { id: "tr-av", source: "tratativas", title: "TRATATIVAS · Avarias salvas por turno", kind: "bar", data: (i) => sumBy(i, shiftKey, tVal("avarias_saved")) },
  { id: "tr-oh", source: "tratativas", title: "TRATATIVAS · ON HOLD tratados por turno", kind: "bar", data: (i) => sumBy(i, shiftKey, tVal("on_hold_treated")) },
  { id: "tr-evo", source: "tratativas", title: "TRATATIVAS · Avarias salvas por dia", kind: "line", data: (i) => evolution(i, tVal("avarias_saved")) },
];
const DEFAULT_LAYOUT = CHARTS.map((c) => ({ id: c.id, visible: ["oh-reasons", "av-type", "rt-evo", "er-types", "tr-av", "tr-oh"].includes(c.id) }));
const LAYOUT_KEY = "ops-dashboard-layout-v1";
const ADV_KEY = "ops-dashboard-advanced-v1";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtDate = (d: string) => d.split("-").reverse().join("/");

function usePersisted<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => { try { const s = localStorage.getItem(key); if (s) setV({ ...initial, ...JSON.parse(s) }); } catch { /* ignore */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (n: T) => { setV(n); try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* ignore */ } };
  return [v, set] as const;
}

function Dashboard() {
  const q = { on_hold: useQuery(recordsQuery("on_hold")), avaria: useQuery(recordsQuery("avaria")), retidos_veiculos: useQuery(recordsQuery("retidos_veiculos")), erros_operacionais: useQuery(recordsQuery("erros_operacionais")), auto_add: useQuery(recordsQuery("auto_add")), full: useQuery(recordsQuery("full")) };
  const treat = useQuery(officialTreatmentsQuery());
  const loading = Object.values(q).some((x) => x.isLoading) || treat.isLoading;

  const [today, setToday] = useState("");
  useEffect(() => setToday(currentSystemDate()), []);
  const [preset, setPreset] = useState<Preset>("today");
  const [pv, setPv] = useState({ date: "", week: "", month: "", start: "", end: "" });
  const [shifts, setShifts] = useState<DashShift[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [adv, setAdv] = usePersisted(ADV_KEY, { compare: true, radar: true, shifts: true, evo: true });
  const [layoutState, setLayout] = usePersisted<{ items: { id: string; visible: boolean }[] }>(LAYOUT_KEY, { items: DEFAULT_LAYOUT });
  const layout = useMemo(() => { const known = layoutState.items.filter((i) => CHARTS.some((c) => c.id === i.id)); return [...known, ...DEFAULT_LAYOUT.filter((d) => !known.some((k) => k.id === d.id))]; }, [layoutState]);
  const [customize, setCustomize] = useState(false);
  const [report, setReport] = useState(false);

  const range = today ? presetRange(preset, pv, today) : null;
  const prev = range ? previousRange(range) : null;
  const all = useMemo(() => Object.fromEntries(SOURCES.map((s) => [s, s === "tratativas" ? toItems(s, [], treat.data ?? []) : toItems(s, q[s].data ?? [])])) as Record<SourceKey, Item[]>, // eslint-disable-next-line react-hooks/exhaustive-deps
    [treat.data, q.on_hold.data, q.avaria.data, q.retidos_veiculos.data, q.erros_operacionais.data, q.auto_add.data, q.full.data]);
  const cur = useMemo(() => Object.fromEntries(SOURCES.map((s) => [s, filterItems(all[s], range, shifts)])) as Record<SourceKey, Item[]>, [all, range?.start, range?.end, shifts]); // eslint-disable-line react-hooks/exhaustive-deps
  const before = useMemo(() => Object.fromEntries(SOURCES.map((s) => [s, filterItems(all[s], prev, shifts)])) as Record<SourceKey, Item[]>, [all, prev?.start, prev?.end, shifts]); // eslint-disable-line react-hooks/exhaustive-deps
  const shiftFiltered = shifts.length > 0 && shifts.length < DASH_SHIFTS.length;
  const periodText = range ? (range.start === range.end ? fmtDate(range.start) : `${fmtDate(range.start)} – ${fmtDate(range.end)}`) : "Período incompleto";
  const shiftText = shiftFiltered ? shifts.join(" + ") : "Todos os turnos";

  const summary = buildSummary(cur, all, shiftFiltered, range);
  const priorSummary = prev ? buildSummary(before, all, shiftFiltered, prev) : [];
  const toggleShift = (s: DashShift) => setShifts(shifts.includes(s) ? shifts.filter((x) => x !== s) : [...shifts, s].sort());

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard Operacional" subtitle={`${HUB_NAME} · Visão consolidada dos módulos`} action={<Button onClick={() => setReport(true)}><Download className="h-4 w-4" />Gerar relatório</Button>} />

      <div className="inline-flex rounded-md border bg-card p-1">
        <Button size="sm" variant={!advanced ? "default" : "ghost"} onClick={() => setAdvanced(false)}>Modo Simples</Button>
        <Button size="sm" variant={advanced ? "default" : "ghost"} onClick={() => setAdvanced(true)}>Modo Avançado</Button>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-3 shadow-card">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1"><Label>Período</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select>
          </div>
          {preset === "day" && <Input type="date" className="w-auto" value={pv.date} onChange={(e) => setPv({ ...pv, date: e.target.value })} aria-label="Dia" />}
          {preset === "week" && <Input type="week" className="w-auto" value={pv.week} onChange={(e) => setPv({ ...pv, week: e.target.value })} aria-label="Semana" />}
          {preset === "month" && <Input type="month" className="w-auto" value={pv.month} onChange={(e) => setPv({ ...pv, month: e.target.value })} aria-label="Mês" />}
          {preset === "custom" && <><Input type="date" className="w-auto" value={pv.start} onChange={(e) => setPv({ ...pv, start: e.target.value })} aria-label="Data inicial" /><Input type="date" className="w-auto" value={pv.end} onChange={(e) => setPv({ ...pv, end: e.target.value })} aria-label="Data final" /></>}
          <div className="space-y-1"><Label>Turnos</Label>
            <div className="flex gap-1">
              <Button size="sm" variant={!shiftFiltered ? "default" : "outline"} onClick={() => setShifts([])}>Todos</Button>
              {DASH_SHIFTS.map((s) => <Button key={s} size="sm" variant={shiftFiltered && shifts.includes(s) ? "default" : "outline"} onClick={() => toggleShift(s)}>{s}</Button>)}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{periodText} · {shiftText}</p>
      </div>

      <section className="shift-summary-section" aria-labelledby="shift-summary-title">
        <div className="summary-section-heading">
          <div className="flex min-w-0 items-center gap-3">
            <TrendingUp className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0"><h2 id="shift-summary-title" className="font-display text-xl font-bold">Resumo do Turno</h2><p className="mt-1 text-xs text-muted-foreground">Principais resultados operacionais do período e turnos selecionados.</p></div>
          </div>
          <p className="summary-period text-xs text-muted-foreground">{periodText} · {shiftText}</p>
        </div>
        <TooltipProvider delayDuration={250}><div className="summary-metrics-grid">{summary.map((s, index) => <SummaryCard key={s.label} {...s} previousValue={priorSummary[index]?.value ?? null} />)}</div></TooltipProvider>
      </section>

      <section className="shift-attention-section" aria-labelledby="shift-attention-title">
        <div className="mb-3 flex min-w-0 items-center gap-3">
          <TriangleAlert className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0"><h2 id="shift-attention-title" className="font-display text-base font-semibold text-primary">Pontos de Atenção do Turno</h2><p className="mt-1 text-xs text-muted-foreground">Resultados operacionais registrados em Tratativas Operacionais.</p></div>
        </div>
        <AttentionPoints items={cur.tratativas} shifts={shiftFiltered ? shifts : [...DASH_SHIFTS]} />
      </section>

      {!advanced && <>
        <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Análises dos módulos</h2><Button variant="outline" size="sm" onClick={() => setCustomize(true)}><Settings2 className="h-4 w-4" />Personalizar gráficos</Button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{SOURCES.map((s) => <ModuleCard key={s} source={s} items={cur[s]} shiftFiltered={shiftFiltered} />)}</div>
        <div className="grid gap-4 xl:grid-cols-2">
          {layout.filter((l) => l.visible).map((l) => { const c = CHARTS.find((x) => x.id === l.id)!; return <ChartPanel key={c.id} def={c} items={cur[c.source]} shiftFiltered={shiftFiltered} />; })}
        </div>
      </>}

      {advanced && <>
        <div className="flex flex-wrap gap-4 rounded-lg border bg-card p-3">
          {([["compare", "Comparação de períodos"], ["radar", "Radar operacional"], ["shifts", "Comparativo entre turnos"], ["evo", "Evolução operacional"]] as const).map(([k, label]) =>
            <label key={k} className="flex items-center gap-2 text-sm"><Switch checked={adv[k]} onCheckedChange={(v) => setAdv({ ...adv, [k]: v })} />{label}</label>)}
        </div>
        {adv.compare && <Panel title="Comparação de períodos" subtitle={prev ? `Atual: ${periodText} · Anterior equivalente: ${fmtDate(prev.start)} – ${fmtDate(prev.end)}` : "Selecione um período completo"}>
          {prev ? <CompareTable cur={cur} prev={before} shiftFiltered={shiftFiltered} /> : <Empty />}
        </Panel>}
        {adv.radar && prev && <Panel title="Radar operacional" subtitle="Maiores variações entre o período atual e o anterior equivalente"><Radar cur={cur} prev={before} shiftFiltered={shiftFiltered} /></Panel>}
        {adv.shifts && <Panel title="Comparativo entre turnos" subtitle="Somente registros com turno identificado no próprio módulo"><ShiftCompare all={all} range={range} /></Panel>}
        {adv.evo && <div className="grid gap-4 xl:grid-cols-2">{CHARTS.filter((c) => c.kind === "line").map((c) => <ChartPanel key={c.id} def={c} items={cur[c.source]} shiftFiltered={shiftFiltered} />)}</div>}
      </>}

      <CustomizeDialog open={customize} onOpenChange={setCustomize} layout={layout} onSave={(items) => setLayout({ items })} />
      <ReportDialog open={report} onOpenChange={setReport} periodText={periodText} shiftText={shiftText} summary={summary} cur={cur} />
    </div>
  );
}

type Summary = { label: string; value: number | null; note?: string; source: SourceKey; icon: LucideIcon; tone: "blue" | "red" | "amber" | "orange" | "purple" | "green" | "cyan" };
function buildSummary(cur: Record<SourceKey, Item[]>, all: Record<SourceKey, Item[]>, shiftFiltered: boolean, range: Range | null): Summary[] {
  const errCat = (name: string) => {
    const hasCat = all.erros_operacionais.some((i) => errorCategoryOf(i) === name);
    return hasCat ? cur.erros_operacionais.filter((i) => errorCategoryOf(i) === name).length : null;
  };
  const tr = cur.tratativas.filter((i) => !isImport(i.t)).length;
  const trImp = cur.tratativas.filter((i) => isImport(i.t)).length;
  const validFull = all.full.filter((i) => normId(i.row?.order_id));
  const periodFull = filterItems(validFull, range, []);
  const missingDate = validFull.filter((i) => !i.date).length;
  const missingShift = periodFull.filter((i) => !i.shift).length;
  const fullUnavailable = (range !== null && validFull.length > 0 && validFull.every((i) => !i.date)) || (shiftFiltered && periodFull.length > 0 && periodFull.every((i) => !i.shift));
  const fullNotes = ["FULL · BRs únicos"];
  if (range && missingDate) fullNotes.push(`${fmt(missingDate)} registro(s) sem data operacional fora do período`);
  if (shiftFiltered && missingShift) fullNotes.push(`${fmt(missingShift)} registro(s) sem turno confiável fora do filtro`);
  return [
    { label: "PACOTES RETIRADOS DO VEÍCULO", value: cur.retidos_veiculos.length, note: "Retidos de Veículos · ocorrências, incluindo BRs repetidos", source: "retidos_veiculos", icon: Truck, tone: "blue" },
    { label: "ERROS DE SORTING", value: errCat("SORTING"), note: errCat("SORTING") === null ? "Classificação SORTING não existe nos dados" : "Erros Operacionais · sem Backlog", source: "erros_operacionais", icon: TriangleAlert, tone: "red" },
    { label: "ERROS DE ETIQUETA", value: errCat("ETIQUETAGEM"), note: errCat("ETIQUETAGEM") === null ? "Classificação ETIQUETAGEM não existe nos dados" : "Erros Operacionais · sem Backlog", source: "erros_operacionais", icon: Tags, tone: "amber" },
    { label: "AVARIAS RECEBIDAS", value: cur.avaria.length, note: "AVARIA · total de avarias no período e turno", source: "avaria", icon: Package, tone: "orange" },
    { label: "PACOTES FULL", value: !fullUnavailable ? new Set(cur.full.map((i) => normId(i.row?.order_id)).filter(Boolean)).size : null, note: fullUnavailable ? `Não é possível aplicar o filtro: ${fullNotes.slice(1).join(" · ")}` : fullNotes.join(" · "), source: "full", icon: PackageOpen, tone: "purple" },
    { label: "AVARIAS SALVAS", value: tr ? sumT(cur.tratativas, "avarias_saved") : 0, note: tr ? `${tr} lançamento(s) em Tratativas Operacionais` : "Sem lançamentos no período", source: "tratativas", icon: ShieldCheck, tone: "green" },
    { label: "PACOTES TRATADOS DO ON HOLD", value: trImp ? sumT(cur.tratativas, "on_hold_treated") : null, note: trImp ? `${trImp} importação(ões) da aba Pacotes Tratados do ON HOLD` : "Sem importação no período", source: "tratativas", icon: PackageCheck, tone: "cyan" },
  ];
}

function SourceLink({ source, children, className }: { source: SourceKey; children: ReactNode; className?: string }) {
  if (source === "tratativas") return <Link to="/tratativas" className={className}>{children}</Link>;
  const m = moduleByKey(source);
  return m ? <Link to="/m/$slug" params={{ slug: m.slug }} className={className}>{children}</Link> : <div className={className}>{children}</div>;
}

function SummaryCard({ label, value, note, source, icon: Icon, tone, previousValue }: Summary & { previousValue: number | null }) {
  const delta = value !== null && previousValue !== null && previousValue > 0 ? variation(value, previousValue).pct : null;
  const positiveOutcome = label === "AVARIAS SALVAS" || label === "PACOTES TRATADOS DO ON HOLD";
  const negativeOutcome = label === "ERROS DE SORTING" || label === "ERROS DE ETIQUETA" || label === "AVARIAS RECEBIDAS";
  const changeColor = delta === null || delta === 0 || (!positiveOutcome && !negativeOutcome) ? "text-muted-foreground" : (positiveOutcome ? delta > 0 : delta < 0) ? "text-success" : "text-destructive";
  return <Tooltip><TooltipTrigger asChild><div className={`summary-tone-${tone} min-w-0 h-full`}>
    <SourceLink source={source} className="summary-metric group">
      <div className="summary-metric-heading"><span className="summary-metric-icon"><Icon className="h-6 w-6" aria-hidden="true" /></span><p className="summary-metric-label">{label}</p></div>
      <div className="summary-metric-result">
        {value === null ? <p className="summary-metric-empty">{note?.startsWith("Não é possível") ? "Não disponível" : "Nenhum dado disponível"}</p> : <p className="summary-metric-value">{fmt(value)}</p>}
        {delta !== null && <div className="summary-metric-change"><p className={`flex items-center justify-end gap-0.5 font-semibold tabular-nums ${changeColor}`}>{delta !== 0 && (delta > 0 ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />)}{delta > 0 ? "+" : ""}{delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</p><p className="summary-change-caption">vs. período anterior</p></div>}
      </div>
    </SourceLink>
  </div></TooltipTrigger><TooltipContent className="max-w-72 whitespace-normal bg-popover text-popover-foreground border shadow-card">{note ?? label}</TooltipContent></Tooltip>;
}

function AttentionPoints({ items, shifts }: { items: Item[]; shifts: DashShift[] }) {
  const byShift = new Map<string, { av: number; oh: number; notes: { id: string; date: string; text: string }[]; entries: number }>();
  for (const i of items) {
    if (!i.t) continue;
    const k = i.shift ?? "Sem turno";
    const c = byShift.get(k) ?? { av: 0, oh: 0, notes: [], entries: 0 };
    c.av += i.t.avarias_saved; c.oh += i.t.on_hold_treated; c.entries += 1;
    if (i.t.notes?.trim()) c.notes.push({ id: i.t.id, date: i.t.operation_date, text: i.t.notes });
    byShift.set(k, c);
  }
  return <ul className="shift-attention-grid">{DASH_SHIFTS.filter((shift) => shifts.includes(shift)).map((shift) => {
    const c = byShift.get(shift);
    const tone = shift === "AM1" ? "orange" : shift === "AM2" ? "blue" : "purple";
    return <li key={shift} className={`shift-attention-card summary-tone-${tone}`}>
      <div className="shift-attention-results">
        <div className="shift-attention-name"><span className="shift-attention-icon"><ShiftIcon shift={shift} className="h-6 w-6" /></span><h3 className="font-display text-lg font-bold">{shift}</h3></div>
        {c ? <><div className="shift-attention-total"><p className="font-display text-xl font-bold tabular-nums">{fmt(c.av)}</p><p className="mt-1 text-xs text-muted-foreground">Avarias salvas</p></div><div className="shift-attention-total"><p className="font-display text-xl font-bold tabular-nums">{fmt(c.oh)}</p><p className="mt-1 text-xs text-muted-foreground">ON HOLD tratados</p></div></> : <p className="col-span-2 border-l pl-4 text-xs text-muted-foreground">Sem lançamento no período</p>}
      </div>
      {c && c.notes.length > 0 && <details className="mt-3 border-t pt-2 text-xs"><summary className="cursor-pointer text-muted-foreground">Observações · {c.notes.length}</summary><ul className="mt-2 space-y-2">{c.notes.map((note) => <li key={note.id} className="flex items-start gap-2 leading-5"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><div className="min-w-0"><span className="text-muted-foreground">{fmtDate(note.date)}</span><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{note.text}</p></div></li>)}</ul></details>}
    </li>;
  })}</ul>;
}

function ModuleCard({ source, items, shiftFiltered }: { source: SourceKey; items: Item[]; shiftFiltered: boolean }) {
  const limited = shiftFiltered && !SHIFT_SUPPORT[source];
  const isT = source === "tratativas";
  return <SourceLink source={source} className="block rounded-lg border bg-card p-4 shadow-card transition hover:border-primary/40">
    <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-widest text-primary">{SOURCE_LABEL[source]}</span><span className="text-[11px] text-muted-foreground">abrir →</span></div>
    {limited ? <p className="mt-3 text-sm text-muted-foreground">Sem turno no módulo — não filtrável por turno</p>
      : items.length ? <><p className="mt-2 font-display text-2xl font-bold tabular-nums">{fmt(isT ? sumT(items, "avarias_saved") + 0 : items.length)}</p>
        <p className="text-xs text-muted-foreground">{isT ? `avarias salvas · ${fmt(sumT(items, "on_hold_treated"))} ON HOLD tratados` : source === "full" ? `pacotes · ${fmt(new Set(items.map((i) => i.row?.order_id).filter(Boolean)).size)} BRs únicos` : "ocorrências no período"}</p></>
        : <p className="mt-3 text-sm text-muted-foreground">Nenhum dado disponível</p>}
  </SourceLink>;
}

function ChartPanel({ def, items, shiftFiltered }: { def: ChartDef; items: Item[]; shiftFiltered: boolean }) {
  if (shiftFiltered && !SHIFT_SUPPORT[def.source]) return <Panel title={def.title}><Empty text="Este módulo não possui turno; o gráfico não pode ser filtrado por turno." /></Panel>;
  const data = def.data(items);
  const named = data as { name: string; value: number }[];
  return <Panel title={def.title}>
    {def.kind === "line" ? (data.length ? <LineBlock data={data as { label: string; value: number }[]} /> : <Empty />)
      : def.kind === "pie" ? <PieBlock data={named} total={named.reduce((a, b) => a + b.value, 0)} categories={def.categories ?? []} label={def.title} includeMissing={false} />
        : <BarBlock data={named} horizontal valueName={def.source === "tratativas" ? "Quantidade" : "Ocorrências"} />}
  </Panel>;
}

function metricRows(cur: Record<SourceKey, Item[]>, prev: Record<SourceKey, Item[]>, shiftFiltered: boolean) {
  const rows: { label: string; source: SourceKey; c: number; p: number; positive: boolean }[] = [];
  for (const s of SOURCES) {
    if (shiftFiltered && !SHIFT_SUPPORT[s]) continue;
    if (s === "tratativas") {
      rows.push({ label: "Avarias salvas", source: s, c: sumT(cur[s], "avarias_saved"), p: sumT(prev[s], "avarias_saved"), positive: true });
      rows.push({ label: "ON HOLD tratados", source: s, c: sumT(cur[s], "on_hold_treated"), p: sumT(prev[s], "on_hold_treated"), positive: true });
    } else rows.push({ label: `${SOURCE_LABEL[s]} · ocorrências`, source: s, c: cur[s].length, p: prev[s].length, positive: false });
  }
  return rows;
}

function CompareTable({ cur, prev, shiftFiltered }: { cur: Record<SourceKey, Item[]>; prev: Record<SourceKey, Item[]>; shiftFiltered: boolean }) {
  const rows = metricRows(cur, prev, shiftFiltered);
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Indicador</th><th className="text-right">Atual</th><th className="text-right">Anterior</th><th className="text-right">Diferença</th><th className="text-right">Variação</th></tr></thead>
    <tbody>{rows.map((r) => { const v = variation(r.c, r.p); return <tr key={r.label} className="border-b last:border-0"><td className="py-2">{r.label}</td><td className="text-right tabular-nums">{fmt(r.c)}</td><td className="text-right tabular-nums">{fmt(r.p)}</td><td className="text-right tabular-nums">{v.diff > 0 ? "+" : ""}{fmt(v.diff)}</td><td className="text-right tabular-nums">{v.pct === null ? <span className="text-muted-foreground">—</span> : `${v.pct > 0 ? "+" : ""}${v.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</td></tr>; })}</tbody></table>
    <p className="mt-2 text-[11px] text-muted-foreground">"—" indica base anterior zero (percentual não aplicável).{shiftFiltered ? " Módulos sem turno foram omitidos." : ""}</p></div>;
}

function Radar({ cur, prev, shiftFiltered }: { cur: Record<SourceKey, Item[]>; prev: Record<SourceKey, Item[]>; shiftFiltered: boolean }) {
  const rows = metricRows(cur, prev, shiftFiltered).map((r) => ({ ...r, diff: r.c - r.p })).filter((r) => r.diff !== 0);
  if (!rows.length) return <Empty text="Sem variações entre os períodos." />;
  const up = rows.filter((r) => r.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 4);
  const down = rows.filter((r) => r.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 4);
  const item = (r: (typeof rows)[number]) => { const good = r.positive ? r.diff > 0 : r.diff < 0; return <li key={r.label} className="flex items-center justify-between rounded-md border p-2 text-sm"><span>{r.label}</span><span className={`font-semibold tabular-nums ${good ? "text-success" : "text-destructive"}`}>{r.diff > 0 ? "+" : ""}{fmt(r.diff)}</span></li>; };
  return <div className="grid gap-4 md:grid-cols-2">
    <div><p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"><TrendingUp className="h-4 w-4" />Maiores aumentos</p><ul className="space-y-2">{up.length ? up.map(item) : <Empty />}</ul></div>
    <div><p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"><TrendingDown className="h-4 w-4" />Maiores reduções</p><ul className="space-y-2">{down.length ? down.map(item) : <Empty />}</ul></div>
    <p className="text-[11px] text-muted-foreground md:col-span-2">Cor verde = evolução favorável conforme o significado do indicador (aumento de avarias salvas/ON HOLD tratados é positivo; aumento de ocorrências é desfavorável).</p>
  </div>;
}

function ShiftCompare({ all, range }: { all: Record<SourceKey, Item[]>; range: Range | null }) {
  const srcs = SOURCES.filter((s) => SHIFT_SUPPORT[s]);
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Indicador</th>{DASH_SHIFTS.map((s) => <th key={s} className="text-right">{s}</th>)}<th className="text-right">Sem turno</th></tr></thead>
    <tbody>{srcs.flatMap((s) => {
      const items = filterItems(all[s], range, []);
      const val = (sh: DashShift | null, k?: "avarias_saved" | "on_hold_treated") => { const f = items.filter((i) => i.shift === sh); return k ? sumT(f, k) : f.length; };
      const lines: [string, (k: DashShift | null) => number][] = s === "tratativas" ? [["Avarias salvas", (k) => val(k, "avarias_saved")], ["ON HOLD tratados", (k) => val(k, "on_hold_treated")]] : [[`${SOURCE_LABEL[s]} · ocorrências`, (k) => val(k)]];
      return lines.map(([label, f]) => <tr key={label} className="border-b last:border-0"><td className="py-2">{label}</td>{DASH_SHIFTS.map((sh) => <td key={sh} className="text-right tabular-nums">{fmt(f(sh))}</td>)}<td className="text-right tabular-nums text-muted-foreground">{fmt(f(null))}</td></tr>);
    })}</tbody></table><p className="mt-2 text-[11px] text-muted-foreground">Registros sem turno identificado aparecem separados e nunca são distribuídos entre AM1, AM2 e PM1. AUTO ADD não possui turno.</p></div>;
}

function CustomizeDialog({ open, onOpenChange, layout, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; layout: { id: string; visible: boolean }[]; onSave: (l: { id: string; visible: boolean }[]) => void }) {
  const [draft, setDraft] = useState(layout);
  useEffect(() => { if (open) setDraft(layout); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (i: number, d: number) => { const n = [...draft]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setDraft(n); };
  const setModule = (s: SourceKey, visible: boolean) => setDraft(draft.map((l) => CHARTS.find((c) => c.id === l.id)?.source === s ? { ...l, visible } : l));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
    <DialogHeader><DialogTitle>Personalizar gráficos</DialogTitle></DialogHeader>
    <div className="flex flex-wrap gap-2">{SOURCES.map((s) => { const on = draft.some((l) => l.visible && CHARTS.find((c) => c.id === l.id)?.source === s); return <Button key={s} size="sm" variant={on ? "default" : "outline"} onClick={() => setModule(s, !on)}>{SOURCE_LABEL[s]}</Button>; })}</div>
    <ul className="space-y-1">{draft.map((l, i) => { const c = CHARTS.find((x) => x.id === l.id)!; return <li key={l.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
      <Checkbox checked={l.visible} onCheckedChange={(v) => setDraft(draft.map((x) => x.id === l.id ? { ...x, visible: !!v } : x))} aria-label={c.title} />
      {l.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
      <span className="flex-1">{c.title}</span>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown className="h-4 w-4" /></Button>
    </li>; })}</ul>
    <div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => setDraft(DEFAULT_LAYOUT)}>Restaurar padrão</Button><Button onClick={() => { onSave(draft); onOpenChange(false); }}>Salvar preferências</Button></div>
  </DialogContent></Dialog>;
}

function ReportDialog({ open, onOpenChange, periodText, shiftText, summary, cur }: { open: boolean; onOpenChange: (o: boolean) => void; periodText: string; shiftText: string; summary: Summary[]; cur: Record<SourceKey, Item[]> }) {
  const lines = summary.map((s) => [s.label, s.value === null ? (s.note?.startsWith("Não disponível") ? "Não disponível" : "Sem dados") : fmt(s.value)] as const);
  const tr = cur.tratativas;
  const points = tr.length ? [`Avarias salvas: ${fmt(sumT(tr, "avarias_saved"))}`, `Pacotes do ON HOLD tratados: ${fmt(sumT(tr, "on_hold_treated"))}`] : ["Nenhum ponto de atenção registrado."];
  const download = () => {
    const W = 1200, H = 260 + Math.ceil(lines.length / 3) * 150 + 60 + points.length * 34 + 60;
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const col = (v: string, f: string) => css.getPropertyValue(v).trim() || f;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#ee4d2d"; g.fillRect(0, 0, W, 120);
    g.fillStyle = "#ffffff"; g.font = "bold 34px sans-serif"; g.fillText("Resumo do Turno", 48, 58); g.font = "20px sans-serif"; g.fillText(`${HUB_NAME}`, 48, 94);
    g.fillStyle = "#222"; g.font = "18px sans-serif"; g.fillText(`Período: ${periodText}   ·   Turnos: ${shiftText}`, 48, 165);
    lines.forEach(([label, value], i) => {
      const x = 48 + (i % 3) * 372, y = 200 + Math.floor(i / 3) * 150;
      g.strokeStyle = "#e5e5e5"; g.lineWidth = 2; g.strokeRect(x, y, 350, 128);
      g.fillStyle = "#666"; g.font = "15px sans-serif"; g.fillText(label.toUpperCase(), x + 18, y + 34);
      const empty = value === "Sem dados" || value === "Não disponível";
      g.fillStyle = empty ? "#999" : "#111"; g.font = empty ? "bold 24px sans-serif" : "bold 44px sans-serif"; g.fillText(value, x + 18, y + 92);
    });
    let y = 200 + Math.ceil(lines.length / 3) * 150 + 20;
    g.fillStyle = "#ee4d2d"; g.font = "bold 20px sans-serif"; g.fillText("PONTOS DE ATENÇÃO", 48, y); y += 36;
    g.fillStyle = "#222"; g.font = "18px sans-serif"; points.forEach((p) => { g.fillText(`• ${p}`, 48, y); y += 34; });
    g.fillStyle = "#999"; g.font = "13px sans-serif"; g.fillText(`Gerado em ${new Date().toLocaleString("pt-BR")} · somente dados reais registrados`, 48, H - 24);
    void col;
    const a = document.createElement("a"); a.download = `resumo-turno-${periodText.replace(/[^\d]+/g, "-")}.png`; a.href = c.toDataURL("image/png"); a.click();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl">
    <DialogHeader><DialogTitle>Relatório do turno</DialogTitle></DialogHeader>
    <div className="rounded-lg border p-4">
      <p className="font-display text-lg font-bold text-primary">{HUB_NAME}</p>
      <p className="text-sm text-muted-foreground">{periodText} · {shiftText}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{lines.map(([l, v]) => <div key={l} className="rounded-md border p-2"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="font-semibold">{v}</p></div>)}</div>
      <p className="mt-3 text-xs font-semibold uppercase text-primary">Pontos de atenção</p>
      <ul className="text-sm">{points.map((p) => <li key={p}>• {p}</li>)}</ul>
    </div>
    <Button onClick={download}><Download className="h-4 w-4" />Baixar como PNG</Button>
  </DialogContent></Dialog>;
}
