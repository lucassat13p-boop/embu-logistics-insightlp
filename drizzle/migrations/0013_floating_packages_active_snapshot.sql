ALTER TABLE public.records DROP CONSTRAINT records_module_check;
ALTER TABLE public.records ADD CONSTRAINT records_module_check CHECK (module IN ('full','avaria','desvios','motivos','auto_add','on_hold','lost_damaged','rotas','retidos_veiculos','erros_operacionais','pacotes_flutuantes'));
CREATE TABLE public.floating_active_snapshot (
 id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
 batch_id uuid NOT NULL REFERENCES public.import_batches(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE ON public.floating_active_snapshot TO authenticated;
GRANT ALL ON public.floating_active_snapshot TO service_role;
ALTER TABLE public.floating_active_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read floating snapshot" ON public.floating_active_snapshot FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert floating snapshot" ON public.floating_active_snapshot FOR INSERT TO authenticated WITH CHECK (updated_by = auth.uid());
CREATE POLICY "Authenticated update floating snapshot" ON public.floating_active_snapshot FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = auth.uid());
CREATE INDEX records_floating_batch_idx ON public.records (batch_id, record_date DESC NULLS LAST, id) WHERE module = 'pacotes_flutuantes';
CREATE OR REPLACE FUNCTION public.replace_floating_snapshot(p_rows jsonb, p_file_name text, p_sheet_name text, p_expected_batch uuid, p_headers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_current uuid; v_batch uuid := gen_random_uuid(); v_count integer; v_new integer; v_remain integer; v_leave integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'É necessário entrar no sistema.'; END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) = 0 THEN RAISE EXCEPTION 'Base vazia ou inválida. A lista anterior foi preservada.'; END IF;
 IF lower(regexp_replace(translate(trim(p_sheet_name),'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc'),'\s+',' ','g')) <> 'perdidos' THEN RAISE EXCEPTION 'A aba Perdidos é obrigatória.'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE nullif(trim(r->>'order_id'),'') IS NULL) THEN RAISE EXCEPTION 'Todas as linhas devem conter BR válido.'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) r GROUP BY upper(trim(r->>'order_id')) HAVING count(*) > 1) THEN RAISE EXCEPTION 'BRs repetidos: confirme a base sem correspondências ambíguas.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('floating_active_snapshot',0));
 SELECT batch_id INTO v_current FROM public.floating_active_snapshot WHERE id = true FOR UPDATE;
 IF v_current IS DISTINCT FROM p_expected_batch THEN RAISE EXCEPTION 'A base ativa mudou. Revise o resumo antes de confirmar novamente.'; END IF;
 SELECT count(*) INTO v_count FROM jsonb_array_elements(p_rows);
 SELECT count(*) INTO v_remain FROM jsonb_array_elements(p_rows) n WHERE EXISTS (SELECT 1 FROM public.records r WHERE r.module='pacotes_flutuantes' AND r.batch_id=v_current AND upper(trim(r.order_id))=upper(trim(n->>'order_id')));
 v_new := v_count - v_remain;
 SELECT count(*) INTO v_leave FROM public.records r WHERE r.module='pacotes_flutuantes' AND r.batch_id=v_current AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) n WHERE upper(trim(n->>'order_id'))=upper(trim(r.order_id)));
 INSERT INTO public.import_batches(id,module,file_name,file_type,sheet_name,user_id,total_rows,valid_rows,inserted_rows,updated_rows,status,headers,finished_at)
 VALUES(v_batch,'pacotes_flutuantes',p_file_name,'xlsx',p_sheet_name,auth.uid(),v_count,v_count,v_new,v_remain,'Concluído',p_headers,now());
 INSERT INTO public.records(module,batch_id,row_number,record_date,record_date_raw,order_id,aging,route,driver_id,driver_name,carrier_3pl,to_number,product,collaborator,quantity,shift,extra,raw,dedupe_key,created_by)
 SELECT 'pacotes_flutuantes',v_batch,(r->>'row_number')::integer,(r->>'record_date')::date,r->>'record_date_raw',r->>'order_id',r->>'aging',r->>'route',r->>'driver_id',r->>'driver_name',r->>'carrier_3pl',r->>'to_number',r->>'product',r->>'collaborator',(r->>'quantity')::numeric,r->>'shift',coalesce(r->'extra','{}'::jsonb),coalesce(r->'raw','{}'::jsonb),v_batch::text || ':' || upper(trim(r->>'order_id')),auth.uid()
 FROM jsonb_array_elements(p_rows) r;
 INSERT INTO public.floating_active_snapshot(id,batch_id,updated_by) VALUES(true,v_batch,auth.uid()) ON CONFLICT(id) DO UPDATE SET batch_id=excluded.batch_id, updated_by=excluded.updated_by,updated_at=now();
 RETURN jsonb_build_object('batchId',v_batch,'total',v_count,'new',v_new,'remain',v_remain,'leave',v_leave);
END $$;
REVOKE ALL ON FUNCTION public.replace_floating_snapshot(jsonb,text,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_floating_snapshot(jsonb,text,text,uuid,jsonb) TO authenticated;
COMMENT ON TABLE public.floating_active_snapshot IS 'Confirmed complete Perdidos snapshot. Previous batches remain technical history; active batch cannot be deleted.';