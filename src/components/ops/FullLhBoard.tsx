import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, Panel } from "./blocks";
import type { RecordRow } from "@/lib/data";
import { FULL_PENDING, fullFinalStatus, normId } from "@/lib/full-import";
import { formatDateBR } from "@/lib/parsers";

export const LH_NONE = "__none";
const PAGE = 10;

type Group = {
  key: string; lh: string | null; dates: string[]; shifts: string[]; origins: string[];
  tos: number; packages: number; pending: number; toList: string[];
};
type SortKey = "lh" | "date" | "shift" | "origin" | "tos" | "packages" | "pending";

export function FullLhBoard({ rows, onView }: { rows: RecordRow[]; onView: (key: string) => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "lh", dir: 1 });

  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, { lh: string | null; dates: Set<string>; shifts: Set<string>; origins: Set<string>; tos: Set<string>; brs: Map<string, RecordRow> }>();
    for (const r of rows) {
      const lh = r.lh?.trim() || null;
      const k = lh ?? LH_NONE;
      if (!m.has(k)) m.set(k, { lh, dates: new Set(), shifts: new Set(), origins: new Set(), tos: new Set(), brs: new Map() });
      const g = m.get(k)!;
      if (r.record_date) g.dates.add(r.record_date);
      if (r.shift?.trim()) g.shifts.add(r.shift.trim());
      if (r.sender_name?.trim()) g.origins.add(r.sender_name.trim());
      const to = normId(r.to_number);
      if (to) g.tos.add(to);
      const br = normId(r.order_id);
      if (br && !g.brs.has(br)) g.brs.set(br, r);
    }
    return [...m.entries()].map(([key, g]) => ({
      key, lh: g.lh, dates: [...g.dates].sort(), shifts: [...g.shifts].sort(), origins: [...g.origins].sort((a, b) => a.localeCompare(b, "pt-BR")),
      tos: g.tos.size, packages: g.brs.size,
      pending: [...g.brs.values()].filter((r) => fullFinalStatus(r) === FULL_PENDING).length,
      toList: [...g.tos],
    }));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = !needle ? groups : groups.filter((g) =>
      (g.lh ?? "sem lh vinculada").toLowerCase().includes(needle) ||
      g.origins.some((o) => o.toLowerCase().includes(needle)) ||
      g.toList.some((t) => t.toLowerCase().includes(needle)));
    const value = (g: Group): string | number => {
      switch (sort.key) {
        case "lh": return g.lh ?? "￿";
        case "date": return g.dates[0] ?? "";
        case "shift": return g.shifts[0] ?? "";
        case "origin": return g.origins[0] ?? "￿";
        case "tos": return g.tos;
        case "packages": return g.packages;
        case "pending": return g.pending;
      }
    };
    return [...list].sort((a, b) => {
      const va = value(a), vb = value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return cmp * sort.dir;
    });
  }, [groups, q, sort]);

  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / PAGE) - 1));
  const slice = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);
  const toggleSort = (key: SortKey) => setSort((s) => s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 });
  const Th = ({ id, label }: { id: SortKey; label: string }) => (
    <th className="py-2 pr-3">
      <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => toggleSort(id)}>
        {label}{sort.key === id && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <Panel title="LHs do FULL" subtitle={`${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`}>
      <Input className="mb-3 w-72" placeholder="Buscar por LH, TO ou origem" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      {!filtered.length ? <Empty text="Nenhum dado disponível" hint="Importe a aba “1 - TO's” para vincular LHs aos pacotes." /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr>
              <Th id="lh" label="LH" /><Th id="date" label="Data" /><Th id="shift" label="Turno" /><Th id="origin" label="Origem" />
              <Th id="tos" label="TOs" /><Th id="packages" label="Pacotes" /><Th id="pending" label="Pendentes" /><th />
            </tr></thead>
            <tbody>{slice.map((g) => (
              <tr key={g.key} className="border-t">
                <td className="py-1.5 pr-3 font-medium">{g.lh ?? <span className="text-muted-foreground">Sem LH vinculada</span>}</td>
                <td className="py-1.5 pr-3">{g.dates.length === 1 ? formatDateBR(g.dates[0]) : g.dates.length ? "Múltiplas" : "—"}</td>
                <td className="py-1.5 pr-3">{g.shifts.length === 1 ? g.shifts[0] : g.shifts.length ? "Múltiplos" : "—"}</td>
                <td className="max-w-56 py-1.5 pr-3" title={g.origins.length > 1 ? g.origins.join(", ") : undefined}>
                  <span className="break-words">{g.origins.length > 1 ? "Múltiplas origens" : g.origins[0] ?? "Sem informação"}</span>
                </td>
                <td className="py-1.5 pr-3 tabular-nums">{g.tos.toLocaleString("pt-BR")}</td>
                <td className="py-1.5 pr-3 tabular-nums">{g.packages.toLocaleString("pt-BR")}</td>
                <td className={`py-1.5 pr-3 tabular-nums ${g.pending ? "font-semibold text-destructive" : ""}`}>{g.pending.toLocaleString("pt-BR")}</td>
                <td><Button size="sm" variant="outline" onClick={() => onView(g.key)}><Eye className="mr-1 h-4 w-4" />Ver pacotes</Button></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="mt-3 flex items-center justify-end gap-2 text-xs">
            <Button size="sm" variant="outline" disabled={!safePage} onClick={() => setPage(safePage - 1)}>Anterior</Button>
            <span>{safePage + 1} / {Math.max(1, Math.ceil(filtered.length / PAGE))}</span>
            <Button size="sm" variant="outline" disabled={(safePage + 1) * PAGE >= filtered.length} onClick={() => setPage(safePage + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
