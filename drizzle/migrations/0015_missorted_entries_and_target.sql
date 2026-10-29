CREATE TABLE public.missorted_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 operation_date date NOT NULL,
 shift text NOT NULL CHECK (shift IN ('AM1','AM2','PM1')),
 incorrect_packages integer NOT NULL CHECK (incorrect_packages >= 0),
 processed_packages integer NOT NULL CHECK (processed_packages >= 0 AND incorrect_packages <= processed_packages),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(operation_date, shift)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missorted_entries TO authenticated;
GRANT ALL ON public.missorted_entries TO service_role;
ALTER TABLE public.missorted_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read missorted" ON public.missorted_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert missorted" ON public.missorted_entries FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Authenticated update missorted" ON public.missorted_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner delete missorted" ON public.missorted_entries FOR DELETE TO authenticated USING (created_by = auth.uid());
CREATE INDEX missorted_entries_date_idx ON public.missorted_entries(operation_date DESC, shift);
CREATE TABLE public.missorted_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 target_percent numeric NOT NULL DEFAULT 0.68 CHECK (target_percent >= 0 AND target_percent <= 100),
 updated_by uuid NOT NULL DEFAULT auth.uid(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.missorted_settings TO authenticated;
GRANT ALL ON public.missorted_settings TO service_role;
ALTER TABLE public.missorted_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read missorted target" ON public.missorted_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert missorted target" ON public.missorted_settings FOR INSERT TO authenticated WITH CHECK (updated_by = auth.uid());
CREATE POLICY "Authenticated update missorted target" ON public.missorted_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (updated_by = auth.uid());
CREATE FUNCTION public.touch_missorted_entry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 NEW.created_by := OLD.created_by;
 NEW.created_at := OLD.created_at;
 NEW.updated_at := now();
 RETURN NEW;
END;
$$;
CREATE TRIGGER touch_missorted_entry BEFORE UPDATE ON public.missorted_entries FOR EACH ROW EXECUTE FUNCTION public.touch_missorted_entry();