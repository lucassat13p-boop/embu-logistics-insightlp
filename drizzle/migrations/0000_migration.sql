CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  sheet_name text,
  user_id uuid,
  user_email text,
  total_rows int NOT NULL DEFAULT 0,
  valid_rows int NOT NULL DEFAULT 0,
  error_rows int NOT NULL DEFAULT 0,
  ignored_rows int NOT NULL DEFAULT 0,
  duplicate_rows int NOT NULL DEFAULT 0,
  inserted_rows int NOT NULL DEFAULT 0,
  updated_rows int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Processando',
  duration_ms int,
  duplicate_strategy text,
  mapping jsonb,
  headers jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read batches" ON public.import_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert batches" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner update batches" ON public.import_batches FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  module text NOT NULL,
  row_number int,
  column_name text,
  kind text NOT NULL DEFAULT 'erro',
  message text NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.import_errors(batch_id);
GRANT SELECT, INSERT ON public.import_errors TO authenticated;
GRANT ALL ON public.import_errors TO service_role;
ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read errors" ON public.import_errors FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert errors" ON public.import_errors FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = batch_id AND b.user_id = auth.uid()));

-- One table per module family is represented by a strict module discriminator; records never cross modules.
CREATE TABLE public.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL CHECK (module IN ('full','avaria','desvios','motivos','auto_add','on_hold','lost_damaged','rotas')),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id),
  row_number int,
  record_date date,
  record_date_raw text,
  order_id text,
  status text,
  collaborator text,
  product text,
  shift text,
  route text,
  lh text,
  reason text,
  classification text,
  quantity numeric,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, dedupe_key)
);
CREATE INDEX ON public.records(module, record_date);
CREATE INDEX ON public.records(order_id);
CREATE INDEX ON public.records(batch_id);
GRANT SELECT, INSERT, UPDATE ON public.records TO authenticated;
GRANT ALL ON public.records TO service_role;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read records" ON public.records FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert records" ON public.records FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "auth update records" ON public.records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.column_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  name text NOT NULL,
  header_signature text NOT NULL,
  mapping jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, header_signature)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.column_mappings TO authenticated;
GRANT ALL ON public.column_mappings TO service_role;
ALTER TABLE public.column_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read maps" ON public.column_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert maps" ON public.column_mappings FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "auth update maps" ON public.column_mappings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete maps" ON public.column_mappings FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE TABLE public.collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  first_seen_batch uuid REFERENCES public.import_batches(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.collaborators TO authenticated;
GRANT ALL ON public.collaborators TO service_role;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read collab" ON public.collaborators FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert collab" ON public.collaborators FOR INSERT TO authenticated WITH CHECK (true);