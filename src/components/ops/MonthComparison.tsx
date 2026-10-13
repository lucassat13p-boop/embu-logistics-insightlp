import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { countBy, hasField, type RecordRow } from "@/lib/data";
import { filterByMonths, monthLabel, PERIOD_EMPTY } from "@/lib/period";
import { adjacentPairs, COMPARISON_EMPTY, metricCount, variation } from "@/lib/comparison";
import type { FieldKey } from "@/lib/modules";
import { countProductFamilies } from "@/lib/product-families";
import { Empty } from "./blocks";

type Metric = { name: string; values: (number | null)[] };
type Change = ReturnType<typeof variation>;
const officialShifts = ["AM1", "AM2", "PM1"];
const tone = (change: Change) => change.direction === "increase" ? "text-destructive" : change.direction === "decrease" ? "text-success" : "text-muted-foreground";
function ChangeText({ change, analysis = false }: { change: Change; analysis?: boolean }) {
  const Icon = change.direction === "increase" ? ArrowUpRight : change.direction === "decrease" ? ArrowDownRight : Minus;
  return <span className={`inline-flex items-center gap-1 ${tone(change)}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{analysis ? change.analysis : change.label}</span>;
}

function ComparisonTable({ title, label, metrics, months, total = false }: { title: string; label: string; metrics: Metric[]; months: string[]; total?: boolean }) {
  const pairs = adjacentPairs(months);
  return <div className="space-y-2">
    <h3 className="text-sm font-semibold">{title}</h3>
    {!metrics.length ? <Empty text={COMPARISON_EMPTY} /> : <div className="max-h-96 overflow-auto rounded-md border">
      <table className="w-full text-sm" aria-label={title}>
        <thead className="sticky top-0 z-10 bg-muted"><tr>
          <th className="min-w-44 px-3 py-3 text-left">{label}</th>
          {months.map((month) => <th key={month} className="min-w-36 px-3 py-3 text-right">{monthLabel(month)}</th>)}
          {total && <th className="px-3 py-3 text-right">Total</th>}
          {pairs.flatMap((pair) => [<th key={`${pair.current}-variation`} className="min-w-32 border-l px-3 py-3 text-right">Variação{months.length > 2 && <span className="mt-1 block text-xs font-normal">{monthLabel(pair.previous ?? "")} → {monthLabel(pair.current)}</span>}</th>, <th key={`${pair.current}-analysis`} className="min-w-52 px-3 py-3 text-left">Análise</th>])}
        </tr></thead>
        <tbody>{metrics.map((metric) => <tr key={metric.name} className="border-t">
          <th className="min-w-44 max-w-80 break-words px-3 py-3 text-left font-medium">{metric.name}</th>
          {metric.values.map((value, index) => <td key={months[index]} className="px-3 py-3 text-right tabular-nums">{value === null ? "Sem informação" : value.toLocaleString("pt-BR")}</td>)}
          {total && <td className="px-3 py-3 text-right font-semibold tabular-nums">{metric.values.some((value) => value !== null) ? metric.values.reduce<number>((sum, value) => sum + (value ?? 0), 0).toLocaleString("pt-BR") : "Sem informação"}</td>}
          {pairs.flatMap((pair) => {
            const change = variation(metric.values[pair.previousIndex] ?? null, metric.values[pair.currentIndex] ?? null);
            return [<td key={`${pair.current}-variation`} className="border-l px-3 py-3 text-right tabular-nums"><ChangeText change={change} /></td>, <td key={`${pair.current}-analysis`} className="px-3 py-3 text-xs"><ChangeText change={change} analysis /></td>];
          })}
        </tr>)}</tbody>
      </table>
    </div>}
  </div>;
}

export function MonthComparison({ rows, months, classifications }: { rows: RecordRow[]; months: string[]; classifications: string[] }) {
  const periods = months.map((month) => ({ month, rows: filterByMonths(rows, [month]) }));
  const pairs = adjacentPairs(months);
  const indicators: Metric[] = [
    { name: "Total de Avarias", values: periods.map((period) => metricCount(period.rows)) },
    ...classifications.map((name) => ({ name, values: periods.map((period) => metricCount(period.rows, "classification", name, classifications)) })),
  ];
  const dimensions: { field: FieldKey; title: string; label: string }[] = [
    { field: "shift", title: "Comparação por Turno", label: "Turno" },
    { field: "collaborator", title: "Comparação de colaboradores", label: "Colaborador" },
    { field: "product", title: "Comparação de produtos", label: "Família de produto" },
  ];
  return <section aria-label="Comparação de meses" className="min-w-0 space-y-6 border-y py-5">
    <div><h2 className="text-lg font-semibold">Comparação de meses</h2><p className="mt-1 text-sm text-muted-foreground">{months.map(monthLabel).join(" × ")}</p></div>
    {pairs.length > 0 && <div className="space-y-5" aria-label="Resumo da evolução">
      <h3 className="font-semibold">Resumo da evolução</h3>
      {pairs.map((pair) => {
        const changes = indicators.map((metric) => ({ name: metric.name, change: variation(metric.values[pair.previousIndex] ?? null, metric.values[pair.currentIndex] ?? null) }));
        const types = changes.slice(1);
        const increases = types.filter(({ change }) => change.percent !== null && change.percent > 0).sort((a, b) => (b.change.percent ?? 0) - (a.change.percent ?? 0));
        const decreases = types.filter(({ change }) => change.percent !== null && change.percent < 0).sort((a, b) => (a.change.percent ?? 0) - (b.change.percent ?? 0));
        const extreme = (items: typeof types) => {
          const first = items[0];
          if (!first) return types.some(({ change }) => change.percent !== null) ? "Sem variação nesta direção" : COMPARISON_EMPTY;
          return items.filter(({ change }) => change.percent === first.change.percent).map(({ name }) => name).join(", ") + " — " + first.change.label;
        };
        return <div key={pair.current} className="space-y-3 border-l-2 border-primary pl-4">
          <h4 className="text-sm font-semibold">{monthLabel(pair.previous ?? "")} → {monthLabel(pair.current)}</h4>
          {!changes.some(({ change }) => change.direction !== "missing") ? <Empty text={COMPARISON_EMPTY} /> : <>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">{changes.map(({ name, change }) => <div key={name}><dt className="text-xs text-muted-foreground">{name}</dt><dd className="mt-1 text-sm font-medium"><ChangeText change={change} analysis /></dd></div>)}</dl>
            <div className="grid gap-3 border-t pt-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Maior crescimento</p><p className="mt-1 text-sm font-semibold text-destructive">{extreme(increases)}</p></div><div><p className="text-xs text-muted-foreground">Maior queda</p><p className="mt-1 text-sm font-semibold text-success">{extreme(decreases)}</p></div></div>
          </>}
        </div>;
      })}
    </div>}
    {periods.filter((period) => !period.rows.length).map(({ month }) => <div key={month}><h3 className="font-medium">{monthLabel(month)}</h3><Empty text={PERIOD_EMPTY} /></div>)}
    <ComparisonTable title="Comparação de totais e tipos" label="Indicador" metrics={indicators} months={months} />
    {dimensions.map(({ field, title, label }) => {
      const grouped = (data: RecordRow[]) => field === "product" ? countProductFamilies(data) : countBy(data, field);
      const counts = periods.map((period) => new Map(grouped(period.rows).map(({ name, value }) => [name, value])));
      const names = field === "shift" ? officialShifts : grouped(filterByMonths(rows, months)).map(({ name }) => name);
      const metrics = names.map((name) => ({ name, values: periods.map((period, index) => field === "shift" ? metricCount(period.rows, field, name, officialShifts) : hasField(period.rows, field) ? counts[index]?.get(name) ?? 0 : null) }));
      return <ComparisonTable key={field} title={title} label={label} metrics={metrics} months={months} total={field === "product"} />;
    })}
  </section>;
}
