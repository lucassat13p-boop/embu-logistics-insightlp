ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS to_number text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS br_status text,
  ADD COLUMN IF NOT EXISTS status_issue text,
  ADD COLUMN IF NOT EXISTS manual_status text,
  ADD COLUMN IF NOT EXISTS manual_status_by uuid,
  ADD COLUMN IF NOT EXISTS manual_status_at timestamptz;