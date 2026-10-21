CREATE OR REPLACE FUNCTION public.delete_floating_import_batch(p_batch_id uuid, p_confirm_active boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE selected_batch public.import_batches%ROWTYPE; active_batch uuid; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão expirada. Entre novamente.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('floating_active_snapshot', 0));
  SELECT * INTO selected_batch FROM public.import_batches WHERE id = p_batch_id AND user_id = auth.uid() AND module = 'pacotes_flutuantes' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Importação não encontrada ou sem permissão para excluir.'; END IF;
  IF selected_batch.status = 'Processando' THEN RAISE EXCEPTION 'Aguarde a conclusão da importação antes de excluir.'; END IF;
  SELECT batch_id INTO active_batch FROM public.floating_active_snapshot WHERE id = true FOR UPDATE;
  IF active_batch = p_batch_id THEN
    IF p_confirm_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Esta importação é a base ativa. Feche e abra a confirmação novamente para autorizar a remoção da lista atual.';
    END IF;
    DELETE FROM public.floating_active_snapshot WHERE id = true AND batch_id = p_batch_id;
  END IF;
  result := public.delete_import_batch(p_batch_id);
  RETURN result || pg_catalog.jsonb_build_object('deleted_active', active_batch = p_batch_id);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_floating_import_batch(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_floating_import_batch(uuid, boolean) TO authenticated;
COMMENT ON FUNCTION public.delete_floating_import_batch(uuid, boolean) IS 'Owner-authorized atomic Floating deletion; serializes with snapshot replacement, requires explicit active-list confirmation, and never restores historical snapshots.';
COMMENT ON TABLE public.floating_active_snapshot IS 'Confirmed complete Perdidos snapshot. Historical batches are never restored automatically; owner-confirmed active deletion removes the pointer atomically.';