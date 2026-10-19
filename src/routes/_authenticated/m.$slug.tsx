import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarBlock, Empty, Kpi, LineBlock, PageHeader, Panel, Ranking } from "@/components/ops/blocks";
import { RecordsTable } from "@/components/ops/RecordsTable";
import { PeriodFilter } from "@/components/ops/PeriodFilter";
import { MonthComparison } from "@/components/ops/MonthComparison";
import { PieBlock } from "@/components/ops/PieBlock";
import { countProductFamilies } from "@/lib/product-families";
import { availableMonths, EMPTY_PERIOD, filterByPeriod, PERIOD_EMPTY, type PeriodSelection } from "@/lib/period";
import { byDate, countBy, hasField, recordsQuery } from "@/lib/data";
import { HUB_NAME, moduleBySlug, type FieldKey, type ModuleDef } from "@/lib/modules";
import { formatDateBR } from "@/lib/parsers";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { countAvariaCollaborators, countAvariaShifts, countAvariaTypes, filterAvariaByShift, normalizedShift, OFFICIAL_AVARIA_TYPES, OFFICIAL_SHIFTS, type AvariaShift } from "@/lib/avaria-analysis";
import { OnHoldDashboard } from "@/components/ops/OnHoldDashboard";
import { RetidosDashboard } from "@/components/ops/RetidosDashboard";
import { FullDashboard } from "@/components/ops/FullDashboard";
import { OperationalErrorsDashboard } from "@/components/ops/OperationalErrorsDashboard";
import { useInitialTodayPeriod } from "@/hooks/use-initial-today-period";

export const Route = createFileRoute("/_authenticated/m/$slug")({
  loader: ({ params }) => {
    if (params.slug === "lost-damaged") throw redirect({ to: "/tratativas" });
    if (params.slug === "desvios") throw redirect({ to: "/dashboard" });
    const mod = moduleBySlug(params.slug);
    if (!mod) throw notFound();
    return { label: mod.label };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.label ?? "Módulo"} — Shopee Operations Hub` },
      { name: "description", content: `Indicadores reais do módulo ${loaderData?.label ?? ""} no HUB LSP-36.` },
      { property: "og:title", content: `${loaderData?.label ?? "Módulo"} — Shopee Operations Hub` },
      { property: "og:description", content: `Indicadores reais do módulo ${loaderData?.label ?? ""}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ModulePage,
});

function ModulePage() {
  const { slug } = Route.useParams();
  const mod = moduleBySlug(slug);
  if (!mod) throw notFound();
  return <ModuleContent key={mod.key} mod={mod} />;
}

function ModuleContent({ mod }: { mod: ModuleDef }) {
  const { data: allRows = [], isLoading } = useQuery(recordsQuery(mod.key));
  const [period, setPeriod] = useInitialTodayPeriod();
  const [comparison, setComparison] = useState<PeriodSelection>({ ...EMPTY_PERIOD });
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [showMissingShifts, setShowMissingShifts] = useState(true);
  const [avariaShifts, setAvariaShifts] = useState<AvariaShift[]>(["all"]);
  const isAvaria = mod.key === "avaria";
  const isOnHold = mod.key === "on_hold";
  const months = useMemo(() => availableMonths(allRows), [allRows]);
  const rows = useMemo(() => isAvaria ? filterAvariaByShift(filterByPeriod(allRows, period), avariaShifts) : allRows, [allRows, period, isAvaria, avariaShifts]);
  const comparisonRows = useMemo(() => isAvaria ? filterAvariaByShift(filterByPeriod(allRows, comparison), avariaShifts) : [], [allRows, comparison, isAvaria, avariaShifts]);
  const has = (f: FieldKey) => hasField(rows, f);
  const dates = rows.map((r) => r.record_date).filter(Boolean).sort() as string[];
  const columns: FieldKey[] = isAvaria
    ? ["record_date", "order_id", "product", "classification", "collaborator", "shift", "status"]
    : ["record_date", "order_id", "lh", "route", "status", "reason", "collaborator", "shift", "product", "classification", "quantity"];

  const importBtn = (
    <Button asChild><Link to="/importar" search={{ modulo: mod.key }}><Upload className="mr-1 h-4 w-4" />Importar relatório {mod.label}</Link></Button>
  );

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (isOnHold) return <OnHoldDashboard allRows={allRows} />;
  if (mod.key === "retidos_veiculos") return <RetidosDashboard allRows={allRows} />;
  if (mod.key === "full") return <FullDashboard allRows={allRows} />;
  if (mod.key === "erros_operacionais") return <OperationalErrorsDashboard allRows={allRows} />;

  const classCounts = isAvaria ? countAvariaTypes(rows) : countBy(rows, "classification");
  const shiftData = isAvaria ? countAvariaShifts(rows) : countBy(rows, "shift");
  const missingShiftCount = isAvaria ? rows.filter((row) => !normalizedShift(row.shift)).length : 0;
  const shiftPieData = showMissingShifts && missingShiftCount ? [...shiftData, { name: "Sem informação", value: missingShiftCount }] : shiftData;
  const collaboratorData = isAvaria ? countAvariaCollaborators(rows) : countBy(rows, "collaborator");
  const familyData = isAvaria ? countProductFamilies(rows) : [];

  return (
    <div className="space-y-5">
      <PageHeader title={mod.label} subtitle={`${HUB_NAME} · ${mod.description}`} action={importBtn} />
      {isAvaria && <PeriodFilter months={months} period={period} onChange={setPeriod} mode={mode} onModeChange={setMode} comparison={comparison} onComparisonChange={setComparison} onClear={() => { setPeriod({ ...EMPTY_PERIOD }); setComparison({ ...EMPTY_PERIOD }); setMode("single"); setAvariaShifts(["all"]); }} />}
      {isAvaria && <div><Label>Turno</Label><ToggleGroup type="multiple" variant="outline" size="sm" className="mt-2 justify-start" value={avariaShifts} onValueChange={(value: string[]) => { setAvariaShifts((prev) => { const next = value as AvariaShift[]; if (next.includes("all")) { return prev.includes("all") && next.length > 1 ? next.filter((item) => item !== "all") as AvariaShift[] : ["all"]; } return next.length ? next : ["all"]; }); }}><ToggleGroupItem value="all">Todos</ToggleGroupItem><ToggleGroupItem value="AM1">AM1</ToggleGroupItem><ToggleGroupItem value="AM2">AM2</ToggleGroupItem><ToggleGroupItem value="PM1">PM1</ToggleGroupItem></ToggleGroup></div>}

      {isAvaria && mode === "compare" && <MonthComparison firstRows={rows} secondRows={comparisonRows} firstPeriod={period} secondPeriod={comparison} />}

      {!rows.length && (
        <div className="rounded-lg border border-dashed bg-card p-6"><Empty text={allRows.length ? PERIOD_EMPTY : undefined} hint={allRows.length ? undefined : "Importe um relatório para visualizar os indicadores."} /></div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi accent label={isAvaria ? "Total de Avarias" : "Total de registros"} value={rows.length || null} />
        {isAvaria ? (
          (mod.classifications ?? []).map((c) => {
            const n = classCounts.find((x) => x.name === c)?.value;
            return <Kpi key={c} label={c} value={rows.length ? n ?? 0 : null} hint="Sem informação no relatório" />;
          })
        ) : (
          <>
            <Kpi label="Pedidos distintos" value={has("order_id") ? new Set(rows.map((r) => r.order_id).filter(Boolean)).size : null} hint="Sem informação no relatório" />
            <Kpi label="Status distintos" value={has("status") ? countBy(rows, "status").length : null} hint="Sem informação no relatório" />
            <Kpi label="Colaboradores" value={has("collaborator") ? countBy(rows, "collaborator").length : null} hint="Sem informação no relatório" />
            <Kpi label="Primeira data" value={dates.length ? formatDateBR(dates[0]) : null} hint="Sem informação no relatório" />
            <Kpi label="Última data" value={dates.length ? formatDateBR(dates[dates.length - 1]) : null} hint="Sem informação no relatório" />
          </>
        )}
      </div>

      {isAvaria && <>
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Avarias por tipo"><PieBlock label="Avarias por tipo" data={classCounts} total={rows.length} categories={[...OFFICIAL_AVARIA_TYPES]} /></Panel>
          <Panel title="Avarias por turno" action={<label className="flex items-center gap-2 text-xs"><Switch checked={showMissingShifts} onCheckedChange={setShowMissingShifts} /><Label>Exibir “Sem informação”</Label></label>}><PieBlock label="Avarias por turno" data={shiftPieData} total={showMissingShifts ? rows.length : shiftData.reduce((sum, item) => sum + item.value, 0)} categories={[...OFFICIAL_SHIFTS]} includeMissing={false} /></Panel>
        </div>
        <Panel title="Colaboradores com mais avarias"><Ranking personKind="Colaborador" data={collaboratorData} /></Panel>
        <Panel title="Evolução das avarias" subtitle="Registros por data"><LineBlock data={byDate(rows)} /></Panel>
        <Panel title="Produtos com mais ocorrências" subtitle="Famílias de produtos"><Ranking data={familyData} /></Panel>
      </>}

      <div className="grid gap-4 xl:grid-cols-2">
        {!isAvaria && <>
          <Panel title="Evolução" subtitle="Registros por data"><LineBlock data={byDate(rows)} /></Panel>
          <Panel title="Status"><BarBlock data={countBy(rows, "status")} horizontal /></Panel>
          {has("shift") && <Panel title="Distribuição por turno"><BarBlock data={shiftData} /></Panel>}
        </>}
        {!isAvaria && has("route") && <Panel title="Por rota"><BarBlock data={countBy(rows, "route")} horizontal /></Panel>}
        {!isAvaria && has("lh") && <Panel title="Por LH"><BarBlock data={countBy(rows, "lh")} horizontal /></Panel>}
        {!isAvaria && has("reason") && <Panel title={mod.key === "motivos" ? "Distribuição dos motivos" : "Por motivo"}><BarBlock data={countBy(rows, "reason")} horizontal /></Panel>}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {!isAvaria && has("collaborator") && <Panel title="Colaboradores com mais ocorrências"><Ranking personKind="Colaborador" data={countBy(rows, "collaborator")} /></Panel>}
        {isAvaria && <Panel title="Status das avarias"><BarBlock data={countBy(rows, "status")} horizontal /></Panel>}
        {isAvaria && <Panel title="Turnos mais ofensores"><Ranking data={showMissingShifts && missingShiftCount ? [...shiftData, { name: "Sem informação", value: missingShiftCount }].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR")) : shiftData} /></Panel>}
        {has("reason") && <Panel title="Motivos mais frequentes"><Ranking data={countBy(rows, "reason")} /></Panel>}
        {has("route") && <Panel title="Rotas com mais ocorrências"><Ranking data={countBy(rows, "route")} /></Panel>}
        {!isAvaria && has("product") && <Panel title="Produtos mais envolvidos"><Ranking data={countBy(rows, "product")} /></Panel>}
      </div>

      <Panel title={isAvaria ? "Ocorrências dos pedidos" : "Registros"}>
        <RecordsTable defaultToToday={!isAvaria} key={`${JSON.stringify(period)}-${avariaShifts.join(",")}`} rows={rows} columns={columns} forceColumns={isAvaria ? columns : ["record_date", "order_id", "status"]} />
      </Panel>
    </div>
  );
}
