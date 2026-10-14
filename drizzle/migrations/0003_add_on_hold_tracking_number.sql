ALTER TABLE public.records ADD COLUMN tracking_number text;
CREATE INDEX records_on_hold_tracking_number_idx ON public.records (tracking_number) WHERE module = 'on_hold';