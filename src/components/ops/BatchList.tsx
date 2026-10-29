import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { batchesQuery } from "@/lib/data";
import { MODULES, moduleByKey } from "@/lib/modules";
import { Empty, StatusBadge } from "./blocks";
import { DeleteImportButton } from "./DeleteImportButton";
import { BulkDeleteImports, useImportDeletionUser } from "./BulkDeleteImports";
import { Checkbox } from "@/components/ui/checkbox";

export function BatchList() {
  const { data = [], isLoading } = useQuery(batchesQuery());
  const [q, setQ] = useState("");
  const [mod, setMod] = useState("all");
  const [st, setSt] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const rows = useMemo(() => data.filter((b) => {
    const d = b.created_at.slice(0, 10);
    return (mod === "all" || b.module === mod) && (st === "all" || b.status === st) &&
      (!from || d >= from) && (!to || d <= to) &&
      (!q || `${b.file_name} ${b.user_email}`.toLowerCase().includes(q.toLowerCase()));
  }), [data, q, mod, st, from, to]);
  const { data: userId } = useImportDeletionUser();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canSelect = (b: (typeof data)[number]) => Boolean(userId && b.user_id === userId && b.status !== "Processando");
  const selectable = rows.filter(canSelect);
  const selectedRows = selectable.filter((b) => selected.has(b.id));
  const allSelected = selectable.length > 0 && selectedRows.length === selectable.length;
  const toggle = (id: string, on: boolean) => setSelected((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });
  const toggleAll = (on: boolean) => setSelected((prev) => { const n = new Set(prev); selectable.forEach((b) => (on ? n.add(b.id) : n.delete(b.id))); return n; });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-card">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar arquivo ou usuário..." value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[200px] flex-1" />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        <Select value={mod} onValueChange={setMod}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os módulos</SelectItem>{MODULES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent></Select>
        <Select value={st} onValueChange={setSt}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os status</SelectItem>{["Processando", "Concluído", "Concluído com avisos", "Erro"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={allSelected ? true : selectedRows.length ? "indeterminate" : false} disabled={!selectable.length} onCheckedChange={(v) => toggleAll(v === true)} aria-label="Selecionar todos" />Selecionar todos</label>
        <BulkDeleteImports batches={selectedRows} onDone={(ids) => setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; })} />
        <span className="text-xs text-muted-foreground">Somente importações feitas por você e já concluídas podem ser selecionadas.</span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="w-8 px-3 py-2" />{["Arquivo", "Módulo", "Data/hora", "Usuário", "Registros", "Válidos", "Importados", "Ignorados", "Seleção AVARIA", "Erros", "Status", "Duração", ""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t hover:bg-accent/40">
                <td className="px-3 py-2"><Checkbox checked={selected.has(b.id)} disabled={!canSelect(b)} onCheckedChange={(v) => toggle(b.id, v === true)} aria-label={`Selecionar ${b.file_name}`} /></td>
                <td className="max-w-[240px] truncate px-3 py-2 font-medium">{b.file_name}</td>
                <td className="px-3 py-2 text-xs font-semibold text-primary">{moduleByKey(b.module)?.label ?? b.module}</td>
                <td className="px-3 py-2">{new Date(b.created_at).toLocaleString("pt-BR")}</td>
                <td className="max-w-[180px] truncate px-3 py-2">{b.user_email ?? "Sem informação"}</td>
                <td className="px-3 py-2 tabular-nums">{b.total_rows}</td>
                <td className="px-3 py-2 tabular-nums">{b.valid_rows}</td>
                <td className="px-3 py-2 tabular-nums">{b.inserted_rows}</td>
                <td className="px-3 py-2 tabular-nums">{b.ignored_rows}</td>
                <td className="max-w-[220px] px-3 py-2 text-xs">{b.module === "avaria" ? `${b.selected_shifts?.join(", ") || "Nenhum"} · SOC ${b.include_soc === null ? "—" : b.include_soc ? "incluído" : "não incluído"}` : "—"}</td>
                <td className="px-3 py-2 tabular-nums">{b.error_rows}</td>
                <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                <td className="px-3 py-2 tabular-nums">{b.duration_ms != null ? `${(b.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
                <td className="px-3 py-2"><div className="flex items-center gap-2"><Link to="/historico/$id" params={{ id: b.id }} className="text-xs font-semibold text-primary">Detalhes</Link><DeleteImportButton batch={b} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !rows.length && <Empty text="Nenhuma importação encontrada." />}
      </div>
    </div>
  );
}
