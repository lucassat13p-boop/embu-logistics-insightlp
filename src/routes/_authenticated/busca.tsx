import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ops/blocks";
import { RecordsTable } from "@/components/ops/RecordsTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODULES } from "@/lib/modules";
import { fetchFloatingActive } from "@/lib/floating-packages";

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
  const [moduleFilter, setModuleFilter] = useState("all");
  const { data = [], isLoading } = useQuery({
    queryKey: ["search", q, moduleFilter],
    enabled: !!q,
    queryFn: async () => {
      const s = q.replace(/[%,()]/g, " ").trim();
      if (moduleFilter === "pacotes_flutuantes") {
        const active = await fetchFloatingActive();
        return active.rows.filter((row) => [row.order_id, row.driver_name, row.route, row.to_number, row.product, row.collaborator].some((value) => value?.toLocaleLowerCase("pt-BR").includes(s.toLocaleLowerCase("pt-BR"))));
      }
      const cols = ["order_id", "collaborator", "product", "lh", "route", "status", "reason"];
      let query = supabase.from("records").select("*").neq("module", "pacotes_flutuantes").or(cols.map((c) => `${c}.ilike.%${s}%`).join(","));
      if (moduleFilter !== "all") query = query.eq("module", moduleFilter);
      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div>
      <PageHeader title={`Busca: "${q}"`} subtitle={isLoading ? "Buscando..." : `${data.length} resultado(s) no banco`} />
      <Panel title="Resultados">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[200px]" aria-label="Módulo">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Módulo: todos</SelectItem>
              {MODULES.map((m) => (
                <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <RecordsTable showModule rows={data} columns={["record_date", "order_id", "status", "product", "collaborator", "lh", "route", "reason"]} forceColumns={["record_date", "order_id"]} defaultToToday={false} />
      </Panel>
    </div>
  );
}
