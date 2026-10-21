import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Banknote, ChevronLeft, ChevronRight, Package, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarBlock, Empty, PageHeader, Panel, Ranking } from "./blocks";
import { PieBlock } from "./PieBlock";
import { ShiftIcon } from "./ShiftIcon";
import { RankingPrivacyToggle } from "./RankingPrivacy";
import { useInitialTodayPeriod } from "@/hooks/use-initial-today-period";
import { EMPTY_PERIOD, filterByPeriod } from "@/lib/period";
import { byDate } from "@/lib/data";
import { floatingRankings } from "@/lib/floating-ranking";
import { FLOATING_COLUMNS, floatingActiveQuery, floatingMapping, floatingShift, floatingValue } from "@/lib/floating-packages";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function FloatingDashboard() {
  const { data: active } = useSuspenseQuery(floatingActiveQuery());
  const [period, setPeriod] = useInitialTodayPeriod();
  const [shift, setShift] = useState("all");
  const [rankingMode, setRankingMode] = useState("general");
  const [mapping, setMapping] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ key: "record_date", ascending: false });
  const rows = useMemo(() => filterByPeriod(active.rows, period).filter((row) => (shift === "all" || floatingShift(row.shift) === shift) && (mapping === "all" || floatingMapping(row) === mapping)), [active.rows, period, shift, mapping]);
  const tableRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return rows.filter((row) => !query || ["order_id", "driver_name", "route", "to_number", "product", "collaborator"].some((key) => String(floatingValue(row, key) ?? "").toLocaleLowerCase("pt-BR").includes(query))).sort((a, b) => {
      const av = floatingValue(a, sort.key), bv = floatingValue(b, sort.key);
      if (av === null) return bv === null ? 0 : 1;
      if (bv === null) return -1;
      return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true })) * (sort.ascending ? 1 : -1);
    });
  }, [rows, search, sort]);
  const pages = Math.max(1, Math.ceil(tableRows.length / 25));
  const rankings = useMemo(() => floatingRankings(rows, rankingMode, shift), [rows, rankingMode, shift]);
  const shownPage = Math.min(page, pages - 1);
  const breakdown = (resolver: (row: typeof rows[number]) => string) => {
    const counts = new Map<string, number>();
    rows.forEach((row) => { const key = resolver(row); counts.set(key, (counts.get(key) ?? 0) + 1); });
    return [...counts].map(([name, value]) => ({ name, value }));
  };
  const validValues = rows.flatMap((r) => typeof r.quantity === "number" && Number.isFinite(r.quantity) ? [r.quantity] : []);
  const gmv = validValues.length ? currency(validValues.reduce((sum, value) => sum + value, 0)) : "Nenhum dado disponível";
  const clear = () => { setPeriod({ ...EMPTY_PERIOD }); setShift("all"); setMapping("all"); setSearch(""); setPage(0); };
  const kpis = [{ label: "Total de pacotes", value: rows.length, icon: <Package className="h-5 w-5" />, color: "text-primary" }, { label: "Valor total (GMV)", value: gmv, icon: <Banknote className="h-5 w-5" />, color: "text-success" }, ...["AM1", "PM1", "AM2"].map((s) => ({ label: s, value: rows.filter((r) => floatingShift(r.shift) === s).length, icon: <ShiftIcon shift={s} className="h-5 w-5" />, color: "text-primary" }))];
  const changePeriod = (next: typeof period) => { setPeriod(next); setPage(0); };
  return <div className="space-y-4"><PageHeader title="Pacotes Flutuantes" subtitle="Monitoramento dos pacotes que permanecem na base de possíveis perdas." action={<Button asChild><Link to="/importar" search={{ modulo: "pacotes_flutuantes" }}><Upload className="h-4 w-4" />Importar relatório</Link></Button>} />
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1"><Label>Período</Label><Select value={period.kind} onValueChange={(kind) => changePeriod({ ...period, kind: kind as typeof period.kind })}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Dia</SelectItem><SelectItem value="week">Semana</SelectItem><SelectItem value="month">Mês</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent></Select></div>
      {period.kind === "day" && <Input type="date" className="w-auto" aria-label="Data" value={period.date} onChange={(e) => changePeriod({ ...period, date: e.target.value })} />}
      {period.kind === "week" && <Input type="week" className="w-auto" aria-label="Semana" value={period.week} onChange={(e) => changePeriod({ ...period, week: e.target.value })} />}
      {period.kind === "month" && <Input type="month" className="w-auto" aria-label="Mês" value={period.months[0] ?? ""} onChange={(e) => changePeriod({ ...period, months: e.target.value ? [e.target.value] : [] })} />}
      {period.kind === "custom" && <><Input type="date" className="w-auto" aria-label="Data inicial" value={period.start} onChange={(e) => changePeriod({ ...period, start: e.target.value })} /><Input type="date" className="w-auto" aria-label="Data final" value={period.end} onChange={(e) => changePeriod({ ...period, end: e.target.value })} /></>}
      <div className="space-y-1"><Label>Turno</Label><Select value={shift} onValueChange={(v) => { setShift(v); setPage(0); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{["AM1", "AM2", "PM1"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Mapeamento</Label><Select value={mapping} onValueChange={(v) => { setMapping(v); setPage(0); }}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{["Expedição", "Recebimento", "Não identificado"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
      <Button variant="ghost" onClick={clear}><X className="h-4 w-4" />Limpar filtros</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{kpis.map((item) => <div key={item.label} className="min-w-0 rounded-md border bg-card p-4 shadow-card"><div className={`mb-2 flex items-center justify-between gap-2 ${item.color}`}><p className="text-xs font-semibold uppercase">{item.label}</p>{item.icon}</div><p className="break-words text-2xl font-bold tabular-nums">{active.batchId ? typeof item.value === "number" ? item.value.toLocaleString("pt-BR") : item.value : "Nenhum dado disponível"}</p></div>)}</div>
    {rows.length > 0 && <div className="floating-charts grid items-stretch gap-4 xl:grid-cols-3"><Panel title="Evolução de Pacotes Flutuantes"><BarBlock data={byDate(rows).map((d) => ({ name: d.date.split("-").reverse().join("/"), value: d.value }))} limit={rows.length} height={352} /></Panel><Panel title="Distribuição por turno"><PieBlock data={breakdown((r) => floatingShift(r.shift))} categories={["AM1", "AM2", "PM1", "Não identificado"]} total={rows.length} label="Distribuição por turno" /></Panel><Panel title="Mapeamento"><PieBlock data={breakdown(floatingMapping)} categories={["Expedição", "Recebimento", "Não identificado"]} total={rows.length} label="Mapeamento" /></Panel></div>}
    <Panel title="Top 10 colaboradores com mais pacotes" action={<div className="flex flex-wrap items-center gap-2"><div className="flex rounded-md border bg-muted p-1" role="group" aria-label="Modo do ranking"><Button size="sm" variant={rankingMode === "general" ? "default" : "ghost"} aria-pressed={rankingMode === "general"} onClick={() => setRankingMode("general")}>Ranking geral</Button><Button size="sm" variant={rankingMode === "shift" ? "default" : "ghost"} aria-pressed={rankingMode === "shift"} onClick={() => setRankingMode("shift")}>Por turno</Button></div><RankingPrivacyToggle /></div>}>
      {rankingMode === "general" ? <Ranking data={rankings[0]?.data ?? []} limit={10} personKind="Colaborador" showPrivacyToggle={false} /> : <div className={shift === "all" ? "grid gap-6 lg:grid-cols-3" : "grid gap-6"}>{rankings.map((ranking) => <div key={ranking.shift} className="min-w-0"><h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary"><ShiftIcon shift={ranking.shift} className="h-4 w-4" />{ranking.shift} — TOP 5</h4><Ranking data={ranking.data} limit={5} personKind="Colaborador" showPrivacyToggle={false} /></div>)}</div>}
    </Panel>
    <Panel title="Lista de Pacotes Flutuantes"><div className="relative mb-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar BR, motorista, cluster, AT, produto ou colaborador" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></div>
      <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[1600px] text-sm"><thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{FLOATING_COLUMNS.map(([key, name]) => <th key={key} className="px-3 py-2"><Button variant="ghost" size="sm" className="h-auto px-0 text-xs" onClick={() => { setSort({ key, ascending: sort.key === key ? !sort.ascending : true }); setPage(0); }}>{name}{sort.key === key && (sort.ascending ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</Button></th>)}</tr></thead><tbody>{tableRows.slice(shownPage * 25, (shownPage + 1) * 25).map((row) => <tr key={row.id} className="border-t hover:bg-accent/40">{FLOATING_COLUMNS.map(([key]) => {
        const value = floatingValue(row, key);
        const display = value === null || value === "" ? "Sem informação" : key === "record_date" ? String(value).split("-").reverse().join("/") : key === "quantity" && typeof value === "number" ? currency(value) : String(value);
        return <td key={key} className="max-w-64 truncate px-3 py-2" title={display}>{key === "shift" || key === "mapping" ? <span className="inline-flex rounded bg-primary-soft px-2 py-0.5 text-xs text-primary">{display}</span> : display}</td>;
      })}</tr>)}</tbody></table>{!tableRows.length && <Empty />}</div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{tableRows.length.toLocaleString("pt-BR")} pacotes</span><div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="Página anterior" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>{shownPage + 1} / {pages}</span><Button size="icon" variant="outline" aria-label="Próxima página" disabled={shownPage + 1 >= pages} onClick={() => setPage(shownPage + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
    </Panel>
  </div>;
}
