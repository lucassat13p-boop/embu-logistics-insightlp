import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, ClipboardList, FileSpreadsheet, History, LayoutDashboard, LogOut, Package, Route as RouteIcon, Search, Settings, TriangleAlert, Upload } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { HUB_NAME, MODULES } from "@/lib/modules";
import { cn } from "@/lib/utils";

const NAV = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Pedidos", to: "/pedidos", icon: Package },
  { title: "LHs / Rotas", to: "/m/rotas", icon: RouteIcon },
  { title: "Pendências", to: "/pendencias", icon: TriangleAlert },
  { title: "Relatórios", to: "/relatorios", icon: FileSpreadsheet },
  { title: "Histórico", to: "/historico", icon: History },
  { title: "Importar Dados", to: "/importar", icon: Upload },
  { title: "Configurações", to: "/configuracoes", icon: Settings },
] as const;

const TOP = MODULES.filter((m) => m.key !== "rotas");

export function AppShell({ children, email }: { children: ReactNode; email?: string | null }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand font-display text-sm font-black text-primary-foreground">S</div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate font-display text-sm font-bold text-sidebar-accent-foreground">Operations Hub</p>
                <p className="truncate text-[11px] text-sidebar-foreground/70">LSP-36 · Embu das Artes</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Operação</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((n) => (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton asChild isActive={path === n.to || path.startsWith(n.to + "/")} tooltip={n.title}>
                        <Link to={n.to}><n.icon className="h-4 w-4" /><span>{n.title}</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Módulos</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {TOP.map((m) => (
                    <SidebarMenuItem key={m.key}>
                      <SidebarMenuButton asChild isActive={path === `/m/${m.slug}`} tooltip={m.label}>
                        <Link to="/m/$slug" params={{ slug: m.slug }}><BarChart3 className="h-4 w-4" /><span>{m.label}</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Sair" onClick={() => supabase.auth.signOut()}>
                  <LogOut className="h-4 w-4" /><span className="truncate">{email ?? "Sair"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
            <div className="flex h-14 items-center gap-3 px-3 md:px-5">
              <SidebarTrigger />
              <div className="hidden min-w-0 md:block">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Shopee Operations Hub</p>
                <p className="truncate text-xs text-muted-foreground">{HUB_NAME}</p>
              </div>
              <form className="relative ml-auto w-full max-w-sm" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate({ to: "/busca", search: { q: q.trim() } }); }}>
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pedido/BR, colaborador, LH..." className="pl-8" />
              </form>
            </div>
            <nav className="flex gap-1 overflow-x-auto border-t px-3 py-1.5 md:px-5">
              {TOP.map((m) => (
                <Link key={m.key} to="/m/$slug" params={{ slug: m.slug }}
                  className={cn("whitespace-nowrap rounded px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors", path === `/m/${m.slug}` ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
                  {m.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1 p-3 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export const ClipboardIcon = ClipboardList;
