import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HUB_NAME } from "@/lib/modules";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Shopee Operations Hub" },
      { name: "description", content: "Acesso à plataforma de operações do HUB LSP-36." },
      { property: "og:title", content: "Entrar — Shopee Operations Hub" },
      { property: "og:description", content: "Acesso à plataforma de operações do HUB LSP-36." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        toast.success("Cadastro criado. Confirme pelo link enviado ao seu e-mail.");
        setMode("in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-ink-foreground md:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand font-display font-black text-primary-foreground">S</div>
          <span className="font-display font-bold">Shopee Operations Hub</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Real data first</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight">Relatório real → validação → indicadores.</h1>
          <p className="mt-3 max-w-md text-sm opacity-70">Nenhum número é exibido sem origem em um relatório importado.</p>
        </div>
        <p className="text-xs opacity-60">{HUB_NAME}</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div>
            <h2 className="text-2xl font-bold">{mode === "in" ? "Entrar" : "Criar acesso"}</h2>
            <p className="text-sm text-muted-foreground">{HUB_NAME}</p>
          </div>
          <div className="space-y-1.5"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="pw">Senha</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Aguarde..." : mode === "in" ? "Entrar" : "Cadastrar"}</Button>
          <button type="button" className="w-full text-sm text-muted-foreground hover:text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Não tem acesso? Cadastre-se" : "Já tem acesso? Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
