CREATE TABLE public.cloud_storages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'r2',
  bucket text,
  endpoint text,
  region text DEFAULT 'auto',
  access_key_id text,
  secret_access_key text,
  public_base_url text,
  base_path text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_storages TO authenticated;
GRANT ALL ON public.cloud_storages TO service_role;

ALTER TABLE public.cloud_storages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cloud storages"
ON public.cloud_storages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at_cloud_storages
BEFORE UPDATE ON public.cloud_storages
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cloud_storage_id uuid REFERENCES public.cloud_storages(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';