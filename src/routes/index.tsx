import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shopee Operations Hub — LSP-36 Embu das Artes" },
      { name: "description", content: "Plataforma de operações do HUB LSP-36 com dados reais importados." },
      { property: "og:title", content: "Shopee Operations Hub — LSP-36 Embu das Artes" },
      { property: "og:description", content: "Plataforma de operações do HUB LSP-36 com dados reais importados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
