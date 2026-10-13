import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BatchList } from "@/components/ops/BatchList";
import { Kpi, PageHeader } from "@/components/ops/blocks";
import { batchesQuery } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Shopee Operations Hub" },
      { name: "description", content: "Relatórios importados por período, módulo e status." },
      { property: "og:title", content: "Relatórios — Shopee Operations Hub" },
      { property: "og:description", content: "Relatórios importados por período, módulo e status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { data = [] } = useQuery(batchesQuery());
  const sum = (k: "valid_rows" | "error_rows") => data.reduce((a, b) => a + b[k], 0);
  return (
    <div className="space-y-5">
      <PageHeader title="Relatórios" subtitle="Relatórios importados no HUB LSP-36" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi accent label="Relatórios importados" value={data.length || null} />
        <Kpi label="Registros válidos" value={data.length ? sum("valid_rows") : null} />
        <Kpi label="Registros com erro" value={data.length ? sum("error_rows") : null} />
        <Kpi label="Com falha" value={data.length ? data.filter((b) => b.status === "Erro").length : null} />
      </div>
      <BatchList />
    </div>
  );
}
