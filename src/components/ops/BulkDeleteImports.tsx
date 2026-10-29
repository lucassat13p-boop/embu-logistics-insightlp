import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { BatchRow } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

/** Same ownership rule as the individual deletion button. */
export function useImportDeletionUser() {
  return useQuery({
    queryKey: ["import-deletion-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
  });
}

export function BulkDeleteImports({ batches, onDone }: { batches: BatchRow[]; onDone: (deletedIds: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasFloating = batches.some((b) => b.module === "pacotes_flutuantes");
  const pointer = useQuery({
    queryKey: ["floating-deletion-pointer"],
    enabled: open && hasFloating,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("floating_active_snapshot").select("batch_id").eq("id", true).maybeSingle();
      if (error) throw error;
      return data?.batch_id ?? null;
    },
  });
  const activeIncluded = hasFloating && batches.some((b) => b.id === pointer.data);
  const unavailable = hasFloating && (pointer.isPending || pointer.isFetching || pointer.isError);

  const deletion = useMutation({
    mutationFn: async () => {
      const deleted: string[] = [];
      const failed: { batch: BatchRow; message: string }[] = [];
      let deletedActive = false;
      // Sequential reuse of the individual atomic deletion functions.
      for (const batch of batches) {
        const floating = batch.module === "pacotes_flutuantes";
        const { data, error } = floating
          ? await supabase.rpc("delete_floating_import_batch", { p_batch_id: batch.id, p_confirm_active: batch.id === pointer.data })
          : await supabase.rpc("delete_import_batch", { p_batch_id: batch.id });
        if (error) failed.push({ batch, message: error.message });
        else {
          deleted.push(batch.id);
          if (data && typeof data === "object" && !Array.isArray(data) && (data as Record<string, unknown>).deleted_active === true) deletedActive = true;
        }
      }
      return { deleted, failed, deletedActive };
    },
    onSuccess: async ({ deleted, failed, deletedActive }) => {
      setOpen(false);
      if (deletedActive) {
        queryClient.setQueryData(["records", "pacotes_flutuantes", "active"], { batchId: null, updatedAt: null, rows: [] });
        queryClient.setQueryData(["records", "pacotes_flutuantes"], []);
      }
      if (deleted.length) {
        const set = new Set(deleted);
        queryClient.setQueryData<BatchRow[]>(["batches"], (rows) => rows?.filter((r) => !set.has(r.id)));
        deleted.forEach((id) => queryClient.removeQueries({ queryKey: ["batch", id], exact: true }));
      }
      onDone(deleted);
      await queryClient.invalidateQueries({
        predicate: (q) => ["batches", "batch", "records", "import_errors", "search", "floating-deletion-pointer"].includes(String(q.queryKey[0])),
      });
      if (deleted.length) toast.success(`${deleted.length} ${deleted.length === 1 ? "importação excluída" : "importações excluídas"}. Os totais foram atualizados.`);
      if (failed.length) {
        toast.error(`${failed.length} ${failed.length === 1 ? "importação não pôde ser excluída" : "importações não puderam ser excluídas"}: ${failed.map((f) => f.batch.file_name).join(", ")}`, { duration: 12000 });
      }
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível excluir as importações."),
  });

  const n = batches.length;
  return (
    <>
      <Button variant="destructive" size="sm" disabled={!n || deletion.isPending} onClick={() => setOpen(true)}>
        {deletion.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        Excluir selecionados ({n})
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => { if (!deletion.isPending) setOpen(next); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir importações selecionadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir {n} {n === 1 ? "importação" : "importações"} e os dados vinculados a elas. Essa ação não poderá ser desfeita. Deseja continuar?
            </AlertDialogDescription>
            {activeIncluded && <p className="text-sm font-medium text-destructive">A seleção inclui a importação ativa de Pacotes Flutuantes. A lista atual de pacotes flutuantes também será removida.</p>}
            {hasFloating && pointer.isFetching && <p className="text-sm text-muted-foreground">Verificando a importação ativa…</p>}
            {hasFloating && pointer.isError && <p className="text-sm text-destructive">Não foi possível verificar a base ativa. Feche esta janela e tente novamente.</p>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={deletion.isPending || unavailable} onClick={() => { if (!deletion.isPending && !unavailable) deletion.mutate(); }}>
              {deletion.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {deletion.isPending ? "Excluindo…" : "Confirmar exclusão"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
