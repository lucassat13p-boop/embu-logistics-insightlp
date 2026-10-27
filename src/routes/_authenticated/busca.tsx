import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ops/blocks";
import { RecordsTable } from "@/components/ops/RecordsTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODULES } from "@/lib/modules";
import { fetchFloatingActive } from "@/lib/floating-packages";
import type { RecordRow } from "@/lib/data";

const SEARCH_PAGE_SIZE = 1000;

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
  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ["search", q, moduleFilter],
    enabled: !!q,
    queryFn: async () => {
      const s = q.replace(/[%,()]/g, " ").trim();
      if (!s) return [] as RecordRow[];
      if (moduleFilter === "pacotes_flutuantes") {
        const active = await fetchFloatingActive();
        return active.rows.filter((row) => [row.order_id, row.driver_name, row.route, row.to_number, row.product, row.collaborator].some((value) => value?.toLocaleLowerCase("pt-BR").includes(s.toLocaleLowerCase("pt-BR"))));
      }
      const cols = ["order_id", "collaborator", "product", "lh", "route", "status", "reason"];
      // Fetch every matching page instead of silently discarding results after the first 1000.
      // Order by a unique key so pagination is stable when record dates coincide.
      const matches: RecordRow[] = [];
      for (let from = 0; ; from += SEARCH_PAGE_SIZE) {
        let query = supabase.from("records").select("*").neq("module", "pacotes_flutuantes").or(cols.map((c) => `${c}.ilike.%${s}%`).join(","));
        if (moduleFilter !== "all") query = query.eq("module", moduleFilter);
        const { data: page, error: pageError } = await query.order("id", { ascending: true }).range(from, from + SEARCH_PAGE_SIZE - 1);
        if (pageError) throw pageError;
        matches.push(...(page ?? []));
        if (!page || page.length < SEARCH_PAGE_SIZE) break;
      }
      if (moduleFilter === "all") {
        const active = await fetchFloatingActive();
        const matched = active.rows.filter((row) => [row.order_id, row.driver_name, row.route, row.to_number, row.product, row.collaborator].some((value) => value?.toLocaleLowerCase("pt-BR").includes(s.toLocaleLowerCase("pt-BR"))));
        return [...matches, ...matched];
      }
      return matches;
    },
  });
  return (
    <div>
      <PageHeader title={`Busca: "${q}"`} subtitle={isLoading ? "Buscando..." : isError ? "Não foi possível concluir a busca" : `${data.length} resultado(s) no banco`} />
      <Panel title="Resultados">
        {isError && <p role="alert" className="mb-3 text-sm text-destructive">Erro ao consultar os registros: {error instanceof Error ? error.message : "Tente novamente."}</p>}
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
