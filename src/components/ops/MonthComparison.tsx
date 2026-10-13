import { countBy, hasField, type RecordRow } from "@/lib/data";
import { filterByMonths, monthLabel, PERIOD_EMPTY } from "@/lib/period";
import type { FieldKey } from "@/lib/modules";
import { Empty } from "./blocks";

export function MonthComparison({ rows, months, classifications }: { rows: RecordRow[]; months: string[]; classifications: string[] }) {
  const periods = months.map((month) => ({ month, rows: filterByMonths(rows, [month]) }));
  const dimensions: { field: FieldKey; title: string }[] = [
    { field: "shift", title: "Turnos" },
    { field: "collaborator", title: "Colaboradores" },
    { field: "product", title: "Produtos" },
  ];
  const heading = <tr><th className="sticky left-0 bg-card px-3 py-3 text-left">Indicador</th>{periods.map(({ month }) => <th key={month} className="min-w-40 px-3 py-3 text-right">{monthLabel(month)}</th>)}</tr>;
  const cell = "px-3 py-2 text-right tabular-nums";
  return (
    <section aria-label="Comparação de meses" className="space-y-5 border-y py-5">
      <h2 className="text-lg font-semibold">Comparação de meses</h2>
      <p className="text-sm text-muted-foreground">{months.map(monthLabel).join(" × ")}</p>
      {periods.filter((period) => !period.rows.length).map(({ month }) => <div key={month}><h3 className="font-medium">{monthLabel(month)}</h3><Empty text={PERIOD_EMPTY} /></div>)}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm" aria-label="Comparação de totais e tipos">
          <thead className="bg-muted/60">{heading}</thead>
          <tbody>
            <tr className="border-t font-semibold"><th className="px-3 py-2 text-left">Total de Avarias</th>{periods.map(({ month, rows: data }) => <td key={month} className={cell}>{data.length ? data.length.toLocaleString("pt-BR") : PERIOD_EMPTY}</td>)}</tr>
            {classifications.map((type) => <tr key={type} className="border-t"><th className="px-3 py-2 text-left font-normal">{type}</th>{periods.map(({ month, rows: data }) => <td key={month} className={cell}>{hasField(data, "classification") ? data.filter((row) => row.classification === type).length.toLocaleString("pt-BR") : "Sem informação"}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      {dimensions.map(({ field, title }) => {
        const counts = periods.map((period) => new Map(countBy(period.rows, field).map(({ name, value }) => [name, value])));
        const names = countBy(filterByMonths(rows, months), field).map(({ name }) => name);
        return <div key={field} className="space-y-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {!names.length ? <Empty /> : <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full text-sm" aria-label={`Comparação de ${title.toLowerCase()}`}>
              <thead className="sticky top-0 bg-muted">{heading}</thead>
              <tbody>{names.map((name) => <tr key={name} className="border-t"><th className="min-w-48 max-w-80 break-words px-3 py-2 text-left font-normal">{name}</th>{periods.map((period, index) => <td key={period.month} className={cell}>{hasField(period.rows, field) ? (counts[index]?.get(name) ?? 0).toLocaleString("pt-BR") : "Sem informação"}</td>)}</tr>)}</tbody>
            </table>
          </div>}
        </div>;
      })}
    </section>
  );
}