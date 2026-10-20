import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/ops/blocks";
import { supabase } from "@/integrations/supabase/client";
import { buildTable, detectHeaderRow, parseFile, type ParsedFile } from "@/lib/parsers";
import { headerSignature } from "@/lib/importer";
import { normalizeHeader } from "@/lib/modules";
import { invalidateImportQueries } from "@/lib/import-cache";
import {
  buildFullRows, buildLhIndex, buildStatusIndex, commitFullImport, countFullExisting, fullDedupeKey, parseLhSheet, FULL_BASE_LABELS, FULL_STATUS_LABELS,
  suggestFullBase, suggestFullStatus, type FullBaseMapping, type FullStatusMapping,
} from "@/lib/full-import";

type Src = { file: File; parsed: ParsedFile };
const findSheet = (p: ParsedFile, prefix: string, header: string) => {
  const byName = p.sheets.findIndex((s) => s.name.trim().startsWith(prefix));
  if (byName >= 0) return byName;
  return p.sheets.findIndex((s) => (s.rows[0] ?? []).some((c) => normalizeHeader(String(c ?? "")) === header));
};

function MapTable<F extends string>({ title, headers, mapping, labels, onChange }: { title: string; headers: string[]; mapping: Record<string, F | "">; labels: Record<F, string>; onChange: (m: Record<string, F | "">) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      <div className="max-h-80 overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Coluna do arquivo</th><th className="px-3 py-2">Campo do sistema</th></tr></thead>
          <tbody>{headers.map((h) => (
            <tr key={h} className="border-t">
              <td className="px-3 py-1.5 font-medium">{h}</td>
              <td className="px-3 py-1.5">
                <Select value={mapping[h] || "__none"} onValueChange={(v) => onChange({ ...mapping, [h]: v === "__none" ? "" : (v as F) })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">IGNORAR — não importar</SelectItem>
                    {(Object.keys(labels) as F[]).map((k) => <SelectItem key={k} value={k}>{labels[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

export function FullImport() {
  const qc = useQueryClient();
  const [base, setBase] = useState<Src | null>(null);
  const [statusSrc, setStatusSrc] = useState<Src | null>(null);
  const [baseSheet, setBaseSheet] = useState(0);
  const [statusSheet, setStatusSheet] = useState(-1);
  const [lhSheet, setLhSheet] = useState(-1);
  const [lhSrc, setLhSrc] = useState<Src | null>(null);
  const [baseMap, setBaseMap] = useState<FullBaseMapping>({});
  const [statusMap, setStatusMap] = useState<FullStatusMapping>({});
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("");
  const [strategy, setStrategy] = useState<"ignore" | "update">("update");
  const [existing, setExisting] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<{ inserted: number; existing: number; status: string } | null>(null);

  const isXlsx = base && base.parsed.format !== "csv";
  const baseTable = useMemo(() => { const s = base?.parsed.sheets[baseSheet]; return s ? buildTable(s.rows, detectHeaderRow(s.rows)) : null; }, [base, baseSheet]);
  const statusTable = useMemo(() => {
    const src = isXlsx ? base : statusSrc;
    const s = src?.parsed.sheets[isXlsx ? statusSheet : 0];
    return s ? buildTable(s.rows, detectHeaderRow(s.rows)) : null;
  }, [base, statusSrc, statusSheet, isXlsx]);

  const lhParse = useMemo(() => {
    const src = isXlsx ? base : lhSrc;
    const s = src?.parsed.sheets[isXlsx ? lhSheet : 0];
    return s ? parseLhSheet(s.rows) : null;
  }, [base, lhSrc, lhSheet, isXlsx]);
  const lhIndex = useMemo(() => buildLhIndex(lhParse), [lhParse]);
  const build = useMemo(() => baseTable && statusTable ? buildFullRows(baseTable.body, baseMap, buildStatusIndex(statusTable.body, statusMap), lhParse ? lhIndex.map : undefined) : null, [baseTable, statusTable, baseMap, statusMap, lhParse, lhIndex]);
  const mappedOk = Object.values(baseMap).includes("order_id") && Object.values(statusMap).includes("match_br") && Object.values(statusMap).includes("br_status");

  async function loadSaved(kind: "base" | "status", headers: string[]) {
    const { data } = await supabase.from("column_mappings").select("mapping").eq("module", "full").eq("header_signature", `${kind}::${headerSignature(headers)}`).maybeSingle();
    return data?.mapping as Record<string, string> | undefined;
  }
  async function applyBase(p: ParsedFile, idx: number) {
    const s = p.sheets[idx]; if (!s) return;
    const h = buildTable(s.rows, detectHeaderRow(s.rows)).headers;
    setBaseMap(((await loadSaved("base", h)) as FullBaseMapping) ?? suggestFullBase(h));
  }
  async function applyStatus(p: ParsedFile, idx: number) {
    const s = p.sheets[idx]; if (!s) return;
    const h = buildTable(s.rows, detectHeaderRow(s.rows)).headers;
    setStatusMap(((await loadSaved("status", h)) as FullStatusMapping) ?? suggestFullStatus(h));
  }

  async function onBase(f: File) {
    setBusy("Lendo arquivo..."); setDone(null); setExisting(null);
    try {
      const p = await parseFile(f);
      if (p.format === "pdf") throw new Error("FULL aceita XLSX completo ou CSVs das abas 2 e 3.");
      setBase({ file: f, parsed: p });
      setLhSrc(null); setLhSheet(-1);
      if (p.format === "csv") { setBaseSheet(0); await applyBase(p, 0); }
      else {
        const b = Math.max(0, findSheet(p, "2", "to number")); const s = findSheet(p, "3", "order id");
        setBaseSheet(b); setStatusSheet(s); setStatusSrc(null); setLhSheet(findSheet(p, "1", "lh"));
        await applyBase(p, b); if (s >= 0) await applyStatus(p, s);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao ler arquivo"); } finally { setBusy(null); }
  }
  async function onLh(f: File) {
    setBusy("Lendo arquivo de LHs...");
    try { const p = await parseFile(f); if (p.format !== "csv") throw new Error("Envie o CSV da aba 1 - TO's."); setLhSrc({ file: f, parsed: p }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao ler arquivo"); } finally { setBusy(null); }
  }
  async function onStatus(f: File) {
    setBusy("Lendo arquivo de status...");
    try { const p = await parseFile(f); if (p.format !== "csv") throw new Error("Envie o CSV da aba 3 - Exportar BR em LOTE."); setStatusSrc({ file: f, parsed: p }); await applyStatus(p, 0); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao ler arquivo"); } finally { setBusy(null); }
  }

  async function saveMapping() {
    if (!baseTable || !statusTable) return;
    const { data: u } = await supabase.auth.getUser();
    const rows = [
      { module: "full", name: `FULL · base · ${base?.file.name}`, header_signature: `base::${headerSignature(baseTable.headers)}`, mapping: baseMap, created_by: u.user?.id },
      { module: "full", name: `FULL · status · ${(statusSrc ?? base)?.file.name}`, header_signature: `status::${headerSignature(statusTable.headers)}`, mapping: statusMap, created_by: u.user?.id },
    ];
    const { error } = await supabase.from("column_mappings").upsert(rows, { onConflict: "module,header_signature" });
    error ? toast.error(error.message) : toast.success("Mapeamento FULL salvo.");
  }

  async function check() {
    if (!build) return;
    setExisting(await countFullExisting(build.rows.map((r) => fullDedupeKey(date || null, shift || null, r.key))));
  }

  async function confirm() {
    if (!build || !base || !baseTable) return;
    if (!build.rows.length) { toast.error("Nenhum pacote válido para salvar."); return; }
    setBusy("Salvando registros...");
    try {
      const sheetName = isXlsx ? `${base.parsed.sheets[baseSheet]?.name} + ${base.parsed.sheets[statusSheet]?.name}` : `${base.file.name} + ${statusSrc?.file.name}`;
      const res = await commitFullImport({ build, date: date || null, shift: shift || null, strategy, fileName: isXlsx ? base.file.name : `${base.file.name} + ${statusSrc?.file.name}`, format: base.parsed.format, sheetName, headers: baseTable.headers, mapping: { base: baseMap, status: statusMap } });
      setDone(res); await invalidateImportQueries(qc, { module: "full", batchId: res.batchId });
      toast.success(`Importação FULL concluída: ${res.inserted} novos registros.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      <Panel title="Arquivos do FULL" subtitle="XLSX completo (abas 2 e 3) ou dois CSVs separados">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>XLSX completo ou CSV da aba “2 - Exportar TO em LOTE”</Label>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-sm hover:border-primary">
              <FileUp className="h-5 w-5 text-primary" /><span className="truncate">{base ? base.file.name : "Selecionar arquivo (.xlsx, .xls, .csv)"}</span>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onBase(e.target.files[0])} />
            </label>
          </div>
          {base && !isXlsx && (
            <div className="space-y-1.5">
              <Label>CSV da aba “3 - Exportar BR em LOTE” (status)</Label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-sm hover:border-primary">
                <FileUp className="h-5 w-5 text-primary" /><span className="truncate">{statusSrc ? statusSrc.file.name : "Adicionar arquivo de status (.csv)"}</span>
                <input type="file" className="hidden" accept=".csv" onChange={(e) => e.target.files?.[0] && onStatus(e.target.files[0])} />
              </label>
            </div>
          )}
          {base && !isXlsx && (
            <div className="space-y-1.5">
              <Label>CSV da aba “1 - TO's” (LHs, opcional)</Label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-sm hover:border-primary">
                <FileUp className="h-5 w-5 text-primary" /><span className="truncate">{lhSrc ? lhSrc.file.name : "Adicionar arquivo de LHs (.csv)"}</span>
                <input type="file" className="hidden" accept=".csv" onChange={(e) => e.target.files?.[0] && onLh(e.target.files[0])} />
              </label>
            </div>
          )}
          {base && isXlsx && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Aba base</Label>
                <Select value={String(baseSheet)} onValueChange={(v) => { setBaseSheet(Number(v)); applyBase(base.parsed, Number(v)); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{base.parsed.sheets.map((s, i) => <SelectItem key={i} value={String(i)}>{s.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label>Aba de status</Label>
                <Select value={statusSheet >= 0 ? String(statusSheet) : undefined} onValueChange={(v) => { setStatusSheet(Number(v)); applyStatus(base.parsed, Number(v)); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{base.parsed.sheets.map((s, i) => <SelectItem key={i} value={String(i)}>{s.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label>Aba de LHs (opcional)</Label>
                <Select value={String(lhSheet)} onValueChange={(v) => setLhSheet(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="-1">Nenhuma — importar sem LH</SelectItem>{base.parsed.sheets.map((s, i) => <SelectItem key={i} value={String(i)}>{s.name}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
          )}
        </div>
        {base && !statusTable && <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">Fonte de status ausente: {isXlsx ? "selecione a aba “3 - Exportar BR em LOTE”." : "adicione o CSV da aba “3 - Exportar BR em LOTE”."}</p>}
        {busy && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{busy}</p>}
      </Panel>

      {baseTable && (
        <Panel title="Mapeamento FULL" subtitle="Coluna do arquivo → Campo do sistema" action={<Button size="sm" variant="outline" onClick={saveMapping} disabled={!statusTable}><Save className="mr-1 h-4 w-4" />Salvar mapeamento</Button>}>
          <div className="grid gap-5 xl:grid-cols-2">
            <MapTable title="Base — pacotes (aba 2)" headers={baseTable.headers} mapping={baseMap} labels={FULL_BASE_LABELS} onChange={(m) => { setBaseMap(m); setExisting(null); }} />
            {statusTable ? <MapTable title="Status — somente BR e Status (aba 3)" headers={statusTable.headers} mapping={statusMap} labels={FULL_STATUS_LABELS} onChange={(m) => { setStatusMap(m); setExisting(null); }} /> : <p className="text-sm text-muted-foreground">Aguardando fonte de status.</p>}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">“BR para cruzamento” serve só para associar as fontes. “TO Status” é o status da TO e não é usado como status do pacote.</p>
        </Panel>
      )}

      {build && mappedOk && (
        <Panel title="Validação FULL">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[["Linhas da base", build.total], ["Pacotes (BR único)", build.uniqueBr], ["Vínculos BR/TO", build.rows.length], ["Pendentes", build.pending], ["Conflitos", build.conflicts], ["Sem BR / duplicados", `${build.missingBr} / ${build.dupInFile}`]].map(([l, v]) => (
              <div key={l as string} className="rounded-md border p-3"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold tabular-nums">{v}</p></div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5"><Label>Data da operação (opcional)</Label><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setExisting(null); }} /></div>
            <div className="space-y-1.5"><Label>Turno (opcional)</Label>
              <Select value={shift || "__none"} onValueChange={(v) => { setShift(v === "__none" ? "" : v); setExisting(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__none">Sem turno</SelectItem>{["AM1", "AM2", "PM1"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1.5"><Label>Registros já existentes (mesma data/turno/BR/TO)</Label>
              <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as "ignore" | "update")} className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="update" />Atualizar</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="ignore" />Ignorar</label>
              </RadioGroup>
              <button type="button" className="text-xs text-primary underline" onClick={check}>Verificar existentes{existing !== null ? `: ${existing}` : ""}</button>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Classificações manuais nunca são apagadas por reimportação. A data não é deduzida dos campos de criação da TO.</p>
          <div className="mt-4 flex justify-end"><Button onClick={confirm} disabled={!!busy}>Confirmar importação</Button></div>
        </Panel>
      )}

      {done && (
        <Panel title="Concluído">
          <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-5 w-5 text-primary" />{done.status}: {done.inserted} novos, {done.existing} já existentes.</p>
          <Button asChild className="mt-3"><Link to="/m/$slug" params={{ slug: "full" }}>Abrir FULL</Link></Button>
        </Panel>
      )}
    </div>
  );
}
