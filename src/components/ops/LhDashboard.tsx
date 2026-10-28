import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Download, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarBlock, Empty, Kpi, LineBlock, PageHeader, Panel } from "./blocks";
import { PieBlock } from "./PieBlock";
import { PeriodFilter } from "./PeriodFilter";
import { useInitialTodayPeriod } from "@/hooks/use-initial-today-period";
import { availableMonths, EMPTY_PERIOD, filterByPeriod, PERIOD_EMPTY } from "@/lib/period";
import type { RecordRow } from "@/lib/data";
import { HUB_NAME } from "@/lib/modules";
import { arrivalDelta, driverName, fmtWall, lhFromRecord, type LhView } from "@/lib/lh-schedule";

const PAGE = 12;
const ALL = "__all";

function periodLabel(dates: string[]) {
  if (!dates.length) return "Sem data";
  const f = (d: string) => d.split("-").reverse().join("/");
  return dates[0] === dates[dates.length - 1] ? f(dates[0]) : `${f(dates[0])} a ${f(dates[dates.length - 1])}`;
}

function exportPng(rows: LhView[], subtitle: string) {
  const cols = [["LH", 150], ["Origem", 230], ["Motorista", 280], ["Placa", 150], ["Turno", 90], ["Previsto", 120], ["Status", 100]] as const;
  const W = cols.reduce((s, [, w]) => s + w, 0) + 40, rowH = 30, top = 110;
  const H = top + rowH * (rows.length + 1) + 40;
  const scale = 2;
  const c = document.createElement("canvas"); c.width = W * scale; c.height = H * scale;
  const g = c.getContext("2d"); if (!g) return;
  g.scale(scale, scale);
  const orange = "#ee4d2d";
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  g.fillStyle = orange; g.fillRect(0, 0, W, 6);
  g.fillStyle = "#111111"; g.font = "bold 24px Arial"; g.fillText("PROGRAMAÇÃO DAS LHs — HUB LSP-36", 20, 46);
  g.fillStyle = "#555555"; g.font = "15px Arial"; g.fillText(`${subtitle} · ${rows.length} LHs`, 20, 76);
  const clip = (t: string, w: number) => { let s = t; while (s.length > 1 && g.measureText(s).width > w - 12) s = s.slice(0, -1); return s === t ? t : `${s.slice(0, -1)}…`; };
  let y = top;
  g.fillStyle = orange; g.fillRect(20, y, W - 40, rowH);
  g.fillStyle = "#ffffff"; g.font = "bold 14px Arial";
  let x = 20; for (const [l, w] of cols) { g.fillText(l, x + 8, y + 20); x += w; }
  g.font = "13px Arial";
  rows.forEach((r, i) => {
    y += rowH;
    g.fillStyle = i % 2 ? "#f6f6f6" : "#ffffff"; g.fillRect(20, y, W - 40, rowH);
    g.strokeStyle = "#e3e3e3"; g.strokeRect(20, y, W - 40, rowH);
    const vals = [r.lh, r.origin ?? "-", driverName(r.driver) ?? "-", r.plate ?? "-", r.shift ?? "-", fmtWall(r.scheduledAt), r.arrived ? "Chegou" : "Pendente"];
    x = 20;
    vals.forEach((v, j) => { g.fillStyle = j === 6 ? (r.arrived ? "#15803d" : orange) : "#222222"; g.font = j === 6 ? "bold 13px Arial" : "13px Arial"; g.fillText(clip(v, cols[j][1]), x + 8, y + 20); x += cols[j][1]; });
  });
  const a = document.createElement("a");
  a.download = `programacao-lhs-${new Date().toISOString().slice(0, 10)}.png`;
  a.href = c.toDataURL("image/png"); a.click();
}

export function LhDashboard({ allRows }: { allRows: RecordRow[] }) {
  const [period, setPeriod] = useInitialTodayPeriod();
  const [shift, setShift] = useState(ALL);
  const [origin, setOrigin] = useState(ALL);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const months = useMemo(() => availableMonths(allRows), [allRows]);
  const periodRows = useMemo(() => filterByPeriod(allRows, period).map(lhFromRecord), [allRows, period]);
  const shifts = useMemo(() => [...new Set(allRows.map((r) => r.shift).filter(Boolean) as string[])].sort(), [allRows]);
  const origins = useMemo(() => [...new Set(allRows.map((r) => r.route).filter(Boolean) as string[])].sort(), [allRows]);
  const rows = useMemo(() => periodRows.filter((r) => (shift === ALL || r.shift === shift) && (origin === ALL || r.origin === origin))
    .sort((a, b) => (a.scheduledAt ?? "9").localeCompare(b.scheduledAt ?? "9")), [periodRows, shift, origin]);
  const searched = useMemo(() => { const s = q.trim().toLowerCase(); return s ? rows.filter((r) => [r.lh, r.driver, r.plate, r.origin].some((v) => v?.toLowerCase().includes(s))) : rows; }, [rows, q]);
  const pages = Math.max(1, Math.ceil(searched.length / PAGE));
  const cur = Math.min(page, pages - 1);

  const received = rows.filter((r) => r.arrived).length;
  const deltas = rows.map(arrivalDelta).filter((d): d is number => d != null);
  const late = deltas.filter((d) => d > 0).length, early = deltas.filter((d) => d < 0).length;
  const orders = rows.some((r) => r.orders != null) ? rows.reduce((s, r) => s + (r.orders ?? 0), 0) : null;
  const originData = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r) => r.origin && m.set(r.origin, (m.get(r.origin) ?? 0) + 1)); return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5); }, [rows]);
  const hourData = useMemo(() => { const m = new Map<string, number>(); rows.forEach((r) => r.arrivedAt && m.set(`${r.arrivedAt.slice(11, 13)}h`, (m.get(`${r.arrivedAt.slice(11, 13)}h`) ?? 0) + 1)); return [...m].sort().map(([label, value]) => ({ label, value })); }, [rows]);
  const subtitle = periodLabel(rows.map((r) => r.scheduledAt?.slice(0, 10)).filter(Boolean).sort() as string[]);

  const importBtn = <Button asChild><Link to="/importar" search={{ modulo: "rotas" }}><Upload className="mr-1 h-4 w-4" />Importar relatório LHs / Rotas</Link></Button>;
  return <div className="space-y-5">
    <PageHeader title="LHs / Rotas" subtitle={`${HUB_NAME} · Programação e chegadas das LHs`} action={importBtn} />
    <PeriodFilter months={months} period={period} onChange={(p) => { setPeriod(p); setPage(0); }} mode="single" onModeChange={() => undefined} comparison={{ ...EMPTY_PERIOD }} onComparisonChange={() => undefined} onClear={() => { setPeriod({ ...EMPTY_PERIOD }); setShift(ALL); setOrigin(ALL); setPage(0); }} />
    <div className="flex flex-wrap gap-3">
      <div className="w-44"><Select value={shift} onValueChange={(v) => { setShift(v); setPage(0); }}><SelectTrigger aria-label="Turno"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Turno: todos</SelectItem>{shifts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
      <div className="w-64"><Select value={origin} onValueChange={(v) => { setOrigin(v); setPage(0); }}><SelectTrigger aria-label="Origem"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Origem: todas</SelectItem>{origins.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {!rows.length ? <div className="rounded-lg border border-dashed bg-card p-6"><Empty text={allRows.length ? PERIOD_EMPTY : undefined} hint={allRows.length ? undefined : "Importe a programação de LHs para visualizar."} /></div> :
    <div className="grid gap-4 xl:grid-cols-[55fr_45fr]">
      <Panel title="Programação das LHs" subtitle={`${subtitle} · ${searched.length} LHs`} action={<Button size="sm" variant="outline" onClick={() => exportPng(rows, subtitle)}><Download className="h-4 w-4" />Baixar programação em imagem</Button>}>
        <div className="relative mb-3"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Pesquisar LH, motorista, placa ou origem" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
        <div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted text-left text-xs uppercase"><tr>{["LH", "Origem / Unidade", "Motorista", "Placa", "Turno", "Previsto", "Status"].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
          <tbody>{searched.slice(cur * PAGE, cur * PAGE + PAGE).map((r) => <tr key={r.id} className="border-t">
            <td className="p-2 font-medium">{r.lh}</td><td className="p-2">{r.origin ?? "Sem informação"}</td><td className="p-2">{driverName(r.driver) ?? "Sem informação"}</td><td className="p-2">{r.plate ?? "Sem informação"}</td><td className="p-2">{r.shift ?? "-"}</td><td className="p-2 tabular-nums">{fmtWall(r.scheduledAt)}</td>
            <td className="p-2"><span className={r.arrived ? "rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success" : "rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary"}>{r.arrived ? "Chegou" : "Pendente"}</span></td>
          </tr>)}</tbody></table></div>
        {!searched.length && <p className="mt-3 text-sm text-muted-foreground">Nenhuma LH encontrada para a pesquisa.</p>}
        <div className="mt-3 flex items-center justify-end gap-2 text-sm"><span className="text-muted-foreground">Página {cur + 1} de {pages}</span><Button size="icon" variant="outline" aria-label="Página anterior" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button size="icon" variant="outline" aria-label="Próxima página" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
      </Panel>
      <div className="space-y-4">
        <Panel title="Resumo das chegadas">
          <div className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
            <Kpi accent label="LHs programadas" value={rows.length} />
            <Kpi label="LHs recebidas" value={received} />
            <Kpi label="LHs pendentes" value={rows.length - received} />
            <Kpi label="Chegadas atrasadas" value={deltas.length ? late : null} hint="Sem horário real de chegada" />
            <Kpi label="Chegadas antecipadas" value={deltas.length ? early : null} hint="Sem horário real de chegada" />
            {orders != null && <Kpi label="Pedidos" value={orders.toLocaleString("pt-BR")} />}
          </div>
        </Panel>
        <Panel title="Recebidas x Pendentes"><PieBlock label="Recebidas x Pendentes" data={[{ name: "Recebidas", value: received }, { name: "Pendentes", value: rows.length - received }].filter((d) => d.value)} total={rows.length} categories={["Recebidas", "Pendentes"]} categoryColors={{ Recebidas: "var(--success)", Pendentes: "var(--primary)" }} includeMissing={false} /></Panel>
        <Panel title="Top 5 unidades de origem"><BarBlock data={originData} horizontal yAxisWidth={170} valueName="LHs" /></Panel>
        <Panel title="Chegadas por horário" subtitle="Horário real de chegada">{hourData.length ? <LineBlock data={hourData} /> : <Empty text="Sem horários reais de chegada." />}</Panel>
      </div>
    </div>}
  </div>;
}
