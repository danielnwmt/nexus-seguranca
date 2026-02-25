export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  camerasCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Camera {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  streamUrl: string;
  protocol: 'RTMP' | 'RTSP';
  status: 'online' | 'offline' | 'recording';
  location: string;
  resolution: string;
}

export interface Alarm {
  id: string;
  cameraId: string;
  cameraName: string;
  clientName: string;
  type: 'motion' | 'connection_lost' | 'tampering' | 'intrusion';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}
