import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FullStatusPicker } from "./FullStatusPicker";
import { supabase } from "@/integrations/supabase/client";
import type { RecordRow } from "@/lib/data";
import { fullBrList, fullManualError, fullSelectionScope } from "@/lib/full-selection";

export function FullBulkDialog({ allRows, selected, onClose, onSaved }: { allRows: RecordRow[]; selected: Set<string>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  const scope = fullSelectionScope(allRows, selected, overwrite);
  async function save() {
    if (lock.current) return;
    const error = fullManualError(value);
    if (error) { toast.error(error); return; }
    lock.current = true; setBusy(true); setFailure(null);
    try {
      const { data, error: saveError } = await supabase.rpc("classify_full_selection", {
        p_selected_ids: scope.chosen.map((r) => r.id), p_expected_ids: scope.linked.map((r) => r.id), p_status: value.trim(), p_overwrite: overwrite,
      });
      if (saveError) throw new Error(saveError.message);
      const result = data as { updated_ids?: string[]; skipped_ids?: string[] } | null;
      if (!result || !Array.isArray(result.updated_ids) || !Array.isArray(result.skipped_ids)) throw new Error("Não foi possível confirmar o resultado. Atualize os registros antes de tentar novamente.");
      toast.success(`${result.updated_ids.length} registros classificados; ${result.skipped_ids.length} preservados.`);
      await onSaved(); onClose();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Não foi possível confirmar a gravação. Atualize os registros antes de tentar novamente.");
    } finally { lock.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl" onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }} onPointerDownOutside={(e) => { if (busy) e.preventDefault(); }}>
    <DialogHeader><DialogTitle>Classificar selecionados</DialogTitle></DialogHeader>
    <p className="text-sm">{scope.chosen.length} registros selecionados · {fullBrList(scope.chosen).length} BRs únicos</p>
    <p className="text-sm text-muted-foreground">Alcance: {scope.linked.length} vínculos na mesma data e turno ({scope.linked.length - scope.chosen.length} adicionais com outras TOs). Status originais serão preservados.</p>
    <p className="text-sm text-muted-foreground">Sem data ou turno, os vínculos ficam restritos à mesma importação.</p>
    <FullStatusPicker value={value} disabled={busy} onChange={(v) => { setValue(v); setConfirm(false); }} />
    <p className="text-xs text-muted-foreground">LMHub_Received exige uma justificativa: informe por que o pacote recebido no HUB não saiu.</p>
    <label className="flex items-start gap-2 text-sm"><Checkbox checked={overwrite} disabled={busy} onCheckedChange={(v) => { setOverwrite(v === true); setConfirm(false); }} />Sobrescrever classificações manuais existentes ({scope.existingManual} registros)</label>
    {!overwrite && scope.preserved > 0 && <p className="text-sm text-muted-foreground">{scope.preserved} registros serão preservados, incluindo vínculos de BRs que já possuem classificação manual.</p>}
    <details className="text-sm"><summary className="cursor-pointer">Ver alcance completo ({scope.linked.length} registros)</summary><div className="mt-2 max-h-56 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th>BR / TO</th><th>Data / Turno</th><th>Resultado</th></tr></thead><tbody>{scope.linked.map((r) => <tr key={r.id} className="border-t"><td className="py-2 break-all">{r.order_id || "Sem BR"}<br />{r.to_number || "Sem TO"}</td><td>{r.record_date || "Sem data"}<br />{r.shift || "Sem turno"}</td><td>{overwrite || scope.affected.some((a) => a.id === r.id) ? "Alterar" : "Preservar"}<br />{r.manual_status || "Sem classificação manual"}</td></tr>)}</tbody></table></div></details>
    {confirm && <div className="rounded-md border p-3 text-sm space-y-1"><p>Classificação: <strong className="break-words">{value.trim()}</strong></p><p><strong>{scope.affected.length} registros</strong> serão alterados · {fullBrList(scope.affected).length} BRs únicos.</p><p>{scope.preserved} registros preservados.</p></div>}
    {failure && <p role="alert" className="text-sm text-destructive">{failure} A gravação é atômica: erros de permissão ou de validação não salvam alterações parciais. Em falha de conexão, o resultado não está confirmado; atualize a tabela antes de repetir.</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={busy || !scope.affected.length || !!fullManualError(value)} onClick={() => { if (confirm) void save(); else setConfirm(true); }}>{busy ? "Salvando…" : confirm ? `Confirmar ${scope.affected.length} alterações` : "Revisar classificação"}</Button></div>
  </DialogContent></Dialog>;
}