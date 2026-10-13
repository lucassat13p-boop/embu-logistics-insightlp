import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/ops/blocks";
import { supabase } from "@/integrations/supabase/client";
import { FIELD_LABELS, MODULES, moduleByKey, suggestMapping, type FieldKey, type ModuleKey } from "@/lib/modules";
import { buildTable, detectHeaderRow, parseDate, parseFile, type ParsedFile } from "@/lib/parsers";
import { commitImport, countExisting, headerSignature, validate, type DupStrategy, type Mapping, type ValidationResult } from "@/lib/importer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/importar")({
  validateSearch: (s: Record<string, unknown>) => ({ modulo: typeof s.modulo === "string" ? (s.modulo as string) : undefined }),
  head: () => ({
    meta: [
      { title: "Importar Dados — Shopee Operations Hub" },
      { name: "description", content: "Importe relatórios reais XLSX, XLS, CSV ou PDF para os módulos do HUB." },
      { property: "og:title", content: "Importar Dados — Shopee Operations Hub" },
      { property: "og:description", content: "Importador universal de relatórios reais." },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const { modulo } = Route.useSearch();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [moduleKey, setModuleKey] = useState<ModuleKey | "">((moduleByKey(modulo ?? "")?.key as ModuleKey) ?? "");
  const mod = moduleKey ? moduleByKey(moduleKey)! : null;
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerIdx, setHeaderIdx] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [existing, setExisting] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<DupStrategy>("ignore");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [done, setDone] = useState<{ batchId: string; inserted: number; existing: number; status: string } | null>(null);

  const sheet = parsed?.sheets[sheetIdx];
  const table = useMemo(() => (sheet ? buildTable(sheet.rows, headerIdx) : null), [sheet, headerIdx]);

  async function loadMapping(headers: string[], m = mod) {
    if (!m) return;
    const sig = headerSignature(headers);
    const { data } = await supabase.from("column_mappings").select("mapping").eq("module", m.key).eq("header_signature", sig).maybeSingle();
    if (data?.mapping) { setMapping(data.mapping as Mapping); toast.info("Mapeamento salvo reaplicado."); }
    else setMapping(suggestMapping(m, headers));
  }

  async function onFile(f: File) {
    if (!mod) { toast.error("Selecione o módulo antes do arquivo."); return; }
    setFile(f); setResult(null); setDone(null); setExisting(null); setBusy("Lendo arquivo...");
    try {
      const p = await parseFile(f);
      if (!p.sheets.length || p.sheets.every((s) => !s.rows.length)) throw new Error("Arquivo sem conteúdo legível.");
      setParsed(p);
      const idx = mod.firstSheetOnly ? 0 : Math.max(0, p.sheets.findIndex((s) => s.rows.length));
      setSheetIdx(idx);
      const h = detectHeaderRow(p.sheets[idx].rows);
      setHeaderIdx(h);
      await loadMapping(buildTable(p.sheets[idx].rows, h).headers);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler arquivo"); setParsed(null);
    } finally { setBusy(null); }
  }

  async function changeSheet(i: number) {
    if (!parsed) return;
    setSheetIdx(i); setResult(null);
    const h = detectHeaderRow(parsed.sheets[i].rows);
    setHeaderIdx(h);
    await loadMapping(buildTable(parsed.sheets[i].rows, h).headers);
  }

  async function runValidation() {
    if (!mod || !table) return null;
    const used = Object.values(mapping).filter(Boolean);
    if (new Set(used).size !== used.length) { toast.error("Um campo do sistema foi mapeado para mais de uma coluna."); return null; }
    if (!used.length) { toast.error("Mapeie ao menos uma coluna."); return null; }
    setBusy("Validando...");
    const r = validate(mod, table.body, mapping);
    setResult(r);
    try { setExisting(await countExisting(mod, r.valid.map((v) => v.dedupe_key))); } catch { setExisting(null); }
    setBusy(null);
    return r;
  }

  async function saveMapping() {
    if (!mod || !table) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("column_mappings").upsert({ module: mod.key, name: `${mod.label} · ${file?.name}`, header_signature: headerSignature(table.headers), mapping, created_by: u.user?.id }, { onConflict: "module,header_signature" });
    error ? toast.error(error.message) : toast.success("Mapeamento salvo para futuras importações.");
  }

  async function confirm() {
    if (!mod || !table || !file || !parsed) return;
    const r = await runValidation(); // re-validate before saving
    if (!r) return;
    if (!r.valid.length) { toast.error("Nenhum registro válido para salvar."); return; }
    setBusy("Salvando registros...");
    try {
      const res = await commitImport({ mod, fileName: file.name, format: parsed.format, sheetName: sheet!.name, headers: table.headers, mapping, result: r, strategy });
      setDone(res);
      await qc.invalidateQueries();
      toast.success(`Importação concluída: ${res.inserted} novos registros em ${mod.label}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setBusy(null); }
  }

  const step = done ? 4 : result ? 3 : parsed ? 2 : 1;
  const errors = result?.issues.filter((i) => i.kind === "erro") ?? [];
  const preview = table?.body.filter((b) => !b.empty).slice(0, 8) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader title="Importar Dados" subtitle="Importador universal · XLSX, XLS, CSV e PDF" />
      <ol className="flex flex-wrap gap-2 text-xs">
        {["Arquivo", "Mapeamento", "Validação", "Concluído"].map((s, i) => (
          <li key={s} className={cn("rounded-full border px-3 py-1 font-semibold", step > i ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{i + 1}. {s}</li>
        ))}
      </ol>

      <Panel title="1. Módulo e arquivo">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Módulo de destino</Label>
            <Select value={moduleKey} onValueChange={(v) => { setModuleKey(v as ModuleKey); setParsed(null); setFile(null); setResult(null); setDone(null); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o módulo" /></SelectTrigger>
              <SelectContent>{MODULES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            {mod && <p className="text-xs text-muted-foreground">{mod.description}. Os registros alimentam somente este módulo.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Arquivo do relatório</Label>
            <label className={cn("flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-3 text-sm hover:border-primary", !mod && "pointer-events-none opacity-50")}>
              <FileUp className="h-5 w-5 text-primary" />
              <span className="truncate">{file ? file.name : "Selecionar arquivo (.xlsx, .xls, .csv, .pdf)"}</span>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv,.pdf" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            {parsed && <p className="text-xs text-muted-foreground">Formato: {parsed.format.toUpperCase()} · {parsed.sheets.length} {parsed.format === "pdf" ? "página(s)" : "planilha(s)"}</p>}
          </div>
        </div>
        {busy && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{busy}</p>}
      </Panel>

      {parsed && table && mod && (
        <Panel title="2. Estrutura e mapeamento" subtitle="Coluna do arquivo → Campo do sistema" action={<Button size="sm" variant="outline" onClick={saveMapping}><Save className="mr-1 h-4 w-4" />Salvar mapeamento</Button>}>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{parsed.format === "pdf" ? "Página" : "Planilha"}</Label>
              <Select value={String(sheetIdx)} onValueChange={(v) => changeSheet(Number(v))} disabled={mod.firstSheetOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{parsed.sheets.map((s, i) => <SelectItem key={i} value={String(i)}>{s.name} ({s.rows.length} linhas)</SelectItem>)}</SelectContent>
              </Select>
              {mod.firstSheetOnly && <p className="text-xs text-primary">AVARIA: somente a primeira planilha é utilizada. Outras abas são ignoradas.</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Linha do cabeçalho</Label>
              <Input type="number" min={1} value={headerIdx + 1} onChange={(e) => { const v = Math.max(0, Number(e.target.value) - 1); setHeaderIdx(v); setResult(null); if (sheet) loadMapping(buildTable(sheet.rows, v).headers); }} />
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Coluna do arquivo</th><th className="px-3 py-2">Exemplo</th><th className="px-3 py-2">Campo do sistema</th></tr></thead>
              <tbody>
                {table.headers.map((h) => {
                  const sample = preview.find((p) => p.values[h] !== null)?.values[h];
                  const f = mapping[h];
                  return (
                    <tr key={h} className="border-t">
                      <td className="px-3 py-2 font-medium">{h}</td>
                      <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">{sample === undefined || sample === null ? "—" : f === "record_date" ? `${String(sample)} → ${parseDate(sample).iso ?? "inválida"}` : String(sample)}</td>
                      <td className="px-3 py-2">
                        <Select value={f || "__none"} onValueChange={(v) => { setMapping((m) => ({ ...m, [h]: v === "__none" ? "" : (v as FieldKey) })); setResult(null); }}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Não importar como campo (mantido no original)</SelectItem>
                            {mod.fields.map((k) => <SelectItem key={k} value={k}>{FIELD_LABELS[k]}{mod.required.includes(k) ? " *" : ""}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Prévia ({preview.length} primeiras linhas)</p>
          <div className="mt-1 overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60"><tr><th className="px-2 py-1 text-left">#</th>{table.headers.map((h) => <th key={h} className="whitespace-nowrap px-2 py-1 text-left">{h}</th>)}</tr></thead>
              <tbody>{preview.map((p) => <tr key={p.rowNumber} className="border-t"><td className="px-2 py-1 text-muted-foreground">{p.rowNumber}</td>{table.headers.map((h) => <td key={h} className="whitespace-nowrap px-2 py-1">{p.values[h] === null ? "" : String(p.values[h])}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end"><Button onClick={runValidation} disabled={!!busy}>Validar registros</Button></div>
        </Panel>
      )}

      {result && mod && (
        <Panel title="3. Validação">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[["Registros encontrados", result.total], ["Registros válidos", result.valid.length], ["Registros com erro", result.errorCount], ["Registros ignorados", result.ignoredCount], ["Duplicados", result.dupInFile + (existing ?? 0)]].map(([l, v]) => (
              <div key={l as string} className="rounded-md border p-3"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold tabular-nums">{(v as number).toLocaleString("pt-BR")}</p></div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Ignorados = linhas completamente vazias. Duplicados = {result.dupInFile} repetidos no arquivo + {existing ?? "?"} já existentes no banco.</p>

          {errors.length > 0 && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="mb-2 text-sm font-semibold text-destructive">Problemas encontrados ({errors.length})</p>
              <ul className="space-y-1 text-xs">
                {(showAll ? errors : errors.slice(0, 5)).map((e, i) => <li key={i}><span className="font-mono">Linha {e.rowNumber}</span>{e.column && <> · coluna <b>{e.column}</b></>} — {e.message}</li>)}
              </ul>
              {errors.length > 5 && <button className="mt-2 text-xs font-semibold text-primary" onClick={() => setShowAll(!showAll)}>{showAll ? "Mostrar menos" : `Ver todos os ${errors.length} erros`}</button>}
            </div>
          )}

          {(existing ?? 0) > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold">{existing} registro(s) já existem neste módulo. Como tratar?</p>
              <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as DupStrategy)} className="gap-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="ignore" id="s1" /><Label htmlFor="s1" className="font-normal">Ignorar duplicados — importar somente registros novos</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="update" id="s2" /><Label htmlFor="s2" className="font-normal">Atualizar registros existentes com os dados deste arquivo</Label></div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">Dados anteriores nunca são apagados.</p>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button onClick={confirm} disabled={!!busy || !result.valid.length || !!done}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Confirmar importação
            </Button>
          </div>
        </Panel>
      )}

      {done && mod && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-success/40 bg-success/10 p-4">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Importação registrada · {done.status}</p>
            <p className="text-muted-foreground">{done.inserted} novos · {done.existing} já existentes ({strategy === "update" ? "atualizados" : "ignorados"})</p>
          </div>
          <Button variant="outline" asChild><Link to="/historico/$id" params={{ id: done.batchId }}>Ver detalhes</Link></Button>
          <Button onClick={() => nav({ to: "/m/$slug", params: { slug: mod.slug } })}>Abrir {mod.label}</Button>
        </div>
      )}
    </div>
  );
}
