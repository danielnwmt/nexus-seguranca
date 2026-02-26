
-- Tabela de servidores de armazenamento
CREATE TABLE public.storage_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ip_address text NOT NULL DEFAULT '',
  storage_path text NOT NULL DEFAULT '',
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  max_storage_gb integer DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storage_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_crud" ON public.storage_servers
  FOR ALL USING (public.is_authenticated())
  WITH CHECK (public.is_authenticated());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.storage_servers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Adicionar coluna storage_server_id na tabela clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS storage_server_id uuid REFERENCES public.storage_servers(id) ON DELETE SET NULL DEFAULT NULL;
