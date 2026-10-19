CREATE OR REPLACE FUNCTION public.classify_full_selection(p_selected_ids uuid[], p_expected_ids uuid[], p_status text, p_overwrite boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  scope_ids uuid[];
  updated_ids uuid[];
  skipped_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão expirada. Entre novamente.'; END IF;
  IF p_status IS NULL OR btrim(p_status) = '' THEN RAISE EXCEPTION 'Informe uma classificação válida.'; END IF;
  IF lower(regexp_replace(btrim(p_status), '\s+', '_', 'g')) = 'lmhub_received' THEN
    RAISE EXCEPTION 'Informe por que este pacote recebido no HUB não saiu. LMHub_Received não resolve a pendência.';
  END IF;
  IF coalesce(cardinality(p_selected_ids), 0) = 0 THEN RAISE EXCEPTION 'Selecione registros.'; END IF;
  IF (SELECT count(DISTINCT id) FROM public.records WHERE module = 'full' AND id = ANY(p_selected_ids)) <> (SELECT count(DISTINCT x) FROM unnest(p_selected_ids) x) THEN
    RAISE EXCEPTION 'Seleção alterada ou sem permissão de leitura. Atualize os resultados.';
  END IF;
  SELECT array_agg(r.id ORDER BY r.id) INTO scope_ids
  FROM public.records r
  WHERE r.module = 'full' AND EXISTS (
    SELECT 1 FROM public.records s WHERE s.module = 'full' AND s.id = ANY(p_selected_ids)
      AND (s.id = r.id OR (
        nullif(regexp_replace(upper(s.order_id), '\s+', '', 'g'), '') IS NOT NULL
        AND regexp_replace(upper(s.order_id), '\s+', '', 'g') = regexp_replace(upper(r.order_id), '\s+', '', 'g')
        AND s.record_date IS NOT DISTINCT FROM r.record_date AND s.shift IS NOT DISTINCT FROM r.shift
        AND ((s.record_date IS NOT NULL AND s.shift IS NOT NULL AND btrim(s.shift) <> '') OR s.batch_id = r.batch_id)
      ))
  );
  PERFORM id FROM public.records WHERE id = ANY(scope_ids) ORDER BY id FOR UPDATE;
  IF scope_ids IS DISTINCT FROM (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_expected_ids) x) THEN
    RAISE EXCEPTION 'O alcance dos vínculos mudou. Atualize os resultados e confirme novamente.';
  END IF;
  SELECT coalesce(array_agg(r.id), '{}'::uuid[]) INTO skipped_ids FROM public.records r
  WHERE r.id = ANY(scope_ids) AND NOT coalesce(p_overwrite, false) AND EXISTS (
    SELECT 1 FROM public.records m WHERE m.module = 'full' AND m.id = ANY(scope_ids) AND nullif(btrim(m.manual_status), '') IS NOT NULL
      AND (m.id = r.id OR (
        nullif(regexp_replace(upper(r.order_id), '\s+', '', 'g'), '') IS NOT NULL
        AND regexp_replace(upper(m.order_id), '\s+', '', 'g') = regexp_replace(upper(r.order_id), '\s+', '', 'g')
        AND m.record_date IS NOT DISTINCT FROM r.record_date AND m.shift IS NOT DISTINCT FROM r.shift
        AND ((r.record_date IS NOT NULL AND r.shift IS NOT NULL AND btrim(r.shift) <> '') OR m.batch_id = r.batch_id)
      ))
  );
  WITH changed AS (
    UPDATE public.records SET manual_status = btrim(p_status), manual_status_by = auth.uid(), manual_status_at = now(), updated_at = now()
    WHERE module = 'full' AND id = ANY(scope_ids) AND NOT (id = ANY(skipped_ids)) RETURNING id
  ) SELECT coalesce(array_agg(id), '{}'::uuid[]) INTO updated_ids FROM changed;
  IF cardinality(updated_ids) + cardinality(skipped_ids) <> cardinality(scope_ids) THEN
    RAISE EXCEPTION 'Sem permissão para editar todos os vínculos; nenhuma alteração foi salva.';
  END IF;
  RETURN jsonb_build_object('updated_ids', updated_ids, 'skipped_ids', skipped_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.classify_full_selection(uuid[], uuid[], text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classify_full_selection(uuid[], uuid[], text, boolean) TO authenticated;