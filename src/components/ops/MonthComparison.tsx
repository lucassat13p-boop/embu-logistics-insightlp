import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { countProductFamilies } from "@/lib/product-families";
import { COMPARISON_EMPTY, variation } from "@/lib/comparison";
import { periodLabel, type PeriodSelection } from "@/lib/period";
import { countAvariaCollaborators, countAvariaShifts, normalizedAvariaType, OFFICIAL_AVARIA_TYPES, OFFICIAL_SHIFTS } from "@/lib/avaria-analysis";
import type { RecordRow } from "@/lib/data";
import { Empty } from "./blocks";

type Metric = { name: string; first: number | null; second: number | null };
type Change = ReturnType<typeof variation>;
const tone = (change: Change) => change.direction === "increase" ? "text-destructive" : change.direction === "decrease" ? "text-success" : "text-muted-foreground";

function ChangeText({ change, analysis = false }: { change: Change; analysis?: boolean }) {
  const Icon = change.direction === "increase" ? ArrowUpRight : change.direction === "decrease" ? ArrowDownRight : Minus;
  return <span className={`inline-flex items-center gap-1 ${tone(change)}`}><Icon className="h-4 w-4 shrink-0" />{analysis ? change.analysis : change.label}</span>;
}

function ComparisonTable({ title, label, metrics, labels }: { title: string; label: string; metrics: Metric[]; labels: [string, string] }) {
  return <div className="space-y-2"><h3 className="text-sm font-semibold">{title}</h3>{!metrics.length ? <Empty text={COMPARISON_EMPTY} /> : <div className="max-h-96 overflow-auto rounded-md border"><table className="w-full min-w-[820px] text-sm" aria-label={title}><thead className="sticky top-0 z-10 bg-muted"><tr><th className="px-3 py-3 text-left">{label}</th><th className="px-3 py-3 text-right">{labels[0]}</th><th className="px-3 py-3 text-right">{labels[1]}</th><th className="border-l px-3 py-3 text-right">Variação</th><th className="px-3 py-3 text-left">Análise</th></tr></thead><tbody>{metrics.map((metric) => { const change = variation(metric.first, metric.second); return <tr key={metric.name} className="border-t"><th className="px-3 py-3 text-left font-medium">{metric.name}</th><td className="px-3 py-3 text-right tabular-nums">{metric.first === null ? "Sem informação" : metric.first.toLocaleString("pt-BR")}</td><td className="px-3 py-3 text-right tabular-nums">{metric.second === null ? "Sem informação" : metric.second.toLocaleString("pt-BR")}</td><td className="border-l px-3 py-3 text-right"><ChangeText change={change} /></td><td className="px-3 py-3"><ChangeText change={change} analysis /></td></tr>; })}</tbody></table></div>}</div>;
}

const mapCounts = (data: { name: string; value: number }[]) => new Map(data.map((item) => [item.name, item.value]));
const pairedMetrics = (first: { name: string; value: number }[], second: { name: string; value: number }[], fixed?: readonly string[]): Metric[] => {
  const a = mapCounts(first), b = mapCounts(second);
  const names = fixed ? [...fixed] : [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => (b.get(y) ?? 0) + (a.get(y) ?? 0) - (b.get(x) ?? 0) - (a.get(x) ?? 0) || x.localeCompare(y, "pt-BR"));
  return names.map((name) => ({ name, first: a.get(name) ?? 0, second: b.get(name) ?? 0 }));
};

export function MonthComparison({ firstRows, secondRows, firstPeriod, secondPeriod }: { firstRows: RecordRow[]; secondRows: RecordRow[]; firstPeriod: PeriodSelection; secondPeriod: PeriodSelection }) {
  const labels: [string, string] = [periodLabel(firstPeriod), periodLabel(secondPeriod)];
  const types = OFFICIAL_AVARIA_TYPES.map((name) => ({ name, first: firstRows.filter((row) => normalizedAvariaType(row) === name).length, second: secondRows.filter((row) => normalizedAvariaType(row) === name).length }));
  const totals: Metric[] = [{ name: "Total de Avarias", first: firstRows.length, second: secondRows.length }, ...types];
  const totalChange = variation(firstRows.length, secondRows.length);
  const calculableTypes = types.map((metric) => ({ name: metric.name, change: variation(metric.first, metric.second) })).filter((item) => item.change.percent !== null);
  const biggest = (direction: "up" | "down") => {
    const sorted = calculableTypes.filter((item) => direction === "up" ? (item.change.percent ?? 0) > 0 : (item.change.percent ?? 0) < 0).sort((a, b) => direction === "up" ? (b.change.percent ?? 0) - (a.change.percent ?? 0) : (a.change.percent ?? 0) - (b.change.percent ?? 0));
    return sorted[0] ? `${sorted[0].name} — ${sorted[0].change.label}` : "Sem variação nesta direção";
  };
  if (!firstRows.length && !secondRows.length) return <section className="border-y py-5"><Empty text={COMPARISON_EMPTY} /></section>;
  return <section aria-label="Comparação de períodos" className="min-w-0 space-y-6 border-y py-5">
    <div><h2 className="text-lg font-semibold">Comparação de períodos</h2><p className="mt-1 text-sm text-muted-foreground">{labels.join(" × ")}</p></div>
    <div className="space-y-3" aria-label="Resumo da evolução"><h3 className="font-semibold">Resumo da evolução</h3><dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div><dt className="text-xs text-muted-foreground">Total período 1</dt><dd className="font-semibold">{firstRows.length.toLocaleString("pt-BR")}</dd></div><div><dt className="text-xs text-muted-foreground">Total período 2</dt><dd className="font-semibold">{secondRows.length.toLocaleString("pt-BR")}</dd></div><div><dt className="text-xs text-muted-foreground">Variação geral</dt><dd className="font-semibold"><ChangeText change={totalChange} analysis /></dd></div><div><dt className="text-xs text-muted-foreground">Maior crescimento</dt><dd className="font-semibold text-destructive">{biggest("up")}</dd></div><div><dt className="text-xs text-muted-foreground">Maior queda</dt><dd className="font-semibold text-success">{biggest("down")}</dd></div></dl></div>
    <ComparisonTable title="Comparação de totais e tipos" label="Indicador" metrics={totals} labels={labels} />
    <ComparisonTable title="Comparação por Turno" label="Turno" metrics={pairedMetrics(countAvariaShifts(firstRows), countAvariaShifts(secondRows), OFFICIAL_SHIFTS)} labels={labels} />
    <ComparisonTable title="Comparação de colaboradores" label="Colaborador" metrics={pairedMetrics(countAvariaCollaborators(firstRows), countAvariaCollaborators(secondRows))} labels={labels} />
    <ComparisonTable title="Comparação de produtos" label="Família de produto" metrics={pairedMetrics(countProductFamilies(firstRows), countProductFamilies(secondRows))} labels={labels} />
  </section>;
}