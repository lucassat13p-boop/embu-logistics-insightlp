import { useMemo, type CSSProperties } from "react";
import { AlertTriangle, Car, Check, Package, Route as RouteIcon, Truck, Van } from "lucide-react";
import type { RecordRow } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Empty, Panel } from "./blocks";
import { PieBlock } from "./PieBlock";
import { retidosVehicleDivergence, retidosVehicleKey } from "@/lib/retidos-vehicle";

/** Route analysis for RETIDOS DE VEÍCULOS. Reads only the route_* fields stored in
 *  records.extra at import time (romaneio + Plano de expedição cross-reference).
 *  PERFIL = veículo programado; MODELO = veículo que realmente veio. */

type RouteData = { cluster: string; perfil: string | null; modelo: string | null };
type Divergence = "sim" | "nao" | "nao_identificado";
type ClusterStat = { cluster: string; count: number; pairs: Map<string, { perfil: string | null; modelo: string | null; n: number }> };

const normVehicle = (v: string | null) => (v ?? "").trim().toUpperCase().replace(/\s+/g, " ");

function routeDataOf(row: RecordRow): RouteData | null {
  const extra = row.extra;
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const e = extra as Record<string, unknown>;
  if (e.route_match !== "ok") return null;
  const cluster = typeof e.route_cluster === "string" && e.route_cluster.trim() ? e.route_cluster.trim() : null;
  if (!cluster) return null;
  return {
    cluster,
    perfil: typeof e.route_perfil === "string" && e.route_perfil.trim() ? e.route_perfil.trim() : null,
    modelo: typeof e.route_modelo === "string" && e.route_modelo.trim() ? e.route_modelo.trim() : null,
  };
}

function divergenceOf(stat: ClusterStat): Divergence {
  return retidosVehicleDivergence([...stat.pairs.values()]);
}

function VehicleIcon({ name }: { name: string }) {
  const key = retidosVehicleKey(name.split(" / ")[0]);
  const props = { className: "h-4 w-4 shrink-0", "aria-hidden": true as const, strokeWidth: 2 };
  if (key === "FIORINO") return <Van {...props} />;
  if (key === "PASSEIO") return <Car {...props} />;
  if (key === "MOTO") return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="17" r="3" /><circle cx="19" cy="17" r="3" /><path d="m5 17 5-8 5 8H5m5-8H7m8 8 4-4-3-9h-3m4 4h3" /></svg>;
  return <Truck {...props} />;
}

function VehicleBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-xs text-muted-foreground">Não identificado</span>;
  return (
    <span className="retidos-vehicle-badge inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold">
      <VehicleIcon name={name} />{name}
    </span>
  );
}

function DivergenceBadge({ value }: { value: Divergence }) {
  if (value === "sim") return <span className="retidos-divergence-yes inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"><AlertTriangle className="h-3 w-3" />Sim</span>;
  if (value === "nao") return <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success"><Check className="h-3 w-3" />Não</span>;
  return <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Não identificado</span>;
}

function RouteKpi({ icon: Icon, label, value, hint, chipClass, chipStyle }: { icon: typeof Package; label: string; value: number; hint: string; chipClass?: string; chipStyle?: CSSProperties }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", chipClass)} style={chipStyle}><Icon className="h-5 w-5" /></span>
        <p className="min-w-0 text-xs font-medium uppercase leading-tight text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function RetidosRoutesPanel({ rows }: { rows: RecordRow[] }) {
  const analysis = useMemo(() => {
    const clusters = new Map<string, ClusterStat>();
    let withRoute = 0;
    for (const row of rows) {
      const data = routeDataOf(row);
      if (!data) continue;
      withRoute++;
      if (!clusters.has(data.cluster)) clusters.set(data.cluster, { cluster: data.cluster, count: 0, pairs: new Map() });
      const stat = clusters.get(data.cluster);
      if (!stat) continue;
      stat.count++;
      const key = `${normVehicle(data.perfil)}|${normVehicle(data.modelo)}`;
      if (!stat.pairs.has(key)) stat.pairs.set(key, { perfil: data.perfil, modelo: data.modelo, n: 0 });
      const pair = stat.pairs.get(key);
      if (pair) pair.n++;
    }
    const stats = [...clusters.values()].sort((a, b) => b.count - a.count || a.cluster.localeCompare(b.cluster, "pt-BR"));
    const divergent = stats.filter((s) => divergenceOf(s) === "sim");
    const notDivergent = stats.filter((s) => divergenceOf(s) === "nao");
    const unidentified = stats.filter((s) => divergenceOf(s) === "nao_identificado");
    return {
      hasData: withRoute > 0,
      total: rows.length,
      impacted: stats.length,
      divergentRoutes: divergent.length,
      divergentPackages: divergent.reduce((sum, s) => sum + s.count, 0),
      top: stats.slice(0, 10),
      donut: [{ name: "Com divergência", value: divergent.length }, { name: "Sem divergência", value: notDivergent.length }].filter((d) => d.value > 0),
      unidentifiedRoutes: unidentified.length,
    };
  }, [rows]);

  return (
    <Panel title="Análise de Rotas" subtitle="Cruzamento BR → AT planejada → Cluster → Perfil (veículo programado) → Modelo (veículo que veio).">
      {!analysis.hasData ? (
        <Empty text="Ainda não há dados suficientes para a análise de rotas." hint="Importe o relatório Excel completo com as abas PACOTES RETIRADOS, romaneio e Plano de expedição." />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <RouteKpi icon={Package} label="Total de Retirados" value={analysis.total} hint="Todas as ocorrências (inclui repetições)" chipClass="bg-destructive/10 text-destructive" />
            <RouteKpi icon={RouteIcon} label="Rotas Impactadas" value={analysis.impacted} hint="Rotas com pelo menos 1 retirado" chipClass="bg-primary-soft text-primary" />
            <RouteKpi icon={Truck} label="Rotas com Divergência de Veículo" value={analysis.divergentRoutes} hint="PERFIL diferente do MODELO" chipStyle={{ background: "color-mix(in oklab, var(--chart-2) 14%, transparent)", color: "var(--chart-2)" }} />
            <RouteKpi icon={AlertTriangle} label="Retirados em Rotas com Divergência" value={analysis.divergentPackages} hint="Pacotes retirados nessas rotas" chipClass="bg-destructive/10 text-destructive" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold">Top 10 Rotas com Mais Retirados</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">Quantidade de pacotes retirados por cluster, com veículo programado e veículo que veio para a rota.</p>
              <div className="mt-3 overflow-x-auto rounded-md border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Cluster</th><th className="px-3 py-2">Perfil (programado)</th><th className="px-3 py-2">Modelo (que veio)</th><th className="px-3 py-2 text-right">Retirados</th><th className="px-3 py-2">Divergência</th></tr>
                  </thead>
                  <tbody>
                    {analysis.top.map((stat, i) => {
                      const pairs = [...stat.pairs.values()];
                      const uniform = new Set(pairs.map((pair) => `${retidosVehicleKey(pair.perfil)}|${retidosVehicleKey(pair.modelo)}`)).size === 1;
                      const pair = uniform ? { perfil: [...new Set(pairs.map((p) => p.perfil).filter(Boolean))].join(" / ") || null, modelo: [...new Set(pairs.map((p) => p.modelo).filter(Boolean))].join(" / ") || null } : { perfil: null, modelo: null };
                      return (
                        <tr key={stat.cluster} className="border-t">
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold">{stat.cluster}</td>
                          <td className="px-3 py-2"><VehicleBadge name={pair.perfil} /></td>
                          <td className="px-3 py-2"><VehicleBadge name={pair.modelo} /></td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{stat.count.toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-2"><DivergenceBadge value={divergenceOf(stat)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold">Veículo Programado x Veículo Realizado</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">Rotas identificadas no período e turno selecionados.</p>
              <div className="mt-3">
                <PieBlock data={analysis.donut} total={analysis.impacted - analysis.unidentifiedRoutes} categories={["Com divergência", "Sem divergência"]} categoryColors={{ "Com divergência": "var(--retidos-divergent)", "Sem divergência": "var(--retidos-matched)" }} label="Veículo Programado x Veículo Realizado" includeMissing={false} />
              </div>
              {analysis.unidentifiedRoutes > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{analysis.unidentifiedRoutes.toLocaleString("pt-BR")} rota(s) sem classificação (veículo programado ou modelo ausente/divergente entre registros) — não entram no gráfico.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
