import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ops/blocks";
import { RecordsTable } from "@/components/ops/RecordsTable";

export const Route = createFileRoute("/_authenticated/busca")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "" }),
  head: () => ({
    meta: [
      { title: "Busca — Shopee Operations Hub" },
      { name: "description", content: "Busca global nos dados reais importados." },
      { property: "og:title", content: "Busca — Shopee Operations Hub" },
      { property: "og:description", content: "Busca global nos dados reais importados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { q } = Route.useSearch();
  const { data = [], isLoading } = useQuery({
    queryKey: ["search", q],
    enabled: !!q,
    queryFn: async () => {
      const s = q.replace(/[%,()]/g, " ").trim();
      const cols = ["order_id", "collaborator", "product", "lh", "route", "status", "reason"];
      const { data, error } = await supabase.from("records").select("*").or(cols.map((c) => `${c}.ilike.%${s}%`).join(",")).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div>
      <PageHeader title={`Busca: "${q}"`} subtitle={isLoading ? "Buscando..." : `${data.length} resultado(s) no banco`} />
      <Panel title="Resultados">
        <RecordsTable showModule rows={data} columns={["record_date", "order_id", "status", "product", "collaborator", "lh", "route", "reason"]} forceColumns={["record_date", "order_id"]} defaultToToday={false} />
      </Panel>
    </div>
  );
}
