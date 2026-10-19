CREATE TABLE public.on_hold_treated_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('AM1','AM2','PM1')),
  quantity integer NOT NULL CHECK (quantity >= 0),
  rows_analyzed integer NOT NULL DEFAULT 0,
  sheet_name text NOT NULL,
  file_name text,
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'Pacotes Tratados / Não MEXER',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_date, shift)
);
GRANT SELECT, INSERT, UPDATE ON public.on_hold_treated_imports TO authenticated;
GRANT ALL ON public.on_hold_treated_imports TO service_role;
ALTER TABLE public.on_hold_treated_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read treated imports" ON public.on_hold_treated_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert treated imports" ON public.on_hold_treated_imports FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Authenticated update treated imports" ON public.on_hold_treated_imports FOR UPDATE TO authenticated USING (true) WITH CHECK (created_by = auth.uid());