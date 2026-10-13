import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarBlock, Empty, Kpi, LineBlock, PageHeader, Panel, Ranking } from "@/components/ops/blocks";
import { RecordsTable } from "@/components/ops/RecordsTable";
import { PeriodFilter } from "@/components/ops/PeriodFilter";
import { MonthComparison } from "@/components/ops/MonthComparison";
import { availableMonths, filterByMonths, PERIOD_EMPTY } from "@/lib/period";
import { byDate, countBy, hasField, recordsQuery } from "@/lib/data";
import { HUB_NAME, moduleBySlug, type FieldKey, type ModuleDef } from "@/lib/modules";
import { formatDateBR } from "@/lib/parsers";

export const Route = createFileRoute("/_authenticated/m/$slug")({
  loader: ({ params }) => {
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
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const isAvaria = mod.key === "avaria";
  const months = useMemo(() => availableMonths(allRows), [allRows]);
  const rows = useMemo(() => isAvaria ? filterByMonths(allRows, selectedMonths) : allRows, [allRows, selectedMonths, isAvaria]);
  const changeMonths = (selected: string[]) => {
    setSelectedMonths(selected);
    if (selected.length < 2) setComparing(false);
  };
  const has = (f: FieldKey) => hasField(rows, f);
  const dates = rows.map((r) => r.record_date).filter(Boolean).sort() as string[];
  const columns: FieldKey[] = isAvaria
    ? ["record_date", "order_id", "product", "classification", "collaborator", "shift", "status"]
    : ["record_date", "order_id", "lh", "route", "status", "reason", "collaborator", "shift", "product", "classification", "quantity"];

  const importBtn = (
    <Button asChild><Link to="/importar" search={{ modulo: mod.key }}><Upload className="mr-1 h-4 w-4" />Importar relatório {mod.label}</Link></Button>
  );

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  const classCounts = countBy(rows, "classification");
  const shiftData = countBy(rows, "shift");

  return (
    <div className="space-y-5">
      <PageHeader title={mod.label} subtitle={`${HUB_NAME} · ${mod.description}`} action={
        <div className="flex max-w-full flex-wrap items-start gap-3">
          {isAvaria && <PeriodFilter months={months} selected={selectedMonths} onChange={changeMonths} comparing={comparing} onCompare={() => setComparing((value) => !value)} />}
          {importBtn}
        </div>
      } />

      {isAvaria && comparing && selectedMonths.length >= 2 && <MonthComparison rows={allRows} months={selectedMonths} classifications={mod.classifications ?? []} />}

      {!rows.length && (
        <div className="rounded-lg border border-dashed bg-card p-6"><Empty text={selectedMonths.length ? PERIOD_EMPTY : undefined} hint={allRows.length ? undefined : "Importe um relatório para visualizar os indicadores."} /></div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi accent label={isAvaria ? "Total de Avarias" : "Total de registros"} value={rows.length || null} />
        {isAvaria ? (
          (mod.classifications ?? []).map((c) => {
            const n = classCounts.find((x) => x.name === c)?.value;
            return <Kpi key={c} label={c} value={has("classification") ? n ?? 0 : null} hint="Sem informação no relatório" />;
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={isAvaria ? "Evolução das avarias" : "Evolução"} subtitle="Registros por data"><LineBlock data={byDate(rows)} /></Panel>
        {isAvaria ? (
          <Panel title="Avarias por tipo" subtitle="Tipos oficiais: Líquido, Sólido, Vidro, Item vazio, SOC"><BarBlock data={classCounts} /></Panel>
        ) : (
          <Panel title="Status"><BarBlock data={countBy(rows, "status")} horizontal /></Panel>
        )}
        {(isAvaria || has("shift")) && <Panel title={isAvaria ? "Avarias por turno" : "Distribuição por turno"}><BarBlock data={shiftData} /></Panel>}
        {isAvaria && <Panel title="Status das avarias"><BarBlock data={countBy(rows, "status")} horizontal /></Panel>}
        {!isAvaria && has("route") && <Panel title="Por rota"><BarBlock data={countBy(rows, "route")} horizontal /></Panel>}
        {!isAvaria && has("lh") && <Panel title="Por LH"><BarBlock data={countBy(rows, "lh")} horizontal /></Panel>}
        {!isAvaria && has("reason") && <Panel title={mod.key === "motivos" ? "Distribuição dos motivos" : "Por motivo"}><BarBlock data={countBy(rows, "reason")} horizontal /></Panel>}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(isAvaria || has("collaborator")) && <Panel title={isAvaria ? "Colaboradores com mais avarias" : "Colaboradores com mais ocorrências"}><Ranking data={countBy(rows, "collaborator")} /></Panel>}
        {isAvaria && <Panel title="Turnos mais ofensores"><Ranking data={shiftData} /></Panel>}
        {has("reason") && <Panel title="Motivos mais frequentes"><Ranking data={countBy(rows, "reason")} /></Panel>}
        {has("route") && <Panel title="Rotas com mais ocorrências"><Ranking data={countBy(rows, "route")} /></Panel>}
        {(isAvaria || has("product")) && <Panel title={isAvaria ? "Produtos com mais ocorrências" : "Produtos mais envolvidos"}><Ranking data={countBy(rows, "product")} /></Panel>}
      </div>

      <Panel title={isAvaria ? "Ocorrências dos pedidos" : "Registros"}>
        <RecordsTable key={selectedMonths.join(",")} rows={rows} columns={columns} forceColumns={isAvaria ? columns : ["record_date", "order_id", "status"]} />
      </Panel>
    </div>
  );
}
