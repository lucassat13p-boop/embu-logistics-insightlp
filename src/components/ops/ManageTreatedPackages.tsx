import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { treatedImportsQuery, type TreatedImportRow } from "@/lib/on-hold-treated";

export function ManageTreatedPackages() {
  const qc = useQueryClient();
  const { data: rows = [], isPending, isError } = useQuery(treatedImportsQuery());
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const lock = useRef(false);
  const selectedRows = rows.filter((r) => selected.has(r.id));
  useEffect(() => {
    const available = new Set(rows.map((r) => r.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);

  async function remove() {
    if (!confirmed?.length || lock.current) return;
    lock.current = true;
    setDeleting(true);
    const removed = new Set<string>();
    try {
      for (const id of confirmed) {
        try {
          const { data, error } = await supabase.from("on_hold_treated_imports").delete().eq("id", id).select("id").single();
          if (!error && data?.id === id) removed.add(id);
        } catch {
          // Keep unconfirmed rows selected for retry.
        }
      }
      if (removed.size) {
        qc.setQueryData<TreatedImportRow[]>(["on_hold_treated_imports"], (current) => current?.filter((r) => !removed.has(r.id)));
        setSelected((current) => new Set([...current].filter((id) => !removed.has(id))));
        void qc.invalidateQueries({ queryKey: ["on_hold_treated_imports"] });
        void qc.invalidateQueries({ queryKey: ["official_treatments"] });
      }
      const failed = confirmed.length - removed.size;
      if (failed) toast.error(`${removed.size} registro(s) excluído(s); ${failed} sem confirmação. Os restantes continuam selecionados.`);
      else toast.success("Dados de pacotes tratados selecionados excluídos definitivamente.");
      setConfirmed(null);
    } finally {
      lock.current = false;
      setDeleting(false);
    }
  }

  return <>
    <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Settings2 className="h-4 w-4" />Gerenciar pacotes tratados</Button>
    <Dialog open={open} onOpenChange={(next) => { if (!deleting) setOpen(next); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pacotes tratados do ON HOLD</DialogTitle>
          <DialogDescription>Totais salvos da aba Pacotes Tratados / Não MEXER, por data e turno. Cada registro corresponde a um total importado, não a um pacote individual. Todos os períodos estão listados abaixo.</DialogDescription>
        </DialogHeader>
        {isPending ? <p>Carregando…</p> : isError ? <p className="text-destructive">Não foi possível carregar os registros.</p> : <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{rows.length} registro(s) · {rows.reduce((sum, r) => sum + r.quantity, 0).toLocaleString("pt-BR")} pacotes</span>
            {selectedRows.length > 0 && <Button variant="destructive" size="sm" disabled={deleting} onClick={() => setConfirmed(selectedRows.map((r) => r.id))}><Trash2 className="h-4 w-4" />Excluir selecionados ({selectedRows.length})</Button>}
          </div>
          {!rows.length ? <p className="text-sm text-muted-foreground">Nenhum registro de pacotes tratados.</p> : <div className="max-h-[50dvh] overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="p-2"><Checkbox aria-label="Selecionar todos os totais importados" disabled={deleting} checked={selectedRows.length === rows.length ? true : selectedRows.length ? "indeterminate" : false} onCheckedChange={(checked) => setSelected(checked === true ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
                <th className="p-2">Data</th><th className="p-2">Turno</th><th className="p-2 text-right">Pacotes tratados</th><th className="p-2">Arquivo de origem</th>
              </tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id} className="border-b">
                <td className="p-2"><Checkbox aria-label={`Selecionar total de ${r.operation_date} ${r.shift}`} disabled={deleting} checked={selected.has(r.id)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked === true) next.add(r.id); else next.delete(r.id); return next; })} /></td>
                <td className="whitespace-nowrap p-2">{r.operation_date.split("-").reverse().join("/")}</td><td className="p-2">{r.shift}</td><td className="p-2 text-right tabular-nums">{r.quantity.toLocaleString("pt-BR")}</td><td className="p-2">{r.file_name ?? "Sem informação"}</td>
              </tr>)}</tbody>
            </table>
          </div>}
          {selectedRows.length > 0 && <p className="text-sm text-muted-foreground">{selectedRows.length} registro(s) selecionado(s) · {selectedRows.reduce((sum, r) => sum + r.quantity, 0).toLocaleString("pt-BR")} pacotes</p>}
        </>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmed !== null} onOpenChange={(next) => { if (!next && !deleting) setConfirmed(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir pacotes tratados do ON HOLD?</AlertDialogTitle>
          <AlertDialogDescription>Esta ação removerá definitivamente os dados de pacotes tratados selecionados. Não será possível desfazer.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={deleting} onClick={remove}>{deleting ? "Excluindo…" : "Confirmar exclusão"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}