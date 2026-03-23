
-- Tabela de vendedores
CREATE TABLE public.sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  phone text,
  email text,
  commission_percent numeric NOT NULL DEFAULT 10,
  referral_code text NOT NULL DEFAULT substr(gen_random_uuid()::text, 1, 8),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sellers_referral_code_unique UNIQUE (referral_code)
);

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to sellers" ON public.sellers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can read sellers" ON public.sellers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- Adicionar seller_id na tabela clients
ALTER TABLE public.clients ADD COLUMN seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL;

-- Trigger updated_at
CREATE TRIGGER set_sellers_updated_at BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
