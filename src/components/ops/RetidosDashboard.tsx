import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { countBy, type RecordRow } from "@/lib/data";
import { HUB_NAME, moduleByKey, type FieldKey } from "@/lib/modules";
import { availableMonths, EMPTY_PERIOD, filterByPeriod, type PeriodSelection } from "@/lib/period";
import { countRetidosReasons, filterRetidosShifts, parseRetidosTime, RETIDOS_SHIFTS, retidosEvolution, retidosVehicle, summarizedRetidosReason, type RetidosShift } from "@/lib/retidos-analysis";
import { BarBlock, Empty, Kpi, LineBlock, PageHeader, Panel } from "./blocks";
import { PeriodFilter } from "./PeriodFilter";
import { RecordsTable, type PresentationColumn } from "./RecordsTable";
import { RetidosComparison } from "./RetidosComparison";

function Breakdown({ rows, field, label }: { rows: RecordRow[]; field: "reason" | "follow_up_action"; label: string }) {
  const [all, setAll] = useState(false);
  const data = field === "reason" ? countRetidosReasons(rows) : countBy(rows, field);
  if (!data.length) return <Empty />;
  const shown = all ? data : data.slice(0, 10);
  return <div className="space-y-4"><BarBlock data={shown} horizontal limit={shown.length} rowHeight={field === "reason" ? 28 : 38} yAxisWidth={field === "reason" ? 130 : 190} valueName="Quantidade" emptyText="Nenhum dado disponível" /><div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="px-3 py-2 text-left">{label}</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2 text-right">Percentual</th></tr></thead><tbody>{shown.map((item) => <tr key={item.name} className="border-t"><td className="px-3 py-2">{item.name}</td><td className="px-3 py-2 text-right tabular-nums">{item.value.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right tabular-nums">{(item.value / rows.length * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td></tr>)}</tbody></table></div>{data.length > 10 && <Button variant="outline" size="sm" onClick={() => setAll((value) => !value)}>{all ? "Mostrar principais" : "Visualizar todos"}</Button>}</div>;
}
const columns: FieldKey[] = ["tracking_number", "route", "exception_order_id", "reason", "follow_up_action", "status", "create_time", "eha_inbound_time", "resolve_time"];
const forcedColumns = columns.filter((field) => field !== "route");
const labels = { ...moduleByKey("retidos_veiculos")?.fieldLabels, tracking_number: "BR / SPX Tracking Number", reason: "Motivo original / detalhamento", create_time: "Data / Create Time", eha_inbound_time: "EHA Inbound Time", resolve_time: "Resolve Time" };
const summaryColumn: PresentationColumn = { key: "reason_summary", label: "Motivo resumido", before: "reason", value: (row) => summarizedRetidosReason(row.reason) };
const vehicleColumn: PresentationColumn = { key: "vehicle", label: "Veículo", before: "reason", value: retidosVehicle };

export function RetidosDashboard({ allRows }: { allRows: RecordRow[] }) {
  const [period, setPeriod] = useState<PeriodSelection>({ ...EMPTY_PERIOD });
  const [comparison, setComparison] = useState<PeriodSelection>({ ...EMPTY_PERIOD });
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [shifts, setShifts] = useState<RetidosShift[]>([]);
  const originals = useMemo(() => allRows.filter((row) => row.module === "retidos_veiculos").map((row) => ({ ...row, record_date: parseRetidosTime(row.create_time).date })), [allRows]);
  const months = useMemo(() => availableMonths(originals), [originals]);
  const rows = useMemo(() => filterRetidosShifts(filterByPeriod(originals, period), shifts), [originals, period, shifts]);
  const secondRows = useMemo(() => filterRetidosShifts(filterByPeriod(originals, comparison), shifts), [originals, comparison, shifts]);
  const allShifts = !shifts.length || RETIDOS_SHIFTS.every((shift) => shifts.includes(shift));
  const tableColumns = useMemo(() => originals.some((row) => retidosVehicle(row)) ? [vehicleColumn, summaryColumn] : [summaryColumn], [originals]);
  return <div className="space-y-5"><PageHeader title="Retidos de Veículos" subtitle={HUB_NAME} action={<Button asChild><Link to="/importar" search={{ modulo: "retidos_veiculos" }}><Upload className="h-4 w-4" />Importar relatório</Link></Button>} /><PeriodFilter months={months} period={period} onChange={setPeriod} mode={mode} onModeChange={setMode} comparison={comparison} onComparisonChange={setComparison} onClear={() => { setPeriod({ ...EMPTY_PERIOD }); setComparison({ ...EMPTY_PERIOD }); setMode("single"); setShifts([]); }} /><div><Label>Turnos</Label><div className="mt-2 flex flex-wrap items-center gap-2"><Button size="sm" variant={allShifts ? "default" : "outline"} aria-pressed={allShifts} onClick={() => setShifts([])}>Todos</Button><ToggleGroup type="multiple" variant="outline" size="sm" value={shifts} onValueChange={(values) => setShifts(values.filter((value): value is RetidosShift => RETIDOS_SHIFTS.some((shift) => shift === value)))}>{RETIDOS_SHIFTS.map((shift) => <ToggleGroupItem key={shift} value={shift}>{shift}</ToggleGroupItem>)}</ToggleGroup></div></div><div className="max-w-lg"><Kpi accent label="TOTAL DE PACOTES RETIRADOS" value={rows.length || null} /></div><Panel title="Principais motivos da retirada"><Breakdown rows={rows} field="reason" label="Motivo" /></Panel><Panel title="Follow Up Action"><Breakdown rows={rows} field="follow_up_action" label="Ação" /></Panel><Panel title="Evolução dos pacotes retirados">{retidosEvolution(rows, period).length ? <LineBlock data={retidosEvolution(rows, period)} /> : <Empty />}</Panel>{mode === "compare" && <RetidosComparison firstRows={rows} secondRows={secondRows} firstPeriod={period} secondPeriod={comparison} />}<Panel title="Registros de Retidos de Veículos"><RecordsTable key={`${JSON.stringify(period)}-${shifts.join()}`} rows={rows} columns={columns} forceColumns={forcedColumns} columnLabels={labels} presentationColumns={tableColumns} wrapColumns={["reason"]} emptyText="Nenhum dado disponível" /></Panel></div>;
}