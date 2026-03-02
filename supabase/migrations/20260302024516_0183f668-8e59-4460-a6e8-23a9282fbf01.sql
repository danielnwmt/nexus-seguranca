
-- =====================================================
-- FIX: Convert ALL restrictive RLS policies to permissive
-- with proper TO authenticated clauses
-- =====================================================

-- ---- ALARMS ----
DROP POLICY IF EXISTS "Admins full access to alarms" ON public.alarms;
DROP POLICY IF EXISTS "N1 can read alarms" ON public.alarms;
DROP POLICY IF EXISTS "Operators can manage alarms" ON public.alarms;

CREATE POLICY "Admins full access to alarms" ON public.alarms
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "N1 can read alarms" ON public.alarms
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n1'::app_role));

CREATE POLICY "Operators can manage alarms" ON public.alarms
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role))
  WITH CHECK (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- ANALYTICS_EVENTS ----
DROP POLICY IF EXISTS "Admins full access to analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "N1 can read analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "Operators can manage analytics_events" ON public.analytics_events;

CREATE POLICY "Admins full access to analytics_events" ON public.analytics_events
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "N1 can read analytics_events" ON public.analytics_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n1'::app_role));

CREATE POLICY "Operators can manage analytics_events" ON public.analytics_events
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role))
  WITH CHECK (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- AUTH_RATE_LIMITS ----
DROP POLICY IF EXISTS "No direct access to rate limits" ON public.auth_rate_limits;

CREATE POLICY "No direct access to rate limits" ON public.auth_rate_limits
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---- BANK_CONFIGS ----
DROP POLICY IF EXISTS "Admins full access to bank_configs" ON public.bank_configs;

CREATE POLICY "Admins full access to bank_configs" ON public.bank_configs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- BANK_CONFIGS_AUDIT ----
DROP POLICY IF EXISTS "Admins can read bank audit logs" ON public.bank_configs_audit;
DROP POLICY IF EXISTS "No direct insert to audit" ON public.bank_configs_audit;

CREATE POLICY "Admins can read bank audit logs" ON public.bank_configs_audit
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "No direct insert to audit" ON public.bank_configs_audit
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- ---- BILLS ----
DROP POLICY IF EXISTS "Admins full access to bills" ON public.bills;
DROP POLICY IF EXISTS "Operators can read bills" ON public.bills;

CREATE POLICY "Admins full access to bills" ON public.bills
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can read bills" ON public.bills
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- CAMERAS ----
DROP POLICY IF EXISTS "Admins full access to cameras" ON public.cameras;
DROP POLICY IF EXISTS "N1 can read cameras" ON public.cameras;
DROP POLICY IF EXISTS "Operators can manage cameras" ON public.cameras;

CREATE POLICY "Admins full access to cameras" ON public.cameras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "N1 can read cameras" ON public.cameras
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n1'::app_role));

CREATE POLICY "Operators can manage cameras" ON public.cameras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role))
  WITH CHECK (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- CLIENTS ----
DROP POLICY IF EXISTS "Admins full access to clients" ON public.clients;
DROP POLICY IF EXISTS "N1 can read clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can read clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can update clients" ON public.clients;

CREATE POLICY "Admins full access to clients" ON public.clients
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "N1 can read clients" ON public.clients
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n1'::app_role));

CREATE POLICY "Operators can read clients" ON public.clients
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

CREATE POLICY "Operators can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role))
  WITH CHECK (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- COMPANY_SETTINGS ----
DROP POLICY IF EXISTS "All authenticated can read company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Only admins can delete company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Only admins can insert company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Only admins can modify company_settings" ON public.company_settings;

CREATE POLICY "All authenticated can read company_settings" ON public.company_settings
  FOR SELECT TO authenticated
  USING (is_authenticated());

CREATE POLICY "Only admins can delete company_settings" ON public.company_settings
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert company_settings" ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can modify company_settings" ON public.company_settings
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ---- GUARDS ----
DROP POLICY IF EXISTS "Admins full access to guards" ON public.guards;
DROP POLICY IF EXISTS "Operators can read guards" ON public.guards;

CREATE POLICY "Admins full access to guards" ON public.guards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can read guards" ON public.guards
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- INSTALLERS ----
DROP POLICY IF EXISTS "Admins full access to installers" ON public.installers;
DROP POLICY IF EXISTS "Operators can read installers" ON public.installers;

CREATE POLICY "Admins full access to installers" ON public.installers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can read installers" ON public.installers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- INVOICES ----
DROP POLICY IF EXISTS "Admins full access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Operators can read invoices" ON public.invoices;

CREATE POLICY "Admins full access to invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can read invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- MEDIA_SERVERS ----
DROP POLICY IF EXISTS "Admins full access to media_servers" ON public.media_servers;
DROP POLICY IF EXISTS "Operators can read media_servers" ON public.media_servers;

CREATE POLICY "Admins full access to media_servers" ON public.media_servers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can read media_servers" ON public.media_servers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n1'::app_role) OR has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- PATROL_ROUTES ----
DROP POLICY IF EXISTS "Admins full access to patrol_routes" ON public.patrol_routes;
DROP POLICY IF EXISTS "N1 can read patrol_routes" ON public.patrol_routes;
DROP POLICY IF EXISTS "Operators can manage patrol_routes" ON public.patrol_routes;

CREATE POLICY "Admins full access to patrol_routes" ON public.patrol_routes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "N1 can read patrol_routes" ON public.patrol_routes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n1'::app_role));

CREATE POLICY "Operators can manage patrol_routes" ON public.patrol_routes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role))
  WITH CHECK (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- RECORDINGS ----
DROP POLICY IF EXISTS "Admins full access to recordings" ON public.recordings;
DROP POLICY IF EXISTS "N1 can read recordings" ON public.recordings;
DROP POLICY IF EXISTS "Operators can read recordings" ON public.recordings;

CREATE POLICY "Admins full access to recordings" ON public.recordings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "N1 can read recordings" ON public.recordings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n1'::app_role));

CREATE POLICY "Operators can read recordings" ON public.recordings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- SERVICE_ORDERS ----
DROP POLICY IF EXISTS "Admins full access to service_orders" ON public.service_orders;
DROP POLICY IF EXISTS "N1 can read service_orders" ON public.service_orders;
DROP POLICY IF EXISTS "Operators can manage service_orders" ON public.service_orders;

CREATE POLICY "Admins full access to service_orders" ON public.service_orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "N1 can read service_orders" ON public.service_orders
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n1'::app_role));

CREATE POLICY "Operators can manage service_orders" ON public.service_orders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role))
  WITH CHECK (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- STORAGE_SERVERS ----
DROP POLICY IF EXISTS "Admins full access to storage_servers" ON public.storage_servers;
DROP POLICY IF EXISTS "Operators can read storage_servers" ON public.storage_servers;

CREATE POLICY "Admins full access to storage_servers" ON public.storage_servers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can read storage_servers" ON public.storage_servers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'n2'::app_role) OR has_role(auth.uid(), 'n3'::app_role));

-- ---- USER_ROLES ----
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
