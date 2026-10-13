import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { BatchList } from "@/components/ops/BatchList";
import { PageHeader } from "@/components/ops/blocks";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de Importações — Shopee Operations Hub" },
      { name: "description", content: "Todas as importações de relatórios realizadas no HUB LSP-36." },
      { property: "og:title", content: "Histórico de Importações" },
      { property: "og:description", content: "Todas as importações de relatórios realizadas." },
    ],
  }),
  component: Page,
});

function Page() {
  const match = useMatchRoute();
  if (match({ to: "/historico/$id" })) return <Outlet />;
  return (
    <div>
      <PageHeader title="Histórico de Importações" subtitle="Arquivo, módulo, usuário, resultado e duração" />
      <BatchList />
    </div>
  );
}
