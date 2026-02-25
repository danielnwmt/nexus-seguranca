import { Client, Camera, Alarm } from '@/types/monitoring';

export const mockClients: Client[] = [
  { id: '1', name: 'Condomínio Aurora', email: 'admin@aurora.com', phone: '(11) 3456-7890', address: 'Rua das Flores, 123 - SP', camerasCount: 8, status: 'active', createdAt: '2024-01-15' },
  { id: '2', name: 'Shopping Centro', email: 'seg@shopcentro.com', phone: '(11) 2345-6789', address: 'Av. Brasil, 456 - SP', camerasCount: 24, status: 'active', createdAt: '2024-02-20' },
  { id: '3', name: 'Indústria MetalTech', email: 'ti@metaltech.com', phone: '(11) 4567-8901', address: 'Rod. Anchieta, 789 - SP', camerasCount: 16, status: 'active', createdAt: '2024-03-10' },
  { id: '4', name: 'Escola Futuro', email: 'dir@futuro.edu.br', phone: '(11) 5678-9012', address: 'Rua do Saber, 321 - SP', camerasCount: 12, status: 'inactive', createdAt: '2024-04-05' },
];

export const mockCameras: Camera[] = [
  { id: '1', name: 'CAM-01 Entrada Principal', clientId: '1', clientName: 'Condomínio Aurora', streamUrl: 'rtsp://192.168.1.100:554/stream1', protocol: 'RTSP', status: 'online', location: 'Portaria', resolution: '1920x1080' },
  { id: '2', name: 'CAM-02 Estacionamento', clientId: '1', clientName: 'Condomínio Aurora', streamUrl: 'rtsp://192.168.1.101:554/stream1', protocol: 'RTSP', status: 'recording', location: 'Garagem', resolution: '1920x1080' },
  { id: '3', name: 'CAM-03 Piscina', clientId: '1', clientName: 'Condomínio Aurora', streamUrl: 'rtmp://192.168.1.102/live/cam3', protocol: 'RTMP', status: 'online', location: 'Área de Lazer', resolution: '1280x720' },
  { id: '4', name: 'CAM-04 Corredor Loja A', clientId: '2', clientName: 'Shopping Centro', streamUrl: 'rtsp://10.0.1.50:554/stream1', protocol: 'RTSP', status: 'online', location: 'Piso 1', resolution: '1920x1080' },
  { id: '5', name: 'CAM-05 Praça Alimentação', clientId: '2', clientName: 'Shopping Centro', streamUrl: 'rtsp://10.0.1.51:554/stream1', protocol: 'RTSP', status: 'offline', location: 'Piso 2', resolution: '1920x1080' },
  { id: '6', name: 'CAM-06 Depósito', clientId: '3', clientName: 'Indústria MetalTech', streamUrl: 'rtmp://172.16.0.10/live/cam6', protocol: 'RTMP', status: 'recording', location: 'Galpão A', resolution: '2560x1440' },
  { id: '7', name: 'CAM-07 Linha de Produção', clientId: '3', clientName: 'Indústria MetalTech', streamUrl: 'rtsp://172.16.0.11:554/stream1', protocol: 'RTSP', status: 'online', location: 'Galpão B', resolution: '1920x1080' },
  { id: '8', name: 'CAM-08 Pátio Escola', clientId: '4', clientName: 'Escola Futuro', streamUrl: 'rtsp://192.168.2.10:554/stream1', protocol: 'RTSP', status: 'offline', location: 'Pátio', resolution: '1280x720' },
  { id: '9', name: 'CAM-09 Hall Entrada', clientId: '4', clientName: 'Escola Futuro', streamUrl: 'rtmp://192.168.2.11/live/cam9', protocol: 'RTMP', status: 'offline', location: 'Entrada', resolution: '1920x1080' },
];

export const mockAlarms: Alarm[] = [
  { id: '1', cameraId: '5', cameraName: 'CAM-05 Praça Alimentação', clientName: 'Shopping Centro', type: 'connection_lost', severity: 'critical', message: 'Conexão perdida com a câmera', timestamp: '2026-02-25T14:32:00', acknowledged: false },
  { id: '2', cameraId: '1', cameraName: 'CAM-01 Entrada Principal', clientName: 'Condomínio Aurora', type: 'motion', severity: 'warning', message: 'Movimento detectado fora do horário', timestamp: '2026-02-25T14:28:00', acknowledged: false },
  { id: '3', cameraId: '6', cameraName: 'CAM-06 Depósito', clientName: 'Indústria MetalTech', type: 'intrusion', severity: 'critical', message: 'Intrusão detectada na zona restrita', timestamp: '2026-02-25T14:15:00', acknowledged: false },
  { id: '4', cameraId: '8', cameraName: 'CAM-08 Pátio Escola', clientName: 'Escola Futuro', type: 'connection_lost', severity: 'critical', message: 'Câmera offline há mais de 30 minutos', timestamp: '2026-02-25T13:45:00', acknowledged: true },
  { id: '5', cameraId: '3', cameraName: 'CAM-03 Piscina', clientName: 'Condomínio Aurora', type: 'tampering', severity: 'warning', message: 'Possível obstrução da lente', timestamp: '2026-02-25T13:20:00', acknowledged: true },
  { id: '6', cameraId: '9', cameraName: 'CAM-09 Hall Entrada', clientName: 'Escola Futuro', type: 'connection_lost', severity: 'info', message: 'Reconexão automática em andamento', timestamp: '2026-02-25T12:50:00', acknowledged: true },
];
