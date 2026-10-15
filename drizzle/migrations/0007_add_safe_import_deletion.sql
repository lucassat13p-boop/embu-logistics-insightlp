CREATE OR REPLACE FUNCTION public.delete_import_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  selected_batch public.import_batches%ROWTYPE;
  removed_records bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Entre novamente.';
  END IF;

  SELECT * INTO selected_batch FROM public.import_batches
  WHERE id = p_batch_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Importação não encontrada ou sem permissão para excluir.';
  END IF;
  IF selected_batch.status = 'Processando' THEN
    RAISE EXCEPTION 'Aguarde a conclusão da importação antes de excluir.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.records WHERE batch_id = p_batch_id AND (module IS DISTINCT FROM selected_batch.module OR row_number IS NULL))
     OR EXISTS (SELECT 1 FROM public.import_errors WHERE batch_id = p_batch_id AND module IS DISTINCT FROM selected_batch.module) THEN
    RAISE EXCEPTION 'Os vínculos desta importação precisam ser revisados antes da exclusão segura.';
  END IF;

  DELETE FROM public.records WHERE batch_id = p_batch_id AND module = selected_batch.module AND row_number IS NOT NULL;
  GET DIAGNOSTICS removed_records = ROW_COUNT;
  DELETE FROM public.import_errors WHERE batch_id = p_batch_id AND module = selected_batch.module;
  UPDATE public.collaborators SET first_seen_batch = NULL WHERE first_seen_batch = p_batch_id;
  DELETE FROM public.import_batches WHERE id = p_batch_id AND user_id = auth.uid();

  RETURN jsonb_build_object('batch_id', p_batch_id, 'deleted_records', removed_records);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_import_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_import_batch(uuid) TO authenticated;
COMMENT ON FUNCTION public.delete_import_batch(uuid) IS 'Atomically removes only an authenticated owner''s completed import and its explicitly linked source rows; preserves collaborator identities and rejects ambiguous links.';