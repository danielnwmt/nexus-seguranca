-- Índices para performance com 20k+ câmeras e 10k+ clientes

-- Cameras
CREATE INDEX IF NOT EXISTS idx_cameras_client_id ON public.cameras (client_id);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON public.cameras (status);
CREATE INDEX IF NOT EXISTS idx_cameras_protocol ON public.cameras (protocol);
CREATE INDEX IF NOT EXISTS idx_cameras_name ON public.cameras (name);
CREATE INDEX IF NOT EXISTS idx_cameras_created_at ON public.cameras (created_at DESC);

-- Clients
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients (name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients (status);
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON public.clients (cpf);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients (email);
CREATE INDEX IF NOT EXISTS idx_clients_storage_server_id ON public.clients (storage_server_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients (created_at DESC);

-- Alarms
CREATE INDEX IF NOT EXISTS idx_alarms_camera_id ON public.alarms (camera_id);
CREATE INDEX IF NOT EXISTS idx_alarms_severity ON public.alarms (severity);
CREATE INDEX IF NOT EXISTS idx_alarms_acknowledged ON public.alarms (acknowledged);
CREATE INDEX IF NOT EXISTS idx_alarms_created_at ON public.alarms (created_at DESC);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices (due_date);

-- Guards
CREATE INDEX IF NOT EXISTS idx_guards_status ON public.guards (status);
CREATE INDEX IF NOT EXISTS idx_guards_name ON public.guards (name);

-- Service Orders
CREATE INDEX IF NOT EXISTS idx_service_orders_client_id ON public.service_orders (client_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_installer_id ON public.service_orders (installer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON public.service_orders (status);

-- Storage Servers
CREATE INDEX IF NOT EXISTS idx_storage_servers_status ON public.storage_servers (status);