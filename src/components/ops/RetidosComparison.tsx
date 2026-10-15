import { variation } from "@/lib/comparison";
import { countBy, type RecordRow } from "@/lib/data";
import { periodLabel, type PeriodSelection } from "@/lib/period";
import { Empty } from "./blocks";

type Metric = { name: string; first: number; second: number };
function ComparisonTable({ title, metrics, labels }: { title: string; metrics: Metric[]; labels: string[] }) {
  return <div><h3 className="mb-2 text-sm font-semibold">{title}</h3>{!metrics.length ? <Empty /> : <div className="max-h-96 overflow-auto rounded-md border"><table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2 text-left">Indicador</th><th className="px-3 py-2 text-right">Período 1 · {labels[0]}</th><th className="px-3 py-2 text-right">Período 2 · {labels[1]}</th><th className="px-3 py-2 text-right">Variação</th><th className="px-3 py-2 text-left">Análise</th></tr></thead><tbody>{metrics.map((metric) => {
    const change = variation(metric.first, metric.second);
    const color = change.direction === "increase" ? "text-destructive" : change.direction === "decrease" ? "text-success" : "text-muted-foreground";
    return <tr key={metric.name} className="border-t"><th className="px-3 py-2 text-left font-medium">{metric.name}</th><td className="px-3 py-2 text-right tabular-nums">{metric.first.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right tabular-nums">{metric.second.toLocaleString("pt-BR")}</td><td className={`px-3 py-2 text-right ${color}`}>{change.label}</td><td className={`px-3 py-2 ${color}`}>{change.analysis}</td></tr>;
  })}</tbody></table></div>}</div>;
}
export function RetidosComparison({ firstRows, secondRows, firstPeriod, secondPeriod }: { firstRows: RecordRow[]; secondRows: RecordRow[]; firstPeriod: PeriodSelection; secondPeriod: PeriodSelection }) {
  if (!firstRows.length && !secondRows.length) return <Empty />;
  const labels = [periodLabel(firstPeriod), periodLabel(secondPeriod)];
  const paired = (field: "reason" | "follow_up_action") => {
    const first = new Map(countBy(firstRows, field).map((item) => [item.name, item.value]));
    const second = new Map(countBy(secondRows, field).map((item) => [item.name, item.value]));
    return [...new Set([...first.keys(), ...second.keys()])].map((name) => ({ name, first: first.get(name) ?? 0, second: second.get(name) ?? 0 })).sort((a, b) => b.first + b.second - a.first - a.second);
  };
  return <section className="space-y-5 border-y py-5"><h2 className="text-lg font-semibold">Comparação de períodos</h2><ComparisonTable title="Total de pacotes retirados" labels={labels} metrics={[{ name: "Total de pacotes retirados", first: firstRows.length, second: secondRows.length }]} /><ComparisonTable title="Comparação de motivos da retirada" labels={labels} metrics={paired("reason")} /><ComparisonTable title="Comparação de Follow Up Action" labels={labels} metrics={paired("follow_up_action")} /></section>;
}