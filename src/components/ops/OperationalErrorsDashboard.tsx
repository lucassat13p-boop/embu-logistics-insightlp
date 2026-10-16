import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { byDate, countBy, type RecordRow } from "@/lib/data";
import { HUB_NAME, type FieldKey } from "@/lib/modules";
import { availableMonths, EMPTY_PERIOD, filterByPeriod, periodLabel, recordMonth, type PeriodSelection } from "@/lib/period";
import { countErrorCategories, definedErrorPeriod, ERROR_SHIFTS, errorShift, filterErrorShifts, type ErrorShift } from "@/lib/operational-errors";
import { variation } from "@/lib/comparison";
import { BarBlock, Empty, Kpi, LineBlock, PageHeader, Panel, Ranking } from "./blocks";
import { PeriodFilter } from "./PeriodFilter";
import { RecordsTable } from "./RecordsTable";
import { useInitialTodayPeriod } from "@/hooks/use-initial-today-period";

type Metric = { name: string; value: number };
function ComparisonTable({ title, first, second, labels }: { title: string; first: Metric[]; second: Metric[]; labels: string[] }) {
  const names = [...new Set([...first, ...second].map((item) => item.name))];
  if (!names.length) return null;
  return <div><h3 className="mb-2 text-sm font-semibold">{title}</h3><div className="max-h-96 overflow-auto rounded-md border"><table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2 text-left">Indicador</th><th className="px-3 py-2 text-right">{labels[0]}</th><th className="px-3 py-2 text-right">{labels[1]}</th><th className="px-3 py-2 text-right">Variação</th><th className="px-3 py-2 text-left">Análise</th></tr></thead><tbody>{names.map((name) => {
    const a = first.find((item) => item.name === name)?.value ?? 0;
    const b = second.find((item) => item.name === name)?.value ?? 0;
    const change = variation(a, b);
    return <tr key={name} className="border-t"><th className="px-3 py-2 text-left font-medium">{name}</th><td className="px-3 py-2 text-right tabular-nums">{a.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right tabular-nums">{b.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right">{change.label}</td><td className="px-3 py-2">{change.analysis}</td></tr>;
  })}</tbody></table></div></div>;
}
const columns: FieldKey[] = ["record_date", "reason", "shift", "order_id", "collaborator", "classification"];
const labels = { reason: "Erro/Motivo", order_id: "BR", collaborator: "Login" };
function shiftsCount(rows: RecordRow[]): Metric[] {
  return ERROR_SHIFTS.map((name) => ({ name, value: rows.filter((row) => errorShift(row.shift) === name).length })).filter((item) => item.value > 0);
}
export function OperationalErrorsDashboard({ allRows }: { allRows: RecordRow[] }) {
  const originals = useMemo(() => allRows.filter((row) => row.module === "erros_operacionais"), [allRows]);
  const [period, setPeriod] = useInitialTodayPeriod();
  const [comparison, setComparison] = useState<PeriodSelection>({ ...EMPTY_PERIOD });
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [shifts, setShifts] = useState<ErrorShift[]>([]);
  const rows = useMemo(() => filterErrorShifts(filterByPeriod(originals, period), shifts), [originals, period, shifts]);
  const second = useMemo(() => filterErrorShifts(filterByPeriod(originals, comparison), shifts), [originals, comparison, shifts]);
  const months = availableMonths(originals);
  const hasDates = originals.some((row) => recordMonth(row.record_date));
  const comparisonReady = hasDates && definedErrorPeriod(period) && definedErrorPeriod(comparison) && period.kind === comparison.kind;
  const periodLabels = [`Período 1 · ${periodLabel(period)}`, `Período 2 · ${periodLabel(comparison)}`];
  const clear = () => { setPeriod({ ...EMPTY_PERIOD }); setComparison({ ...EMPTY_PERIOD }); setMode("single"); setShifts([]); };
  const title = <PageHeader title="Erros Operacionais" subtitle={HUB_NAME} action={<Button asChild><Link to="/importar" search={{ modulo: "erros_operacionais" }}><Upload className="h-4 w-4" />Importar relatório</Link></Button>} />;
  if (!originals.length) return <div>{title}<Empty text="Nenhum dado disponível" /></div>;
  const categories = countErrorCategories(rows);
  const reasonData = countBy(rows, "reason");
  const loginData = countBy(rows, "collaborator");
  const shiftData = shiftsCount(rows);
  return <div className="space-y-5">{title}
    <PeriodFilter months={months} period={period} onChange={(value) => { setPeriod(value); setComparison((previous) => ({ ...previous, kind: value.kind })); }} mode={mode} onModeChange={setMode} comparison={comparison} onComparisonChange={(value) => { setComparison(value); setPeriod((previous) => ({ ...previous, kind: value.kind })); }} onClear={clear} />
    {!hasDates && <p className="text-sm text-muted-foreground">Análise temporal indisponível: sem data no relatório.</p>}
    <div><Label>Turnos</Label><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant={!shifts.length ? "default" : "outline"} aria-pressed={!shifts.length} onClick={() => setShifts([])}>Todos</Button><ToggleGroup type="multiple" size="sm" variant="outline" value={shifts} onValueChange={(values) => setShifts(values.filter((value): value is ErrorShift => ERROR_SHIFTS.some((shift) => shift === value)))}>{ERROR_SHIFTS.map((shift) => <ToggleGroupItem key={shift} value={shift}>{shift}</ToggleGroupItem>)}</ToggleGroup></div></div>
    {!rows.length ? <Empty text="Nenhum dado disponível" /> : <>
      <div className="grid gap-3 md:grid-cols-3"><Kpi accent label="Total de erros" value={rows.length} />{categories.map((item) => <Kpi key={item.name} label={item.name} value={item.value} />)}</div>
      {reasonData.length > 0 && <Panel title="Erros por motivo"><BarBlock data={reasonData} horizontal rowHeight={38} yAxisWidth={180} valueName="Ocorrências" /></Panel>}
      {shiftData.length > 0 && <Panel title="Erros por turno"><BarBlock data={shiftData} valueName="Ocorrências" /></Panel>}
      {loginData.length > 0 && <Panel title="Erros por login"><Ranking data={loginData} /></Panel>}
      {byDate(rows).length > 0 && <Panel title="Evolução dos erros"><LineBlock data={byDate(rows)} /></Panel>}
    </>}
    {mode === "compare" && <section className="space-y-5 border-y py-5"><h2 className="text-lg font-semibold">Comparação de períodos</h2>{!comparisonReady ? <Empty text="Comparação indisponível: selecione dois períodos definidos do mesmo tipo com datas disponíveis na fonte." /> : !rows.length && !second.length ? <Empty text="Nenhum dado disponível" /> : <>
      <ComparisonTable title="Quantidade de erros" labels={periodLabels} first={[{ name: "Total de erros", value: rows.length }]} second={[{ name: "Total de erros", value: second.length }]} />
      <ComparisonTable title="Comparação por Erro/Motivo" labels={periodLabels} first={countBy(rows, "reason")} second={countBy(second, "reason")} />
      <ComparisonTable title="Comparação por turno" labels={periodLabels} first={shiftsCount(rows)} second={shiftsCount(second)} />
      <ComparisonTable title="Comparação por Login" labels={periodLabels} first={countBy(rows, "collaborator")} second={countBy(second, "collaborator")} />
      <ComparisonTable title="Etiquetagem e Sorting" labels={periodLabels} first={countErrorCategories(rows)} second={countErrorCategories(second)} />
    </>}</section>}
    {rows.length > 0 && <Panel title="Registros de Erros Operacionais"><RecordsTable defaultToToday={false} key={`${JSON.stringify(period)}-${shifts.join()}`} rows={rows} columns={columns} columnLabels={labels} wrapColumns={["reason"]} emptyText="Nenhum dado disponível" /></Panel>}
  </div>;
}