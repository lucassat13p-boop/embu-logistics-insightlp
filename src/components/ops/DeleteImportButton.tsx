import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { BatchRow } from "@/lib/data";
import { moduleByKey } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export function DeleteImportButton({ batch, onDeleted }: { batch: BatchRow; onDeleted?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: userId } = useQuery({
    queryKey: ["import-deletion-user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
  });
  const canDelete = Boolean(userId && userId === batch.user_id);
  const processing = batch.status === "Processando";
  const floating = batch.module === "pacotes_flutuantes";
  const activeSnapshot = useQuery({
    queryKey: ["floating-deletion-pointer"],
    enabled: open && floating,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("floating_active_snapshot").select("batch_id").eq("id", true).maybeSingle();
      if (error) throw error;
      return data?.batch_id ?? null;
    },
  });
  const isActive = floating && activeSnapshot.data === batch.id;
  const confirmationUnavailable = floating && (activeSnapshot.isPending || activeSnapshot.isFetching || activeSnapshot.isError);
  const deletion = useMutation({
    mutationFn: async () => {
      const { data, error } = floating
        ? await supabase.rpc("delete_floating_import_batch", { p_batch_id: batch.id, p_confirm_active: isActive })
        : await supabase.rpc("delete_import_batch", { p_batch_id: batch.id });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async (result) => {
      setOpen(false);
      if (result && typeof result === "object" && !Array.isArray(result) && result.deleted_active === true) {
        queryClient.setQueryData(["records", "pacotes_flutuantes", "active"], { batchId: null, updatedAt: null, rows: [] });
        queryClient.setQueryData(["records", "pacotes_flutuantes"], []);
      }
      queryClient.setQueryData<BatchRow[]>(["batches"], (rows) => rows?.filter((row) => row.id !== batch.id));
      queryClient.removeQueries({ queryKey: ["batch", batch.id], exact: true });
      await onDeleted?.();
      await queryClient.invalidateQueries({
        predicate: (query) => ["batches", "batch", "records", "import_errors", "search", "floating-deletion-pointer"].includes(String(query.queryKey[0])),
      });
      toast.success("Importação excluída. Os totais foram atualizados com os registros restantes.");
    },
    onError: (error) => toast.error(floating ? `Não foi possível excluir a importação. Nenhum dado foi removido. ${error.message.includes("base ativa") ? error.message : "Tente novamente."}` : error.message || "Não foi possível excluir a importação. Nenhum dado foi removido."),
  });
  const label = processing ? "Aguarde a conclusão da importação" : !canDelete ? "Somente quem realizou a importação pode excluí-la" : `Excluir importação: ${batch.file_name}`;

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!deletion.isPending) setOpen(next); }}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 text-destructive" disabled={!canDelete || processing || deletion.isPending} title={label} aria-label={label}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta importação?</AlertDialogTitle>
          <AlertDialogDescription className="break-words">
            O arquivo <strong>{batch.file_name}</strong>, do módulo {moduleByKey(batch.module)?.label ?? batch.module}, importado em {new Date(batch.created_at).toLocaleString("pt-BR")}, será removido do histórico junto com os registros e avisos vinculados a esta importação. Outras importações, módulos e registros sem vínculo serão preservados. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
          {isActive && <p className="text-sm font-medium text-destructive">Esta é a importação ativa de Pacotes Flutuantes. Ao excluí-la, a lista atual de pacotes flutuantes também será removida. Deseja continuar?</p>}
          {floating && activeSnapshot.isFetching && <p className="text-sm text-muted-foreground">Verificando a importação ativa…</p>}
          {floating && activeSnapshot.isError && <p className="text-sm text-destructive">Não foi possível verificar a base ativa. Feche esta janela e tente novamente.</p>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletion.isPending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={deletion.isPending || confirmationUnavailable} onClick={() => { if (!deletion.isPending && !confirmationUnavailable) deletion.mutate(); }}>
            {deletion.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {deletion.isPending ? "Excluindo…" : "Excluir importação"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}