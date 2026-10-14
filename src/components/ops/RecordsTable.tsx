import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_LABELS, moduleByKey, type FieldKey } from "@/lib/modules";
import { formatDateBR } from "@/lib/parsers";
import { hasField, type RecordRow } from "@/lib/data";
import { Empty } from "./blocks";

const MISSING = "Sem informação";
const FILTERABLE: FieldKey[] = ["status", "collaborator", "shift", "route", "lh", "reason", "classification", "product", "treatment", "delivery_attempts", "driver_name", "driver_id", "carrier_3pl", "neighborhood"];

export function RecordsTable({ rows, columns, forceColumns = [], showModule }: { rows: RecordRow[]; columns: FieldKey[]; forceColumns?: FieldKey[]; showModule?: boolean }) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Partial<Record<FieldKey, string>>>({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<{ f: FieldKey; dir: 1 | -1 }>({ f: "record_date", dir: -1 });
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<RecordRow | null>(null);
  const size = 25;

  const cols = columns.filter((c) => forceColumns.includes(c) || hasField(rows, c));
  const filterFields = FILTERABLE.filter((f) => cols.includes(f) && hasField(rows, f));
  const options = useMemo(() => {
    const o: Partial<Record<FieldKey, string[]>> = {};
    for (const f of filterFields) o[f] = [...new Set(rows.map((r) => r[f as keyof RecordRow] as string).filter(Boolean))].sort().slice(0, 300);
    return o;
  }, [rows, filterFields.join()]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (from && (!r.record_date || r.record_date < from)) return false;
      if (to && (!r.record_date || r.record_date > to)) return false;
      for (const [f, v] of Object.entries(filters)) if (v && r[f as keyof RecordRow] !== v) return false;
      if (!s) return true;
      return cols.some((c) => String(r[c as keyof RecordRow] ?? "").toLowerCase().includes(s));
    });
    out = [...out].sort((a, b) => {
      const av = String(a[sort.f as keyof RecordRow] ?? ""), bv = String(b[sort.f as keyof RecordRow] ?? "");
      return av.localeCompare(bv, "pt-BR", { numeric: true }) * sort.dir;
    });
    return out;
  }, [rows, q, filters, from, to, sort, cols.join()]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const pageRows = filtered.slice(page * size, page * size + size);
  const fmt = (r: RecordRow, c: FieldKey) => {
    const v = r[c as keyof RecordRow];
    if (v === null || v === undefined || v === "") return <span className="text-muted-foreground/70 italic">{MISSING}</span>;
    return c === "record_date" ? formatDateBR(v as string) : String(v);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Buscar..." className="pl-8" />
        </div>
        {hasField(rows, "record_date") && (
          <>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} className="w-auto" aria-label="De" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} className="w-auto" aria-label="Até" />
          </>
        )}
        {filterFields.map((f) => (
          <Select key={f} value={filters[f] ?? "__all"} onValueChange={(v) => { setFilters((p) => ({ ...p, [f]: v === "__all" ? "" : v })); setPage(0); }}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder={FIELD_LABELS[f]} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{FIELD_LABELS[f]}: todos</SelectItem>
              {options[f]?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {showModule && <th className="px-3 py-2">Módulo</th>}
              {cols.map((c) => (
                <th key={c} className="px-3 py-2">
                  <button className="inline-flex items-center gap-1 font-semibold" onClick={() => setSort((s) => ({ f: c, dir: s.f === c ? (-s.dir as 1 | -1) : 1 }))}>
                    {FIELD_LABELS[c]}
                    {sort.f === c && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-accent/40">
                {showModule && <td className="px-3 py-2 text-xs font-semibold text-primary">{moduleByKey(r.module)?.label}</td>}
                {cols.map((c) => <td key={c} className="max-w-[260px] truncate px-3 py-2">{fmt(r, c)}</td>)}
                <td className="px-2"><Button size="icon" variant="ghost" onClick={() => setDetail(r)} aria-label="Detalhes"><Eye className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageRows.length && <Empty text="Nenhum registro encontrado." hint={rows.length ? undefined : "Importe um relatório para visualizar os dados."} />}
      </div>
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length.toLocaleString("pt-BR")} registros</span>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span>{page + 1} / {pages}</span>
            <Button size="icon" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes do registro</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Módulo</dt><dd>{moduleByKey(detail.module)?.label}</dd>
                {cols.map((c) => (<Fragment key={c}><dt className="text-muted-foreground">{FIELD_LABELS[c]}</dt><dd>{fmt(detail, c)}</dd></Fragment>))}
                <dt className="text-muted-foreground">Data original</dt><dd>{detail.record_date_raw ?? MISSING}</dd>
                <dt className="text-muted-foreground">Linha no arquivo</dt><dd>{detail.row_number}</dd>
              </dl>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Linha original do relatório</p>
                <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(detail.raw, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
