import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { byDate, countBy, type RecordRow } from "@/lib/data";
import { HUB_NAME, type FieldKey } from "@/lib/modules";
import { availableMonths, EMPTY_PERIOD, filterByPeriod, periodLabel, recordMonth, type PeriodSelection } from "@/lib/period";
import { countErrorCategories, definedErrorPeriod, ERROR_SHIFTS, errorCategory, errorShift, filterBacklog, filterErrorShifts, type ErrorShift } from "@/lib/operational-errors";
import { variation } from "@/lib/comparison";
import { BarBlock, Empty, Kpi, LineBlock, PageHeader, Panel, Ranking } from "./blocks";
import { PeriodFilter } from "./PeriodFilter";
import { RecordsTable } from "./RecordsTable";
import { useInitialTodayPeriod } from "@/hooks/use-initial-today-period";
import { RankingPrivacyToggle, useRankingPrivacy } from "./RankingPrivacy";
import { ShiftIcon } from "./ShiftIcon";
import { errorLoginRankingRows } from "@/lib/error-login-ranking";

function LoginRanking({ data, limit }: { data: { name: string; value: number }[]; limit?: number }) {
  const { personName } = useRankingPrivacy();
  return <Ranking data={data.map((item) => ({ ...item, name: item.name === "Não identificado" ? item.name : personName(item.name) }))} limit={limit} showPrivacyToggle={false} />;
}

type Metric = { name: string; value: number };
function ComparisonTable({ title, first, second, labels, people = false }: { title: string; first: Metric[]; second: Metric[]; labels: string[]; people?: boolean }) {
  const { personName } = useRankingPrivacy();
  const names = [...new Set([...first, ...second].map((item) => item.name))];
  if (!names.length) return null;
  return <div><h3 className="mb-2 text-sm font-semibold">{title}</h3><div className="max-h-96 overflow-auto rounded-md border"><table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2 text-left">Indicador</th><th className="px-3 py-2 text-right">{labels[0]}</th><th className="px-3 py-2 text-right">{labels[1]}</th><th className="px-3 py-2 text-right">Variação</th><th className="px-3 py-2 text-left">Análise</th></tr></thead><tbody>{names.map((name) => {
    const a = first.find((item) => item.name === name)?.value ?? 0;
    const b = second.find((item) => item.name === name)?.value ?? 0;
    const change = variation(a, b);
    return <tr key={name} className="border-t"><th className="px-3 py-2 text-left font-medium">{people ? personName(name) : name}</th><td className="px-3 py-2 text-right tabular-nums">{a.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right tabular-nums">{b.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right">{change.label}</td><td className="px-3 py-2">{change.analysis}</td></tr>;
  })}</tbody></table></div></div>;
}
const columns: FieldKey[] = ["record_date", "reason", "shift", "order_id", "collaborator", "classification"];
const labels = { reason: "Erro/Motivo", order_id: "BR", collaborator: "Login", shift: "Turno responsável" };
function shiftsCount(rows: RecordRow[]): Metric[] {
  return ERROR_SHIFTS.map((name) => ({ name, value: rows.filter((row) => errorShift(row.shift) === name).length })).filter((item) => item.value > 0);
}
export function OperationalErrorsDashboard({ allRows }: { allRows: RecordRow[] }) {
  const originals = useMemo(() => allRows.filter((row) => row.module === "erros_operacionais"), [allRows]);
  const [period, setPeriod] = useInitialTodayPeriod();
  const [comparison, setComparison] = useState<PeriodSelection>({ ...EMPTY_PERIOD });
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [shifts, setShifts] = useState<ErrorShift[]>([]);
  const [rankingMode, setRankingMode] = useState<"general" | "shift">("general");
  const [categoryFilter, setCategoryFilter] = useState<"todos" | "SORTING" | "ETIQUETAGEM">("todos");
  const [includeBacklog, setIncludeBacklog] = useState(false);
  const [includeMissingLogin, setIncludeMissingLogin] = useState(false);
  const rows = useMemo(() => filterBacklog(filterErrorShifts(filterByPeriod(originals, period), shifts), includeBacklog), [originals, period, shifts, includeBacklog]);
  const second = useMemo(() => filterBacklog(filterErrorShifts(filterByPeriod(originals, comparison), shifts), includeBacklog), [originals, comparison, shifts, includeBacklog]);
  const rankingRows = useMemo(() => errorLoginRankingRows(rows, includeMissingLogin), [rows, includeMissingLogin]);
  const categoryRows = useMemo(() => categoryFilter === "todos" ? rankingRows : rankingRows.filter((row) => errorCategory(row) === categoryFilter), [rankingRows, categoryFilter]);
  const shiftRankings = useMemo(() => ERROR_SHIFTS.filter((shift) => !shifts.length || shifts.includes(shift)).map((shift) => ({
    shift,
    data: countBy(categoryRows.filter((row) => errorShift(row.shift) === shift), "collaborator").slice(0, 5),
  })), [categoryRows, shifts]);
  const months = availableMonths(originals);
  const hasDates = originals.some((row) => recordMonth(row.record_date));
  const comparisonReady = hasDates && definedErrorPeriod(period) && definedErrorPeriod(comparison) && period.kind === comparison.kind;
  const periodLabels = [`Período 1 · ${periodLabel(period)}`, `Período 2 · ${periodLabel(comparison)}`];
  const clear = () => { setPeriod({ ...EMPTY_PERIOD }); setComparison({ ...EMPTY_PERIOD }); setMode("single"); setShifts([]); };
  const title = <PageHeader title="Erros Operacionais" subtitle={HUB_NAME} action={<Button asChild><Link to="/importar" search={{ modulo: "erros_operacionais" }}><Upload className="h-4 w-4" />Importar relatório</Link></Button>} />;
  if (!originals.length) return <div>{title}<Empty text="Nenhum dado disponível" /></div>;
  const categories = countErrorCategories(rows);
  const reasonData = countBy(rows, "reason");
  const loginData = countBy(categoryRows, "collaborator");
  const categoryLabels: Record<typeof categoryFilter, string> = { todos: "Todos os erros", SORTING: "Sorting", ETIQUETAGEM: "Etiquetagem" };
  const rankingTitle = `${rankingMode === "general" ? "Top 8 colaboradores" : "Top 5 colaboradores por turno"} — ${categoryLabels[categoryFilter]}`;
  const shiftData = shiftsCount(rows);
  return <div className="space-y-5">{title}
    <PeriodFilter months={months} period={period} onChange={(value) => { setPeriod(value); setComparison((previous) => ({ ...previous, kind: value.kind })); }} mode={mode} onModeChange={setMode} comparison={comparison} onComparisonChange={(value) => { setComparison(value); setPeriod((previous) => ({ ...previous, kind: value.kind })); }} onClear={clear} />
    {!hasDates && <p className="text-sm text-muted-foreground">Análise temporal indisponível: sem data no relatório.</p>}
    <div><Label>Turnos</Label><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant={!shifts.length ? "default" : "outline"} aria-pressed={!shifts.length} onClick={() => setShifts([])}>Todos</Button><ToggleGroup type="multiple" size="sm" variant="outline" value={shifts} onValueChange={(values) => setShifts(values.filter((value): value is ErrorShift => ERROR_SHIFTS.some((shift) => shift === value)))}>{ERROR_SHIFTS.map((shift) => <ToggleGroupItem key={shift} value={shift}>{shift}</ToggleGroupItem>)}</ToggleGroup><label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={includeBacklog} onChange={(event) => setIncludeBacklog(event.target.checked)} />Incluir Backlog</label></div></div>
    {!rows.length ? <Empty text="Nenhum dado disponível" /> : <>
      <div className="grid gap-3 md:grid-cols-3"><Kpi accent label="Total de erros" value={rows.length} />{categories.map((item) => <Kpi key={item.name} label={item.name} value={item.value} />)}</div>
      {(() => { const reasonPanel = reasonData.length > 0 ? <Panel title="Erros por motivo" className={rankingMode === "general" ? "flex flex-col [&>div]:relative [&>div]:flex-1" : undefined}>{rankingMode === "general" ? <div className="h-80 xl:absolute xl:inset-5 xl:h-auto"><BarBlock data={reasonData} horizontal rowHeight={38} yAxisWidth={180} valueName="Ocorrências" fillHeight maxBarSize={64} /></div> : <BarBlock data={reasonData} horizontal rowHeight={38} yAxisWidth={180} valueName="Ocorrências" height={reasonData.length < 4 ? 208 : undefined} />}</Panel> : null; return <div className={rankingMode === "general" && reasonPanel ? "grid gap-5 xl:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] xl:items-stretch" : "grid gap-5"}>{rankingMode === "general" && reasonPanel}
      <Panel title={rankingTitle} action={<div className="flex flex-wrap items-center gap-2"><div className="flex rounded-md border bg-muted p-1" role="group" aria-label="Modo do ranking"><Button size="sm" variant={rankingMode === "general" ? "default" : "ghost"} aria-pressed={rankingMode === "general"} onClick={() => setRankingMode("general")}>Ranking geral</Button><Button size="sm" variant={rankingMode === "shift" ? "default" : "ghost"} aria-pressed={rankingMode === "shift"} onClick={() => setRankingMode("shift")}>Por turno</Button></div><div className="flex rounded-md border bg-muted p-1" role="group" aria-label="Tipo de erro"><Button size="sm" variant={categoryFilter === "todos" ? "default" : "ghost"} aria-pressed={categoryFilter === "todos"} onClick={() => setCategoryFilter("todos")}>Todos</Button><Button size="sm" variant={categoryFilter === "SORTING" ? "default" : "ghost"} aria-pressed={categoryFilter === "SORTING"} onClick={() => setCategoryFilter("SORTING")}>Sorting</Button><Button size="sm" variant={categoryFilter === "ETIQUETAGEM" ? "default" : "ghost"} aria-pressed={categoryFilter === "ETIQUETAGEM"} onClick={() => setCategoryFilter("ETIQUETAGEM")}>Etiquetagem</Button></div><label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={includeMissingLogin} onChange={(event) => setIncludeMissingLogin(event.target.checked)} />Incluir sem login</label><RankingPrivacyToggle /></div>}>
        {rankingMode === "general" ? <LoginRanking data={loginData} /> : <div className={shiftRankings.length > 1 ? "grid gap-6 lg:grid-cols-3" : "grid gap-6"}>{shiftRankings.map((ranking) => <div key={ranking.shift} className="min-w-0"><h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary"><ShiftIcon shift={ranking.shift} className="h-4 w-4" />{ranking.shift} — Top 5</h4>{ranking.data.length ? <LoginRanking data={ranking.data} limit={5} /> : <Empty text="Nenhuma ocorrência disponível neste turno" />}</div>)}</div>}
      </Panel>{rankingMode === "shift" && reasonPanel}</div>; })()}
      {shiftData.length > 0 && <Panel title="Erros por turno responsável"><BarBlock data={shiftData} valueName="Ocorrências" /></Panel>}
      {byDate(rows).length > 0 && <Panel title="Evolução dos erros"><LineBlock data={byDate(rows)} /></Panel>}
    </>}
    {mode === "compare" && <section className="space-y-5 border-y py-5"><h2 className="text-lg font-semibold">Comparação de períodos</h2>{!comparisonReady ? <Empty text="Comparação indisponível: selecione dois períodos definidos do mesmo tipo com datas disponíveis na fonte." /> : !rows.length && !second.length ? <Empty text="Nenhum dado disponível" /> : <>
      <ComparisonTable title="Quantidade de erros" labels={periodLabels} first={[{ name: "Total de erros", value: rows.length }]} second={[{ name: "Total de erros", value: second.length }]} />
      <ComparisonTable title="Comparação por Erro/Motivo" labels={periodLabels} first={countBy(rows, "reason")} second={countBy(second, "reason")} />
      <ComparisonTable title="Comparação por turno" labels={periodLabels} first={shiftsCount(rows)} second={shiftsCount(second)} />
      <div className="space-y-2"><RankingPrivacyToggle /><ComparisonTable people title="Comparação por Login" labels={periodLabels} first={countBy(rows, "collaborator")} second={countBy(second, "collaborator")} /></div>
      <ComparisonTable title="Etiquetagem e Sorting" labels={periodLabels} first={countErrorCategories(rows)} second={countErrorCategories(second)} />
    </>}</section>}
    {rows.length > 0 && <Panel title="Registros de Erros Operacionais"><RecordsTable defaultToToday={false} key={`${JSON.stringify(period)}-${shifts.join()}-${includeBacklog}`} rows={rows} columns={columns} columnLabels={labels} wrapColumns={["reason"]} emptyText="Nenhum dado disponível" /></Panel>}
  </div>;
}