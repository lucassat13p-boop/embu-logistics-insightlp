import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { batchesQuery, errorsQuery, recordsQuery } from "@/lib/data";
import { moduleByKey } from "@/lib/modules";
import { Empty, Kpi, PageHeader, Panel } from "@/components/ops/blocks";

export const Route = createFileRoute("/_authenticated/pendencias")({
  head: () => ({
    meta: [
      { title: "Pendências — Shopee Operations Hub" },
      { name: "description", content: "Inconsistências identificadas nos dados reais importados." },
      { property: "og:title", content: "Pendências — Shopee Operations Hub" },
      { property: "og:description", content: "Inconsistências identificadas nos dados reais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { data: errs = [] } = useQuery(errorsQuery());
  const { data: recs = [] } = useQuery(recordsQuery());
  const { data: batches = [] } = useQuery(batchesQuery());
  const bName = new Map(batches.map((b) => [b.id, b.file_name]));
  const noOrder = recs.filter((r) => !r.order_id);
  const noDate = recs.filter((r) => !r.record_date);
  // same order appearing in more than one batch of the same module
  const orderBatches = new Map<string, Set<string>>();
  recs.forEach((r) => { if (r.order_id) { const k = `${r.module}|${r.order_id}`; if (!orderBatches.has(k)) orderBatches.set(k, new Set()); orderBatches.get(k)!.add(r.batch_id); } });
  const multi = recs.filter((r) => r.order_id && (orderBatches.get(`${r.module}|${r.order_id}`)?.size ?? 0) > 1 ? true : false);
  const dupCount = new Set(multi.map((r) => `${r.module}|${r.order_id}`)).size;
  const errOnly = errs.filter((e) => e.kind === "erro");
  const dups = errs.filter((e) => e.kind === "duplicado");
  const structure = batches.filter((b) => b.status === "Erro");

  return (
    <div className="space-y-5">
      <PageHeader title="Pendências" subtitle="Somente problemas identificados nos dados importados" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi accent label="Erros de validação" value={errs.length ? errOnly.length : null} />
        <Kpi label="Duplicados no arquivo" value={errs.length ? dups.length : null} />
        <Kpi label="Sem Pedido/BR" value={recs.length ? noOrder.length : null} />
        <Kpi label="Sem data" value={recs.length ? noDate.length : null} />
        <Kpi label="Pedidos em vários lotes" value={recs.length ? dupCount : null} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Erros de validação / mapeamento">
          {errOnly.length ? (
            <ul className="max-h-96 space-y-1 overflow-y-auto text-xs">{errOnly.slice(0, 300).map((e) => (
              <li key={e.id}><span className="font-semibold text-primary">{moduleByKey(e.module)?.label}</span> · <Link to="/historico/$id" params={{ id: e.batch_id }} className="underline">{bName.get(e.batch_id)}</Link> · linha {e.row_number} — {e.message}</li>
            ))}</ul>
          ) : <Empty />}
        </Panel>
        <Panel title="Importações com falha de estrutura">
          {structure.length ? <ul className="space-y-1 text-sm">{structure.map((b) => <li key={b.id}><Link to="/historico/$id" params={{ id: b.id }} className="hover:text-primary">{b.file_name}</Link></li>)}</ul> : <Empty />}
        </Panel>
        <Panel title="Registros incompletos (sem Pedido/BR ou data)">
          {noOrder.length + noDate.length ? (
            <ul className="max-h-96 space-y-1 overflow-y-auto text-xs">{[...new Set([...noOrder, ...noDate])].slice(0, 300).map((r) => (
              <li key={r.id}><span className="font-semibold text-primary">{moduleByKey(r.module)?.label}</span> · {bName.get(r.batch_id)} · linha {r.row_number} — {!r.order_id ? "sem Pedido/BR" : ""}{!r.order_id && !r.record_date ? ", " : ""}{!r.record_date ? "sem data" : ""}</li>
            ))}</ul>
          ) : <Empty />}
        </Panel>
        <Panel title="Pedidos presentes em mais de um lote">
          {dupCount ? <ul className="max-h-96 space-y-1 overflow-y-auto text-xs">{[...new Set(multi.map((r) => `${r.module}|${r.order_id}`))].slice(0, 300).map((k) => { const [m, o] = k.split("|"); return <li key={k}><span className="font-semibold text-primary">{moduleByKey(m)?.label}</span> · {o}</li>; })}</ul> : <Empty />}
        </Panel>
      </div>
    </div>
  );
}
