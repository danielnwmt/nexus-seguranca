CREATE TABLE public.whatsapp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid UNIQUE,
  owner_user_id uuid NOT NULL,
  gs_api_key text,
  gs_app text,
  gs_number text,
  bot_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_configs TO authenticated;
GRANT ALL ON public.whatsapp_configs TO service_role;
ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage own whatsapp config" ON public.whatsapp_configs
FOR ALL TO authenticated
USING (private.has_role(auth.uid(),'admin'::public.app_role) AND (owner_user_id = auth.uid() OR company_id IN (SELECT company_id FROM public.saas_company_users WHERE user_id = auth.uid())))
WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) AND (owner_user_id = auth.uid() OR company_id IN (SELECT company_id FROM public.saas_company_users WHERE user_id = auth.uid())));
NOTIFY pgrst, 'reload schema';