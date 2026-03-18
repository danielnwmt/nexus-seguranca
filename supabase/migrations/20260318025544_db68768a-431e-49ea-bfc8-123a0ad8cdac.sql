
UPDATE public.clients SET cameras_count = (
  SELECT COUNT(*) FROM public.cameras WHERE cameras.client_id = clients.id AND cameras.deleted_at IS NULL
);
