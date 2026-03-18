
CREATE OR REPLACE FUNCTION public.update_client_cameras_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.clients SET cameras_count = (
      SELECT COUNT(*) FROM public.cameras WHERE client_id = NEW.client_id AND deleted_at IS NULL
    ) WHERE id = NEW.client_id;
  END IF;
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.client_id IS DISTINCT FROM NEW.client_id OR TG_OP = 'DELETE' THEN
      UPDATE public.clients SET cameras_count = (
        SELECT COUNT(*) FROM public.cameras WHERE client_id = OLD.client_id AND deleted_at IS NULL
      ) WHERE id = OLD.client_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate trigger to also fire on deleted_at changes
DROP TRIGGER IF EXISTS cameras_count_trigger ON public.cameras;
DROP TRIGGER IF EXISTS update_cameras_count ON public.cameras;
CREATE TRIGGER cameras_count_trigger
  AFTER INSERT OR UPDATE OF client_id, deleted_at OR DELETE ON public.cameras
  FOR EACH ROW EXECUTE FUNCTION public.update_client_cameras_count();
