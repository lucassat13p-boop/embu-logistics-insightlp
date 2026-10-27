-- Draft only: apply in a reviewed, isolated Supabase environment before production.
-- Staging writes are private and invisible to operational reports. The final RPC runs
-- in one PostgreSQL transaction: any SQL error rolls back the entire published batch.
CREATE TABLE IF NOT EXISTS public.import_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  module text NOT NULL CHECK (module IN ('full','avaria','desvios','motivos','auto_add','on_hold','lost_damaged','rotas','retidos_veiculos','erros_operacionais')),
  metadata jsonb NOT NULL,
  expected_parts integer NOT NULL CHECK (expected_parts BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.import_upload_parts (
  upload_id uuid NOT NULL REFERENCES public.import_uploads(id) ON DELETE CASCADE,
  part_index integer NOT NULL CHECK (part_index >= 0),
  rows jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rows) = 'array' AND jsonb_array_length(rows) <= 500),
  issues jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(issues) = 'array' AND jsonb_array_length(issues) <= 500),
  PRIMARY KEY (upload_id, part_index)
);
CREATE INDEX IF NOT EXISTS import_uploads_created_at_idx ON public.import_uploads(created_at);
GRANT SELECT, INSERT, DELETE ON public.import_uploads TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.import_upload_parts TO authenticated;
GRANT ALL ON public.import_uploads, public.import_upload_parts TO service_role;
ALTER TABLE public.import_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_upload_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "upload owner read" ON public.import_uploads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "upload owner insert" ON public.import_uploads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "upload owner delete" ON public.import_uploads FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "upload part owner read" ON public.import_upload_parts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));
CREATE POLICY "upload part owner insert" ON public.import_upload_parts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_uploads u WHERE u.id = upload_id AND u.user_id = auth.uid() AND part_index < u.expected_parts));
CREATE POLICY "upload part owner delete" ON public.import_upload_parts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.import_uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.finalize_staged_import(p_upload_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  u public.import_uploads%ROWTYPE;
  v_meta jsonb;
  v_strategy text;
  v_append boolean;
  v_valid integer;
  v_issues integer;
  v_existing integer;
  v_inserted integer;
  v_updated integer;
  v_affected integer;
  v_status text;
  v_duration integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão expirada. Entre novamente.'; END IF;
  SELECT * INTO u FROM public.import_uploads WHERE id = p_upload_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Envio não encontrado ou sem permissão.'; END IF;
  v_meta := u.metadata;
  v_strategy := v_meta->>'strategy';
  v_append := coalesce((v_meta->>'append_only')::boolean, false);
  IF v_strategy NOT IN ('ignore', 'update') THEN RAISE EXCEPTION 'Estratégia de duplicidade inválida.'; END IF;
  IF v_append AND u.module NOT IN ('retidos_veiculos') THEN RAISE EXCEPTION 'Modo append não autorizado para o módulo.'; END IF;
  IF (SELECT count(*) FROM public.import_upload_parts p WHERE p.upload_id = u.id) <> u.expected_parts
     OR EXISTS (SELECT 1 FROM generate_series(0,u.expected_parts - 1) n
                WHERE NOT EXISTS (SELECT 1 FROM public.import_upload_parts p WHERE p.upload_id = u.id AND p.part_index = n)) THEN
    RAISE EXCEPTION 'Upload incompleto. Nenhuma importação foi publicada.';
  END IF;
  SELECT coalesce(sum(jsonb_array_length(p.rows)),0), coalesce(sum(jsonb_array_length(p.issues)),0)
    INTO v_valid, v_issues FROM public.import_upload_parts p WHERE p.upload_id=u.id;
  IF v_valid <> (v_meta->>'valid_rows')::integer OR v_issues <> (v_meta->>'issues_total')::integer THEN
    RAISE EXCEPTION 'Contagem dos dados enviados não confere. Nenhuma importação foi publicada.';
  END IF;
  IF v_valid < 1 OR v_valid > 1000000 THEN RAISE EXCEPTION 'Quantidade de registros inválida.'; END IF;
  IF EXISTS (SELECT 1 FROM public.import_upload_parts p,
    LATERAL jsonb_populate_recordset(NULL::public.records, p.rows) r
    WHERE p.upload_id=u.id AND (r.dedupe_key IS NULL OR r.dedupe_key='' OR r.row_number IS NULL)) THEN
    RAISE EXCEPTION 'Há registros sem chave de deduplicação ou número da linha.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ops_import_' || u.module,0));
  SELECT count(*) INTO v_existing FROM public.records prior
   WHERE prior.module=u.module AND prior.dedupe_key IN (
     SELECT CASE WHEN v_append AND u.module <> 'retidos_veiculos'
       THEN u.id::text || ':' || r.row_number::text || ':' || r.dedupe_key
       ELSE r.dedupe_key END
     FROM public.import_upload_parts p, LATERAL jsonb_populate_recordset(NULL::public.records,p.rows) r
     WHERE p.upload_id=u.id
   );
  INSERT INTO public.import_batches (
    id,module,file_name,file_type,sheet_name,user_id,user_email,total_rows,valid_rows,error_rows,
    ignored_rows,duplicate_rows,status,duplicate_strategy,mapping,headers,selected_shifts,include_soc,soc_rows
  ) VALUES (
    u.id,u.module,v_meta->>'file_name',v_meta->>'file_type',v_meta->>'sheet_name',auth.uid(),
    auth.jwt()->>'email',coalesce((v_meta->>'total_rows')::integer,0),v_valid,
    coalesce((v_meta->>'error_rows')::integer,0),coalesce((v_meta->>'ignored_rows')::integer,0),
    coalesce((v_meta->>'duplicates_in_file')::integer,0)+v_existing,
    'Processando',v_strategy,v_meta->'mapping',v_meta->'headers',
    CASE WHEN jsonb_typeof(v_meta->'selected_shifts')='array'
      THEN ARRAY(SELECT jsonb_array_elements_text(v_meta->'selected_shifts')) ELSE NULL END,
    (v_meta->>'include_soc')::boolean,(v_meta->>'soc_rows')::integer
  );
  WITH written AS (
    INSERT INTO public.records (
      module,batch_id,row_number,created_by,record_date,record_date_raw,month,location,order_id,status,
      collaborator,product,shift,route,lh,reason,classification,quantity,extra,raw,
      tracking_number,product_code,treatment,delivery_attempts,aging,driver_name,driver_id,
      carrier_3pl,neighborhood,exception_order_id,follow_up_action,create_time,eha_inbound_time,resolve_time,
      to_number,sender_name,br_status,status_issue,dedupe_key,updated_at
    )
    SELECT u.module,u.id,r.row_number,auth.uid(),r.record_date,r.record_date_raw,r.month,r.location,
      r.order_id,r.status,r.collaborator,r.product,r.shift,r.route,r.lh,r.reason,r.classification,r.quantity,
      coalesce(r.extra,'{}'::jsonb),coalesce(r.raw,'{}'::jsonb),
      r.tracking_number,r.product_code,r.treatment,r.delivery_attempts,r.aging,r.driver_name,r.driver_id,
      r.carrier_3pl,r.neighborhood,r.exception_order_id,r.follow_up_action,r.create_time,r.eha_inbound_time,r.resolve_time,
      r.to_number,r.sender_name,r.br_status,r.status_issue,
      CASE WHEN v_append AND u.module <> 'retidos_veiculos'
        THEN u.id::text || ':' || r.row_number::text || ':' || r.dedupe_key
        ELSE r.dedupe_key END, now()
    FROM public.import_upload_parts p, LATERAL jsonb_populate_recordset(NULL::public.records,p.rows) r
    WHERE p.upload_id=u.id
    ON CONFLICT (module,dedupe_key) DO UPDATE SET
      batch_id=excluded.batch_id,row_number=excluded.row_number,created_by=excluded.created_by,
      record_date=excluded.record_date,record_date_raw=excluded.record_date_raw,
      month=excluded.month,location=excluded.location,order_id=excluded.order_id,status=excluded.status,
      collaborator=excluded.collaborator,product=excluded.product,shift=excluded.shift,
      route=excluded.route,lh=excluded.lh,reason=excluded.reason,classification=excluded.classification,
      quantity=excluded.quantity,extra=excluded.extra,raw=excluded.raw,tracking_number=excluded.tracking_number,
      product_code=excluded.product_code,treatment=excluded.treatment,delivery_attempts=excluded.delivery_attempts,
      aging=excluded.aging,driver_name=excluded.driver_name,driver_id=excluded.driver_id,
      carrier_3pl=excluded.carrier_3pl,neighborhood=excluded.neighborhood,
      exception_order_id=excluded.exception_order_id,follow_up_action=excluded.follow_up_action,
      create_time=excluded.create_time,eha_inbound_time=excluded.eha_inbound_time,resolve_time=excluded.resolve_time,
      to_number=excluded.to_number,sender_name=excluded.sender_name,br_status=excluded.br_status,
      status_issue=excluded.status_issue,updated_at=now()
    WHERE v_strategy='update' AND u.module <> 'retidos_veiculos'
    RETURNING (xmax=0) AS was_inserted
  )
  SELECT count(*) FILTER (WHERE was_inserted), count(*) FILTER (WHERE NOT was_inserted)
    INTO v_inserted,v_updated FROM written;
  v_inserted := coalesce(v_inserted,0); v_updated := coalesce(v_updated,0);
  IF v_inserted + v_updated + CASE WHEN v_strategy='ignore' OR u.module='retidos_veiculos' THEN v_existing ELSE 0 END <> v_valid THEN
    RAISE EXCEPTION 'A conciliação da importação falhou. Nenhum registro foi publicado.';
  END IF;
  INSERT INTO public.import_errors(batch_id,module,row_number,column_name,kind,message,raw)
  SELECT u.id,u.module,(item.value->>'row_number')::integer,item.value->>'column_name',
    coalesce(item.value->>'kind','erro'),item.value->>'message',item.value->'raw'
  FROM public.import_upload_parts p CROSS JOIN LATERAL jsonb_array_elements(p.issues) item
  WHERE p.upload_id=u.id;
  INSERT INTO public.collaborators(name,first_seen_batch)
  SELECT DISTINCT btrim(r.collaborator),u.id FROM public.import_upload_parts p,
    LATERAL jsonb_populate_recordset(NULL::public.records,p.rows) r
  WHERE p.upload_id=u.id AND nullif(btrim(r.collaborator),'') IS NOT NULL
  ON CONFLICT (name) DO NOTHING;
  v_status := CASE
    WHEN coalesce((v_meta->>'error_rows')::integer,0)>0 OR
         coalesce((v_meta->>'duplicates_in_file')::integer,0)>0 OR v_existing>0 OR
         coalesce((v_meta->>'pending_rows')::integer,0)>0
    THEN 'Concluído com avisos' ELSE 'Concluído' END;
  v_duration := greatest(0,least(2147483647,coalesce((v_meta->>'duration_ms')::integer,0)));
  UPDATE public.import_batches
    SET status=v_status,finished_at=now(),duration_ms=v_duration,inserted_rows=v_inserted,updated_rows=v_updated
    WHERE id=u.id;
  DELETE FROM public.import_uploads WHERE id=u.id AND user_id=auth.uid();
  RETURN jsonb_build_object('batchId',u.id,'inserted',v_inserted,'existing',v_existing,'updated',v_updated,'status',v_status);
END $$;
REVOKE ALL ON FUNCTION public.finalize_staged_import(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_staged_import(uuid) TO authenticated;
COMMENT ON FUNCTION public.finalize_staged_import(uuid)
IS 'Publishes one complete staged operational import as a single transaction; preserves FULL manual classifications and existing module-specific dedupe.';
