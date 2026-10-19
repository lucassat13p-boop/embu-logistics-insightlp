import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { BarBlock, Empty, Kpi, LineBlock, PageHeader, Panel, Ranking, StatusBadge } from "@/components/ops/blocks";
import { RecordsTable } from "@/components/ops/RecordsTable";
import { batchesQuery, byDate, countBy, hasField, recordsQuery, type RecordRow } from "@/lib/data";
import { HUB_NAME, moduleByKey, type ModuleKey } from "@/lib/modules";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Shopee Operations Hub" },
      { name: "description", content: "Visão consolidada FULL, AUTO ADD e ON HOLD do HUB LSP-36." },
      { property: "og:title", content: "Dashboard — Shopee Operations Hub" },
      { property: "og:description", content: "Visão consolidada FULL, AUTO ADD e ON HOLD do HUB LSP-36." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const DASH: ModuleKey[] = ["full", "auto_add", "on_hold"];

function Dashboard() {
  const full = useQuery(recordsQuery("full"));
  const auto = useQuery(recordsQuery("auto_add"));
  const hold = useQuery(recordsQuery("on_hold"));
  const batches = useQuery(batchesQuery());
  const sets: Record<string, RecordRow[]> = { full: full.data ?? [], auto_add: auto.data ?? [], on_hold: hold.data ?? [] };
  const all = [...sets.full, ...sets.auto_add, ...sets.on_hold];
  const loading = full.isLoading || auto.isLoading || hold.isLoading;

  // combined evolution: one series per module on same dates
  const dates = [...new Set(all.map((r) => r.record_date).filter(Boolean) as string[])].sort();
  const evo = byDate(all);
  const alerts = (batches.data ?? []).filter((b) => DASH.includes(b.module as ModuleKey) && (b.status === "Erro" || b.status === "Concluído com avisos")).slice(0, 5);

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle={`${HUB_NAME} · FULL · AUTO ADD · ON HOLD`} />

      <div className="grid gap-3 md:grid-cols-3">
        {DASH.map((k) => {
          const m = moduleByKey(k)!;
          const rows = sets[k];
          return (
            <Link key={k} to="/m/$slug" params={{ slug: m.slug }} className="rounded-lg border bg-card p-4 shadow-card transition hover:border-primary/40">
              <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-widest text-primary">{m.label}</span><span className="text-[11px] text-muted-foreground">ver módulo →</span></div>
              {rows.length ? (
                <>
                  <p className="mt-2 font-display text-3xl font-bold tabular-nums">{rows.length.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground">registros importados{hasField(rows, "order_id") ? ` · ${new Set(rows.map((r) => r.order_id).filter(Boolean)).size.toLocaleString("pt-BR")} pedidos` : ""}</p>
                </>
              ) : <p className="mt-3 text-sm text-muted-foreground">Nenhum dado disponível</p>}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi accent label="Total consolidado" value={all.length || null} />
        <Kpi label="Pedidos distintos" value={hasField(all, "order_id") ? new Set(all.map((r) => r.order_id).filter(Boolean)).size : null} />
        <Kpi label="Dias com registros" value={dates.length || null} />
        <Kpi label="Rotas/LHs distintas" value={hasField(all, "route") || hasField(all, "lh") ? new Set(all.map((r) => r.route ?? r.lh).filter(Boolean)).size : null} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="xl:col-span-2" title="Evolução temporal" subtitle="Registros por data (FULL + AUTO ADD + ON HOLD)"><LineBlock data={evo} /></Panel>
        <Panel title="Alertas de importação">
          {alerts.length ? (
            <ul className="space-y-2 text-sm">
              {alerts.map((b) => (
                <li key={b.id} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <Link to="/historico/$id" params={{ id: b.id }} className="min-w-0 hover:text-primary">
                    <p className="truncate font-medium">{b.file_name}</p>
                    <p className="text-xs text-muted-foreground">{moduleByKey(b.module)?.label} · {b.error_rows} erros · <StatusBadge status={b.status} /></p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty />}
        </Panel>
        <Panel title="Status"><BarBlock data={countBy(all, "status")} horizontal /></Panel>
        <Panel title="Distribuição por turno"><BarBlock data={countBy(all, "shift")} /></Panel>
        <Panel title="Distribuição por rota/LH"><BarBlock data={countBy(all.map((r) => ({ ...r, route: r.route ?? r.lh })), "route")} horizontal /></Panel>
        <Panel title="Ranking de colaboradores"><Ranking personKind="Colaborador" data={countBy(all, "collaborator")} /></Panel>
        <Panel title="Motivos mais frequentes"><Ranking data={countBy(all, "reason")} /></Panel>
        <Panel title="Pendências (ON HOLD por status)"><Ranking data={countBy(sets.on_hold, "status")} /></Panel>
      </div>

      <Panel title="Últimos registros">
        <RecordsTable showModule rows={all.slice(0, 500)} columns={["record_date", "order_id", "status", "route", "lh", "shift", "collaborator"]} forceColumns={["record_date", "order_id", "status"]} />
      </Panel>
    </div>
  );
}
