
-- Add stream_key (auto-generated UUID) to cameras
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS stream_key uuid NOT NULL DEFAULT gen_random_uuid();

-- Add unique constraint on stream_key
ALTER TABLE public.cameras ADD CONSTRAINT cameras_stream_key_unique UNIQUE (stream_key);

-- Add media_server_ip to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS media_server_ip text DEFAULT '';
