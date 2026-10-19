CREATE TABLE public.operational_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('AM1','AM2','PM1')),
  avarias_saved integer NOT NULL DEFAULT 0 CHECK (avarias_saved >= 0),
  on_hold_treated integer NOT NULL DEFAULT 0 CHECK (on_hold_treated >= 0),
  notes text,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_email text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operational_treatments_date_shift_idx ON public.operational_treatments (operation_date, shift);
GRANT SELECT, INSERT, UPDATE ON public.operational_treatments TO authenticated;
GRANT ALL ON public.operational_treatments TO service_role;
ALTER TABLE public.operational_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read treatments" ON public.operational_treatments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert treatments" ON public.operational_treatments FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "auth update treatments" ON public.operational_treatments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.touch_operational_treatment() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); NEW.updated_by := auth.uid(); NEW.created_by := OLD.created_by; NEW.created_at := OLD.created_at; RETURN NEW; END $$;
CREATE TRIGGER operational_treatments_touch BEFORE UPDATE ON public.operational_treatments FOR EACH ROW EXECUTE FUNCTION public.touch_operational_treatment();