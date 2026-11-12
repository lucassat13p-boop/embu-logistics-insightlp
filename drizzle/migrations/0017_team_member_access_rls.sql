DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','member'))
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated, service_role;

-- Preserve access for every account that already uses the HUB
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'member'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- collaborators
DROP POLICY IF EXISTS "auth read collab" ON public.collaborators;
DROP POLICY IF EXISTS "auth insert collab" ON public.collaborators;
CREATE POLICY "team read collab" ON public.collaborators FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "team insert collab" ON public.collaborators FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()));

-- column_mappings
DROP POLICY IF EXISTS "auth read maps" ON public.column_mappings;
DROP POLICY IF EXISTS "auth update maps" ON public.column_mappings;
DROP POLICY IF EXISTS "auth insert maps" ON public.column_mappings;
DROP POLICY IF EXISTS "auth delete maps" ON public.column_mappings;
CREATE POLICY "team read maps" ON public.column_mappings FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "team insert maps" ON public.column_mappings FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "team update maps" ON public.column_mappings FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "owner delete maps" ON public.column_mappings FOR DELETE TO authenticated USING (public.is_team_member(auth.uid()) AND created_by = auth.uid());

-- floating_active_snapshot
DROP POLICY IF EXISTS "Authenticated read floating snapshot" ON public.floating_active_snapshot;
DROP POLICY IF EXISTS "Authenticated update floating snapshot" ON public.floating_active_snapshot;
DROP POLICY IF EXISTS "Authenticated insert floating snapshot" ON public.floating_active_snapshot;
CREATE POLICY "Team read floating snapshot" ON public.floating_active_snapshot FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team insert floating snapshot" ON public.floating_active_snapshot FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()) AND updated_by = auth.uid());
CREATE POLICY "Team update floating snapshot" ON public.floating_active_snapshot FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()) AND updated_by = auth.uid());

-- import_batches
DROP POLICY IF EXISTS "auth read batches" ON public.import_batches;
DROP POLICY IF EXISTS "auth insert batches" ON public.import_batches;
DROP POLICY IF EXISTS "owner update batches" ON public.import_batches;
CREATE POLICY "team read batches" ON public.import_batches FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "team insert batches" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "owner update batches" ON public.import_batches FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid()) AND user_id = auth.uid()) WITH CHECK (public.is_team_member(auth.uid()) AND user_id = auth.uid());

-- import_errors
DROP POLICY IF EXISTS "auth read errors" ON public.import_errors;
DROP POLICY IF EXISTS "auth insert errors" ON public.import_errors;
CREATE POLICY "team read errors" ON public.import_errors FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "team insert errors" ON public.import_errors FOR INSERT TO authenticated WITH CHECK (
  public.is_team_member(auth.uid()) AND EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id = import_errors.batch_id AND b.user_id = auth.uid())
);

-- missorted_entries
DROP POLICY IF EXISTS "Authenticated read missorted" ON public.missorted_entries;
DROP POLICY IF EXISTS "Authenticated update missorted" ON public.missorted_entries;
DROP POLICY IF EXISTS "Authenticated insert missorted" ON public.missorted_entries;
DROP POLICY IF EXISTS "Owner delete missorted" ON public.missorted_entries;
CREATE POLICY "Team read missorted" ON public.missorted_entries FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team insert missorted" ON public.missorted_entries FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Team update missorted" ON public.missorted_entries FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
CREATE POLICY "Owner delete missorted" ON public.missorted_entries FOR DELETE TO authenticated USING (public.is_team_member(auth.uid()) AND created_by = auth.uid());

-- missorted_settings
DROP POLICY IF EXISTS "Authenticated read missorted target" ON public.missorted_settings;
DROP POLICY IF EXISTS "Authenticated update missorted target" ON public.missorted_settings;
DROP POLICY IF EXISTS "Authenticated insert missorted target" ON public.missorted_settings;
CREATE POLICY "Team read missorted target" ON public.missorted_settings FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team insert missorted target" ON public.missorted_settings FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()) AND updated_by = auth.uid());
CREATE POLICY "Team update missorted target" ON public.missorted_settings FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()) AND updated_by = auth.uid());

-- on_hold_treated_imports
DROP POLICY IF EXISTS "Authenticated read treated imports" ON public.on_hold_treated_imports;
DROP POLICY IF EXISTS "Authenticated update treated imports" ON public.on_hold_treated_imports;
DROP POLICY IF EXISTS "Authenticated insert treated imports" ON public.on_hold_treated_imports;
CREATE POLICY "Team read treated imports" ON public.on_hold_treated_imports FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "Team insert treated imports" ON public.on_hold_treated_imports FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Team update treated imports" ON public.on_hold_treated_imports FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()) AND created_by = auth.uid());

-- operational_treatments
DROP POLICY IF EXISTS "auth read treatments" ON public.operational_treatments;
DROP POLICY IF EXISTS "auth update treatments" ON public.operational_treatments;
DROP POLICY IF EXISTS "auth insert treatments" ON public.operational_treatments;
CREATE POLICY "team read treatments" ON public.operational_treatments FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "team insert treatments" ON public.operational_treatments FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "team update treatments" ON public.operational_treatments FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));

-- records
DROP POLICY IF EXISTS "auth read records" ON public.records;
DROP POLICY IF EXISTS "auth update records" ON public.records;
DROP POLICY IF EXISTS "auth insert records" ON public.records;
CREATE POLICY "team read records" ON public.records FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()));
CREATE POLICY "team insert records" ON public.records FOR INSERT TO authenticated WITH CHECK (public.is_team_member(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "team update records" ON public.records FOR UPDATE TO authenticated USING (public.is_team_member(auth.uid())) WITH CHECK (public.is_team_member(auth.uid()));
