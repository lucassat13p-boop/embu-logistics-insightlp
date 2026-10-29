ALTER TABLE public.records DROP CONSTRAINT records_module_check;
ALTER TABLE public.records ADD CONSTRAINT records_module_check CHECK (module IN ('full','avaria','desvios','motivos','auto_add','on_hold','lost_damaged','rotas','retidos_veiculos','erros_operacionais','pacotes_flutuantes','conferencia'));
CREATE OR REPLACE FUNCTION public.import_conferencia(p_rows jsonb, p_file_name text, p_headers jsonb, p_ignored integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_batch uuid; v_new integer := 0; v_updated integer := 0; v_same integer := 0; v_row jsonb; v_existing public.records%ROWTYPE; v_count integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre novamente para importar.'; END IF;
 IF pg_catalog.jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR pg_catalog.jsonb_array_length(p_rows) = 0 THEN RAISE EXCEPTION 'Nenhuma conferência válida no arquivo.'; END IF;
 IF p_ignored < 0 THEN RAISE EXCEPTION 'Contagem inválida.'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_rows) r WHERE nullif(btrim(r->>'route'),'') IS NULL OR nullif(btrim(r->>'dedupe_key'),'') IS NULL OR coalesce((r->>'row_number')::integer,0) < 1) THEN RAISE EXCEPTION 'Identificação da conferência inválida.'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_rows) r GROUP BY r->>'dedupe_key' HAVING count(*) > 1) THEN RAISE EXCEPTION 'Conferências repetidas no envio.'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('conferencia_import',0));
 v_count := pg_catalog.jsonb_array_length(p_rows);
 INSERT INTO public.import_batches(module,file_name,file_type,sheet_name,user_id,user_email,total_rows,valid_rows,ignored_rows,status,duplicate_strategy,headers)
 VALUES('conferencia',p_file_name,'csv','Auditoria de rotas',auth.uid(),auth.jwt()->>'email',v_count+p_ignored,v_count,p_ignored,'Processando','update',p_headers) RETURNING id INTO v_batch;
 FOR v_row IN SELECT value FROM pg_catalog.jsonb_array_elements(p_rows) LOOP
  SELECT * INTO v_existing FROM public.records WHERE module='conferencia' AND dedupe_key=v_row->>'dedupe_key' FOR UPDATE;
  IF FOUND THEN
   IF v_existing.raw = coalesce(v_row->'raw','{}'::jsonb) THEN v_same := v_same + 1; CONTINUE; END IF;
   UPDATE public.records SET batch_id=v_batch,row_number=(v_row->>'row_number')::integer,record_date=nullif(v_row->>'record_date','')::date,record_date_raw=v_row->>'record_date_raw',route=v_row->>'route',location=v_row->>'location',collaborator=v_row->>'collaborator',shift=v_row->>'shift',create_time=v_row->>'create_time',resolve_time=v_row->>'resolve_time',status=v_row->>'status',extra=coalesce(v_row->'extra','{}'::jsonb),raw=coalesce(v_row->'raw','{}'::jsonb),updated_at=now() WHERE id=v_existing.id AND module='conferencia';
   v_updated := v_updated + 1;
  ELSE
   INSERT INTO public.records(module,batch_id,row_number,record_date,record_date_raw,route,location,collaborator,shift,create_time,resolve_time,status,extra,raw,dedupe_key,created_by)
   VALUES('conferencia',v_batch,(v_row->>'row_number')::integer,nullif(v_row->>'record_date','')::date,v_row->>'record_date_raw',v_row->>'route',v_row->>'location',v_row->>'collaborator',v_row->>'shift',v_row->>'create_time',v_row->>'resolve_time',v_row->>'status',coalesce(v_row->'extra','{}'::jsonb),coalesce(v_row->'raw','{}'::jsonb),v_row->>'dedupe_key',auth.uid());
   v_new := v_new + 1;
  END IF;
 END LOOP;
 UPDATE public.import_batches SET inserted_rows=v_new,updated_rows=v_updated,ignored_rows=p_ignored+v_same,duplicate_rows=v_same,status='Concluído',finished_at=now() WHERE id=v_batch;
 RETURN pg_catalog.jsonb_build_object('batchId',v_batch,'inserted',v_new,'updated',v_updated,'ignored',p_ignored+v_same);
END;
$$;
REVOKE ALL ON FUNCTION public.import_conferencia(jsonb,text,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_conferencia(jsonb,text,jsonb,integer) TO authenticated;
COMMENT ON FUNCTION public.import_conferencia(jsonb,text,jsonb,integer) IS 'Atomic RLS-enforced CSV audit import, isolated by module and stable route/start identity; identical source rows are ignored and previous dates retained.';