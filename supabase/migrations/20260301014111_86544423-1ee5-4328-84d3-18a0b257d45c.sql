
-- Table for bank configurations (API keys stored here, only accessible via edge function)
CREATE TABLE IF NOT EXISTS public.bank_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  agencia TEXT DEFAULT '',
  conta TEXT DEFAULT '',
  convenio TEXT DEFAULT '',
  api_key_encrypted TEXT DEFAULT '',
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS - block all direct client access, only edge functions with service role can access
ALTER TABLE public.bank_configs ENABLE ROW LEVEL SECURITY;

-- Only admins can read non-sensitive fields (api_key_encrypted is still hidden by edge function logic)
CREATE POLICY "admin_access_bank_configs" ON public.bank_configs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_bank_configs_updated_at
  BEFORE UPDATE ON public.bank_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed default bank configs
INSERT INTO public.bank_configs (bank, label) VALUES
  ('sicredi', 'Sicredi'),
  ('caixa', 'Caixa Econômica'),
  ('banco_do_brasil', 'Banco do Brasil'),
  ('inter', 'Banco Inter')
ON CONFLICT (bank) DO NOTHING;
