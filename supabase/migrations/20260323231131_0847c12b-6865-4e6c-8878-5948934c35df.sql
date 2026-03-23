
CREATE OR REPLACE FUNCTION public.notify_camera_offline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _client_name text;
BEGIN
  IF NEW.status = 'offline' AND (OLD.status IS DISTINCT FROM 'offline') THEN
    SELECT name INTO _client_name FROM public.clients WHERE id = NEW.client_id;

    INSERT INTO public.alarms (camera_id, camera_name, client_name, type, severity, message)
    VALUES (
      NEW.id,
      NEW.name,
      _client_name,
      'connection_lost',
      'critical',
      'Câmera "' || NEW.name || '" ficou offline e não está recebendo imagem.'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_camera_offline_alarm ON public.cameras;
CREATE TRIGGER trg_camera_offline_alarm
  AFTER UPDATE ON public.cameras
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_camera_offline();
