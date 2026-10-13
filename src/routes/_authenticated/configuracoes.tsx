import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Empty, PageHeader, Panel } from "@/components/ops/blocks";
import { FIELD_LABELS, HUB_NAME, MODULES, moduleByKey, type FieldKey } from "@/lib/modules";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Shopee Operations Hub" },
      { name: "description", content: "Mapeamentos, tipos de relatório e regras de validação." },
      { property: "og:title", content: "Configurações — Shopee Operations Hub" },
      { property: "og:description", content: "Mapeamentos, tipos de relatório e regras de validação." },
    ],
  }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const { data: maps = [] } = useQuery({ queryKey: ["mappings"], queryFn: async () => (await supabase.from("column_mappings").select("*").order("created_at", { ascending: false })).data ?? [] });
  async function del(id: string) {
    const { error } = await supabase.from("column_mappings").delete().eq("id", id);
    error ? toast.error(error.message) : (toast.success("Mapeamento removido."), qc.invalidateQueries({ queryKey: ["mappings"] }));
  }
  return (
    <div className="space-y-5">
      <PageHeader title="Configurações" subtitle={HUB_NAME} />
      <Panel title="Mapeamentos de colunas salvos">
        {maps.length ? (
          <ul className="divide-y text-sm">{maps.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <span className="w-24 text-xs font-semibold text-primary">{moduleByKey(m.module)?.label}</span>
              <span className="flex-1 truncate">{m.name}</span>
              <Button size="icon" variant="ghost" onClick={() => del(m.id)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}</ul>
        ) : <Empty text="Nenhum mapeamento salvo." />}
      </Panel>
      <Panel title="Tipos de relatório, campos e regras">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Módulo</th><th>Campos aceitos</th><th>Obrigatórios</th><th>Chave de duplicidade</th></tr></thead>
            <tbody>{MODULES.map((m) => (
              <tr key={m.key} className="border-t align-top">
                <td className="py-2 font-semibold">{m.label}{m.firstSheetOnly && <p className="text-xs font-normal text-muted-foreground">Somente 1ª planilha</p>}</td>
                <td className="py-2 text-xs">{m.fields.map((f) => FIELD_LABELS[f as FieldKey]).join(", ")}</td>
                <td className="py-2 text-xs">{m.required.map((f) => FIELD_LABELS[f]).join(", ") || "—"}</td>
                <td className="py-2 text-xs">{m.dedupe.map((f) => FIELD_LABELS[f]).join(" + ")}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Campos ausentes no relatório nunca são preenchidos, deduzidos ou estimados.</li>
          <li>Classificação e turno da AVARIA só aparecem quando existirem como coluna real no arquivo.</li>
          <li>Linhas completamente vazias são ignoradas; dados anteriores nunca são apagados automaticamente.</li>
        </ul>
      </Panel>
      <Panel title="Permissões">
        <p className="text-sm text-muted-foreground">Todo usuário autenticado pode importar e consultar. Cada importação registra o usuário responsável. Níveis de acesso (administrador, operador, leitura) poderão ser ativados posteriormente.</p>
      </Panel>
    </div>
  );
}
