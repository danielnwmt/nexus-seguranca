
CREATE TABLE public.media_servers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Servidor MediaMTX',
  ip_address text NOT NULL DEFAULT '',
  instances integer NOT NULL DEFAULT 1,
  rtmp_base_port integer NOT NULL DEFAULT 1935,
  hls_base_port integer NOT NULL DEFAULT 8888,
  webrtc_base_port integer NOT NULL DEFAULT 8889,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.media_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can CRUD media_servers"
  ON public.media_servers
  FOR ALL
  USING (is_authenticated())
  WITH CHECK (is_authenticated());

-- Updated_at trigger
CREATE TRIGGER handle_media_servers_updated_at
  BEFORE UPDATE ON public.media_servers
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
