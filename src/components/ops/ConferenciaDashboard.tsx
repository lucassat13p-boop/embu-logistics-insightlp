import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Upload, X, Route, Clock3, Users, ScanLine, TriangleAlert, PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, PageHeader, Panel } from "./blocks";
import { RankingPrivacyToggle, useRankingPrivacy } from "./RankingPrivacy";
import { ShiftIcon } from "./ShiftIcon";
import { useInitialTodayPeriod } from "@/hooks/use-initial-today-period";
import { availableMonths, EMPTY_PERIOD, filterByPeriod, monthLabel, type PeriodKind } from "@/lib/period";
import { auditFromRecord, auditQuery, auditRanking, durationLabel, meanDuration, type AuditRow } from "@/lib/conferencia";

const SHIFTS = ["AM1", "AM2", "PM1"] as const;
const fmt = (v: number | null) => v === null ? "Sem informação" : v.toLocaleString("pt-BR");
const wall = (v: string | null) => { if (!v) return "Sem informação"; const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](.*)$/); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : v; };
type SortKey = "date" | "shift" | "route" | "location" | "operator" | "start" | "end" | "duration" | "scanned" | "missing" | "missorted" | "status";
const COLUMNS: { key: SortKey; label: string }[] = [{ key: "date", label: "Data operacional" }, { key: "shift", label: "Turno" }, { key: "route", label: "AT/TO" }, { key: "location", label: "Corredor / Gaiola" }, { key: "operator", label: "Colaborador" }, { key: "start", label: "Início" }, { key: "end", label: "Fim" }, { key: "duration", label: "Tempo de conferência" }, { key: "scanned", label: "Escaneados" }, { key: "missing", label: "Faltantes" }, { key: "missorted", label: "Missorted" }, { key: "status", label: "Status da validação" }];

export function ConferenciaDashboard() {
  const { data } = useSuspenseQuery(auditQuery());
  const all = useMemo(() => data.map(auditFromRecord), [data]);
  const [period, setPeriod] = useInitialTodayPeriod();
  const [shift, setShift] = useState("all");
  const [operator, setOperator] = useState("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"general" | "shift">("general");
  const [speed, setSpeed] = useState(false);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "start", desc: true });
  const months = availableMonths(all);
  const operators = useMemo(() => [...new Map(all.filter((r) => r.operator.key).map((r) => [r.operator.key, r.operator.label])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [all]);
  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("pt-BR");
    return filterByPeriod(all, period).filter((r) => (shift === "all" || r.shift === shift) && (operator === "all" || r.operator.key === operator) && (!needle || [r.route, r.operator.label, r.operator.login].some((v) => v?.toLocaleLowerCase("pt-BR").includes(needle))));
  }, [all, period, shift, operator, search]);
  const rank = auditRanking(rows, speed);
  const productive = auditRanking(rows);
  const sum = (key: "scanned" | "missing" | "missorted") => { const values = rows.flatMap((r) => r[key] === null ? [] : [r[key]]); return values.length ? values.reduce((a, b) => a + b, 0) : null; };
  const cards = [{ label: "TOTAL DE ROTAS CONFERIDAS", value: rows.length ? fmt(new Set(rows.map((r) => r.route)).size) : null }, { label: "TEMPO MÉDIO DE CONFERÊNCIA", value: meanDuration(rows) === null ? null : durationLabel(meanDuration(rows)) }, { label: "COLABORADORES", value: rows.some((r) => r.operator.key) ? fmt(new Set(rows.map((r) => r.operator.key).filter(Boolean)).size) : null }, { label: "PEDIDOS ESCANEADOS", value: sum("scanned") === null ? null : fmt(sum("scanned")) }, { label: "PEDIDOS FALTANTES", value: sum("missing") === null ? null : fmt(sum("missing")) }, { label: "PEDIDOS MISSORTED", value: sum("missorted") === null ? null : fmt(sum("missorted")) }];
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = sort.key === "operator" ? a.operator.label : a[sort.key];
    const bv = sort.key === "operator" ? b.operator.label : b[sort.key];
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    const diff = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true });
    return (sort.desc ? -diff : diff) || a.id.localeCompare(b.id);
  }), [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const change = () => setPage(0);
  const controls = <div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-md border p-1"><Button size="sm" variant={mode === "general" ? "default" : "ghost"} onClick={() => setMode("general")}>Ranking geral</Button><Button size="sm" variant={mode === "shift" ? "default" : "ghost"} onClick={() => setMode("shift")}>Por turno</Button></div><div className="inline-flex rounded-md border p-1"><Button size="sm" variant={!speed ? "default" : "ghost"} onClick={() => setSpeed(false)}>Mais rotas</Button><Button size="sm" variant={speed ? "default" : "ghost"} onClick={() => setSpeed(true)}>Menor tempo médio</Button></div><RankingPrivacyToggle /></div>;
  const rankPanel = <Panel title={`Top 5 colaboradores${mode === "shift" ? " por turno" : ""} — ${speed ? "Menor tempo médio" : "Mais rotas"}`} subtitle={speed ? "Mínimo de 3 rotas conferidas por colaborador no recorte" : undefined} action={controls}>{mode === "general" ? <AuditRankingList data={rank} speed={speed} /> : <div className="grid gap-6 lg:grid-cols-3">{SHIFTS.map((s) => <div key={s} className="min-w-0"><h4 className="mb-4 flex items-center gap-2 font-semibold"><ShiftIcon shift={s} className="h-5 w-5" />{s} — Top 5</h4><AuditRankingList data={auditRanking(rows.filter((r) => r.shift === s), speed)} speed={speed} /></div>)}</div>}</Panel>;
  const chart = <Panel title="Rotas conferidas por colaborador" className="flex flex-col" bodyClassName="flex min-h-0 flex-1 flex-col"><AuditProductivityChart data={productive} /></Panel>;
  return <div className="space-y-5"><PageHeader title="CONFERÊNCIA DE ROTAS" subtitle="Acompanhamento das conferências, produtividade dos colaboradores e tempo médio por rota." action={<Button asChild><Link to="/importar" search={{ modulo: "conferencia" }}><Upload className="h-4 w-4" />Importar relatório de Conferência</Link></Button>} />
    <div className="space-y-3 rounded-md border bg-card p-3"><div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label>Período</Label><Select value={period.kind} onValueChange={(kind) => { setPeriod({ ...period, kind: kind as PeriodKind }); change(); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Dia</SelectItem><SelectItem value="week">Semana</SelectItem><SelectItem value="month">Mês</SelectItem><SelectItem value="custom">Personalizado</SelectItem></SelectContent></Select></div>
    {period.kind === "day" && <Input type="date" aria-label="Data operacional" className="w-auto" value={period.date} onChange={(e) => { setPeriod({ ...period, date: e.target.value }); change(); }} />}{period.kind === "week" && <Input type="week" aria-label="Semana operacional" className="w-auto" value={period.week} onChange={(e) => { setPeriod({ ...period, week: e.target.value }); change(); }} />}{period.kind === "month" && <Select value={period.months[0] ?? "all"} onValueChange={(v) => { setPeriod({ ...period, months: v === "all" ? [] : [v] }); change(); }}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os meses</SelectItem>{months.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}</SelectContent></Select>}{period.kind === "custom" && <><Input type="date" aria-label="Data inicial" className="w-auto" value={period.start} onChange={(e) => { setPeriod({ ...period, start: e.target.value }); change(); }} /><Input type="date" aria-label="Data final" className="w-auto" value={period.end} onChange={(e) => { setPeriod({ ...period, end: e.target.value }); change(); }} /></>}
    <div className="space-y-1"><Label>Turno</Label><Select value={shift} onValueChange={(v) => { setShift(v); change(); }}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><div className="min-w-0 space-y-1"><Label>Colaborador</Label><Select value={operator} onValueChange={(v) => { setOperator(v); change(); }}><SelectTrigger className="w-60 max-w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{operators.map(([key, name]) => key && <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></div><Button variant="ghost" size="sm" onClick={() => { setPeriod({ ...EMPTY_PERIOD }); setShift("all"); setOperator("all"); setSearch(""); change(); }}><X className="h-4 w-4" />Limpar filtros</Button></div>
    <Input value={search} onChange={(e) => { setSearch(e.target.value); change(); }} placeholder="Pesquisar AT/TO, nome ou login do colaborador" aria-label="Pesquisar conferências" className="max-w-md" /></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{cards.map((c, i) => {
      const tones = ["blue", "orange", "purple", "green", "amber", "red"];
      const icons = [Route, Clock3, Users, ScanLine, TriangleAlert, PackageX];
      const Icon = icons[i] ?? Route;
      return <div key={c.label} className={`summary-metric summary-tone-${tones[i]}`}><div className="summary-metric-heading"><span className="summary-metric-icon" aria-hidden="true"><Icon className="h-5 w-5" /></span><p className="summary-metric-label text-muted-foreground">{c.label}</p></div><p className={c.value === null ? "summary-metric-empty" : "break-words font-display text-2xl font-bold tabular-nums text-summary-accent"}>{c.value ?? "Nenhum dado disponível"}</p></div>;
    })}</div>
    {mode === "general" ? <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">{chart}{rankPanel}</div> : <div className="space-y-4">{rankPanel}{chart}</div>}
    <Panel title="Detalhamento das conferências" subtitle={`${rows.length.toLocaleString("pt-BR")} registros`}>
      {!rows.length ? <Empty /> : <><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left text-muted-foreground">{COLUMNS.map((c) => <th key={c.key} className="whitespace-nowrap p-1"><Button variant="ghost" size="sm" className="h-8 px-1 text-xs" onClick={() => { setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : false }); change(); }}>{c.label}{sort.key === c.key ? sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}</Button></th>)}</tr></thead><tbody>{sorted.slice(currentPage * 20, currentPage * 20 + 20).map((row) => <tr key={row.id} className="border-b hover:bg-muted/40">{COLUMNS.map((c) => {
        const value = cellValue(row, c.key);
        const title = c.key === "operator" ? `${row.operator.label}${row.operator.login ? ` · ${row.operator.login}` : ""}` : value;
        return <td key={c.key} className="p-2 whitespace-nowrap"><div className="max-w-52 truncate" title={title}>{value}</div></td>;
      })}</tr>)}</tbody></table></div><div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-sm"><span>{rows.length} registros · {currentPage + 1} / {pages}</span><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Próxima</Button></div></>}
    </Panel>
  </div>;
}
function cellValue(row: AuditRow, key: SortKey) {
  if (key === "operator") return row.operator.label;
  if (key === "date") return row.date?.split("-").reverse().join("/") ?? "Sem informação";
  if (key === "start" || key === "end") return wall(row[key]);
  if (key === "duration") return durationLabel(row.duration);
  if (key === "scanned" || key === "missing" || key === "missorted") return fmt(row[key]);
  return row[key];
}
function AuditRankingList({ data, speed }: { data: ReturnType<typeof auditRanking>; speed: boolean }) {
  const { personName } = useRankingPrivacy();
  if (!data.length) return <Empty text={speed ? "Nenhum colaborador elegível com 3 rotas e duração válida." : undefined} />;
  const max = Math.max(...data.map((r) => speed ? r.average ?? 0 : r.routes));
  return <ol className="space-y-4">{data.map((r, index) => <li key={r.key} className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary-soft text-sm font-semibold text-primary">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><span className="min-w-0 break-words text-sm" title={personName(r.name)}>{personName(r.name)}</span><span className="shrink-0 text-sm font-semibold tabular-nums">{speed ? durationLabel(r.average) : `${r.routes.toLocaleString("pt-BR")} rotas`}</span></div>{speed && <p className="mt-1 text-xs text-muted-foreground">{r.routes} rotas conferidas</p>}<div className="mt-2 h-2 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${max ? (speed ? r.average ?? 0 : r.routes) / max * 100 : 0}%` }} /></div></div></li>)}</ol>;
}
function AuditProductivityChart({ data }: { data: ReturnType<typeof auditRanking> }) {
  const { personName } = useRankingPrivacy();
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((r) => r.routes));
  return <div className="flex h-full min-h-0 w-full flex-col" role="list" aria-label="Top 5 rotas conferidas por colaborador">{data.map((r) => <div key={r.key} className="grid min-h-0 flex-1 grid-cols-[minmax(0,45fr)_minmax(0,55fr)] items-center gap-3" role="listitem"><span className="min-w-0 truncate text-left text-sm text-muted-foreground" title={personName(r.name)}>{personName(r.name)}</span><div className="flex min-w-0 items-center gap-2" title={`${personName(r.name)}: ${r.routes} rotas`}><div className="h-6 min-w-0 rounded-sm bg-primary" style={{ width: `${max ? r.routes / max * 100 : 0}%` }} /><span className="shrink-0 text-sm font-semibold tabular-nums">{r.routes.toLocaleString("pt-BR")}</span></div></div>)}</div>;
}