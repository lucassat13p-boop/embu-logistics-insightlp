import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { variation } from "@/lib/comparison";
import { periodLabel, type PeriodSelection } from "@/lib/period";
import { countOnHold, driverRanking, uniqueDrivers } from "@/lib/on-hold-analysis";
import type { RecordRow } from "@/lib/data";
import { Empty } from "./blocks";

type Metric = { name: string; first: number | null; second: number | null };
const paired = (a: { name: string; value: number }[], b: { name: string; value: number }[]) => {
  const first = new Map(a.map((item) => [item.name, item.value]));
  const second = new Map(b.map((item) => [item.name, item.value]));
  return [...new Set([...first.keys(), ...second.keys()])].map((name) => ({ name, first: first.get(name) ?? 0, second: second.get(name) ?? 0 })).sort((x, y) => (y.first + y.second) - (x.first + x.second));
};

function Change({ first, second, analysis }: { first: number | null; second: number | null; analysis?: boolean }) {
  const change = variation(first, second);
  const Icon = change.direction === "increase" ? ArrowUpRight : change.direction === "decrease" ? ArrowDownRight : Minus;
  const color = change.direction === "increase" ? "text-destructive" : change.direction === "decrease" ? "text-success" : "text-muted-foreground";
  return <span className={`inline-flex items-center gap-1 ${color}`}><Icon className="h-4 w-4" />{analysis ? change.analysis : change.label}</span>;
}

function Table({ title, label, metrics, labels }: { title: string; label: string; metrics: Metric[]; labels: [string, string] }) {
  if (!metrics.length) return <div><h3 className="mb-2 text-sm font-semibold">{title}</h3><Empty /></div>;
  return <div><h3 className="mb-2 text-sm font-semibold">{title}</h3><div className="max-h-96 overflow-auto rounded-md border"><table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="px-3 py-2 text-left">{label}</th><th className="px-3 py-2 text-right">{labels[0]}</th><th className="px-3 py-2 text-right">{labels[1]}</th><th className="px-3 py-2 text-right">Variação</th><th className="px-3 py-2 text-left">Análise</th></tr></thead><tbody>{metrics.map((item) => <tr key={item.name} className="border-t"><th className="px-3 py-2 text-left">{item.name}</th><td className="px-3 py-2 text-right tabular-nums">{item.first ?? "Sem informação"}</td><td className="px-3 py-2 text-right tabular-nums">{item.second ?? "Sem informação"}</td><td className="px-3 py-2 text-right"><Change first={item.first} second={item.second} /></td><td className="px-3 py-2"><Change first={item.first} second={item.second} analysis /></td></tr>)}</tbody></table></div></div>;
}

export function OnHoldComparison({ firstRows, secondRows, firstPeriod, secondPeriod }: { firstRows: RecordRow[]; secondRows: RecordRow[]; firstPeriod: PeriodSelection; secondPeriod: PeriodSelection }) {
  if (!firstRows.length && !secondRows.length) return <Empty text="Nenhum dado disponível" />;
  const labels: [string, string] = [periodLabel(firstPeriod), periodLabel(secondPeriod)];
  const main: Metric[] = [{ name: "Insucessos", first: firstRows.length, second: secondRows.length }, { name: "Drivers", first: uniqueDrivers(firstRows), second: uniqueDrivers(secondRows) }, { name: "Devoluções", first: null, second: null }];
  const groups = [
    { title: "Comparação de motivos", label: "Motivo", data: paired(countOnHold(firstRows, "reason"), countOnHold(secondRows, "reason")) },
    { title: "Comparação de bairros", label: "Bairro", data: paired(countOnHold(firstRows, "neighborhood"), countOnHold(secondRows, "neighborhood")) },
    { title: "Comparação de motoristas", label: "Motorista", data: paired(driverRanking(firstRows).map(({ name, value }) => ({ name, value })), driverRanking(secondRows).map(({ name, value }) => ({ name, value }))) },
    { title: "Comparação de tratativas", label: "Tratativa", data: paired(countOnHold(firstRows, "treatment"), countOnHold(secondRows, "treatment")) },
    { title: "Comparação de tentativas de entrega", label: "Tentativas", data: paired(countOnHold(firstRows, "delivery_attempts"), countOnHold(secondRows, "delivery_attempts")) },
  ];
  const changes = groups.flatMap((group) => group.data.map((item) => ({ name: `${group.label}: ${item.name}`, change: variation(item.first, item.second) }))).filter((item) => item.change.percent !== null);
  const growth = [...changes].filter((item) => (item.change.percent ?? 0) > 0).sort((a, b) => (b.change.percent ?? 0) - (a.change.percent ?? 0))[0];
  const drop = [...changes].filter((item) => (item.change.percent ?? 0) < 0).sort((a, b) => (a.change.percent ?? 0) - (b.change.percent ?? 0))[0];
  return <section className="space-y-6 border-y py-5"><div><h2 className="text-lg font-semibold">Comparação de períodos</h2><p className="text-sm text-muted-foreground">{labels.join(" × ")}</p></div><div><h3 className="mb-2 text-sm font-semibold">Resumo da evolução</h3><dl className="grid gap-3 sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Variação geral</dt><dd className="font-semibold"><Change first={firstRows.length} second={secondRows.length} analysis /></dd></div><div><dt className="text-xs text-muted-foreground">Maior crescimento</dt><dd className="font-semibold">{growth ? `${growth.name} — ${growth.change.label}` : "Nenhum dado disponível"}</dd></div><div><dt className="text-xs text-muted-foreground">Maior queda</dt><dd className="font-semibold">{drop ? `${drop.name} — ${drop.change.label}` : "Nenhum dado disponível"}</dd></div></dl></div><Table title="Indicadores principais" label="Indicador" metrics={main} labels={labels} />{groups.map((group) => <Table key={group.title} title={group.title} label={group.label} metrics={group.data} labels={labels} />)}</section>;
}