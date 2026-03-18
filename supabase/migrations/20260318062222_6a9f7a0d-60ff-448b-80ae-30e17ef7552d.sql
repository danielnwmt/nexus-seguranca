ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS recording_segment_minutes INTEGER NOT NULL DEFAULT 30;
NOTIFY pgrst, 'reload schema';