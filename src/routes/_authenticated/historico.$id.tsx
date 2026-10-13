import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { errorsQuery } from "@/lib/data";
import { FIELD_LABELS, moduleByKey, type FieldKey } from "@/lib/modules";
import { Empty, Kpi, PageHeader, Panel, StatusBadge } from "@/components/ops/blocks";

export const Route = createFileRoute("/_authenticated/historico/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes da importação — Shopee Operations Hub" },
      { name: "description", content: "Resultado detalhado de uma importação de relatório." },
      { property: "og:title", content: "Detalhes da importação" },
      { property: "og:description", content: "Resultado detalhado de uma importação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const [all, setAll] = useState(false);
  const { data: b } = useQuery({ queryKey: ["batch", id], queryFn: async () => (await supabase.from("import_batches").select("*").eq("id", id).single()).data });
  const { data: errs = [] } = useQuery(errorsQuery(id));
  if (!b) return <Empty text="Carregando..." />;
  const mapping = (b.mapping ?? {}) as Record<string, string>;
  return (
    <div className="space-y-5">
      <Link to="/historico" className="text-xs text-primary">← Histórico</Link>
      <PageHeader title={b.file_name} subtitle={`${moduleByKey(b.module)?.label} · ${new Date(b.created_at).toLocaleString("pt-BR")} · ${b.user_email ?? ""} · ${b.sheet_name ?? ""}`} action={<StatusBadge status={b.status} />} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Kpi label="Encontrados" value={b.total_rows} /><Kpi label="Válidos" value={b.valid_rows} /><Kpi label="Com erro" value={b.error_rows} />
        <Kpi label="Ignorados" value={b.ignored_rows} /><Kpi label="Duplicados" value={b.duplicate_rows} /><Kpi label="Novos salvos" value={b.inserted_rows} accent />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Mapeamento utilizado">
          <ul className="space-y-1 text-sm">{Object.entries(mapping).map(([c, f]) => <li key={c} className="flex justify-between gap-2"><span className="truncate">{c}</span><span className="text-muted-foreground">{f ? FIELD_LABELS[f as FieldKey] : "—"}</span></li>)}</ul>
        </Panel>
        <Panel className="lg:col-span-2" title={`Erros e avisos (${errs.length})`}>
          {errs.length ? (
            <>
              <ul className="space-y-1 text-xs">{(all ? errs : errs.slice(0, 10)).map((e) => <li key={e.id}><span className="font-mono">Linha {e.row_number}</span> · <b>{e.kind}</b>{e.column_name && <> · coluna <b>{e.column_name}</b></>} — {e.message}</li>)}</ul>
              {errs.length > 10 && <button className="mt-2 text-xs font-semibold text-primary" onClick={() => setAll(!all)}>{all ? "Mostrar menos" : `Ver todos (${errs.length})`}</button>}
            </>
          ) : <Empty text="Nenhum erro registrado." />}
        </Panel>
      </div>
    </div>
  );
}
