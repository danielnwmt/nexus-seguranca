
-- 1. Create ENUMs for camera protocol and general status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'camera_protocol') THEN
    CREATE TYPE public.camera_protocol AS ENUM ('RTSP', 'RTMP', 'HLS', 'WebRTC', 'ONVIF');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_status') THEN
    CREATE TYPE public.entity_status AS ENUM ('active', 'inactive', 'online', 'offline', 'recording', 'pending', 'completed', 'cancelled');
  END IF;
END $$;

-- 2. Convert cameras.protocol from text to enum
ALTER TABLE public.cameras 
  ALTER COLUMN protocol DROP DEFAULT,
  ALTER COLUMN protocol TYPE public.camera_protocol USING protocol::public.camera_protocol,
  ALTER COLUMN protocol SET DEFAULT 'RTSP'::public.camera_protocol;

-- 3. Convert cameras.status from text to enum  
ALTER TABLE public.cameras
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.entity_status USING status::public.entity_status,
  ALTER COLUMN status SET DEFAULT 'online'::public.entity_status;
