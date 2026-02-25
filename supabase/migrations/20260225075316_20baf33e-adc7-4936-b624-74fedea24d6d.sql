
-- Create company_settings table
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Bravo Monitoramento',
  cnpj TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.company_settings (name) VALUES ('Bravo Monitoramento');

-- Allow public read/write for now (single-tenant system)
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to company_settings" ON public.company_settings FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for client camera images
INSERT INTO storage.buckets (id, name, public) VALUES ('client-cameras', 'client-cameras', true);

-- Storage policy: allow all uploads/reads (single-tenant)
CREATE POLICY "Allow all access to client-cameras" ON storage.objects FOR ALL USING (bucket_id = 'client-cameras') WITH CHECK (bucket_id = 'client-cameras');
