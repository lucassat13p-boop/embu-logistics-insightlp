import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { recordsQuery } from "@/lib/data";
import { PageHeader, Panel } from "@/components/ops/blocks";
import { RecordsTable } from "@/components/ops/RecordsTable";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — Shopee Operations Hub" },
      { name: "description", content: "Todos os pedidos/BR presentes nos relatórios importados." },
      { property: "og:title", content: "Pedidos — Shopee Operations Hub" },
      { property: "og:description", content: "Pedidos/BR dos relatórios importados." },
    ],
  }),
  component: Page,
});

function Page() {
  const { data = [] } = useQuery(recordsQuery());
  const rows = data.filter((r) => r.order_id);
  return (
    <div>
      <PageHeader title="Pedidos" subtitle="Pedidos/BR de todos os módulos (cada registro mantém seu módulo de origem)" />
      <Panel title="Pedidos importados">
        <RecordsTable showModule rows={rows} columns={["record_date", "order_id", "status", "product", "collaborator", "route", "lh", "reason"]} forceColumns={["record_date", "order_id", "status"]} />
      </Panel>
    </div>
  );
}
