import { Client, Camera, Alarm, Guard, Invoice } from '@/types/monitoring';

export const mockClients: Client[] = [
  { id: '1', name: 'Condomínio Aurora', cpf: '12.345.678/0001-90', email: 'admin@aurora.com', phone: '(11) 3456-7890', address: 'Rua das Flores, 123 - SP', camerasCount: 8, status: 'active', createdAt: '2024-01-15', monthlyFee: 1500, paymentDueDay: 10 },
  { id: '2', name: 'Shopping Centro', cpf: '23.456.789/0001-01', email: 'seg@shopcentro.com', phone: '(11) 2345-6789', address: 'Av. Brasil, 456 - SP', camerasCount: 24, status: 'active', createdAt: '2024-02-20', monthlyFee: 4500, paymentDueDay: 15 },
  { id: '3', name: 'Indústria MetalTech', cpf: '34.567.890/0001-12', email: 'ti@metaltech.com', phone: '(11) 4567-8901', address: 'Rod. Anchieta, 789 - SP', camerasCount: 16, status: 'active', createdAt: '2024-03-10', monthlyFee: 3200, paymentDueDay: 5 },
  { id: '4', name: 'Escola Futuro', cpf: '45.678.901/0001-23', email: 'dir@futuro.edu.br', phone: '(11) 5678-9012', address: 'Rua do Saber, 321 - SP', camerasCount: 12, status: 'inactive', createdAt: '2024-04-05', monthlyFee: 2000, paymentDueDay: 20 },
];

export const mockCameras: Camera[] = [
  { id: '1', name: 'CAM-01 Entrada Principal', clientId: '1', clientName: 'Condomínio Aurora', streamUrl: 'rtsp://192.168.1.100:554/stream1', protocol: 'RTSP', status: 'online', location: 'Portaria', resolution: '1920x1080', storagePath: 'D:\\Gravacoes\\Aurora\\CAM01', retentionDays: 30 },
  { id: '2', name: 'CAM-02 Estacionamento', clientId: '1', clientName: 'Condomínio Aurora', streamUrl: 'rtsp://192.168.1.101:554/stream1', protocol: 'RTSP', status: 'recording', location: 'Garagem', resolution: '1920x1080', storagePath: 'D:\\Gravacoes\\Aurora\\CAM02', retentionDays: 30 },
  { id: '3', name: 'CAM-03 Piscina', clientId: '1', clientName: 'Condomínio Aurora', streamUrl: 'rtmp://192.168.1.102/live/cam3', protocol: 'RTMP', status: 'online', location: 'Área de Lazer', resolution: '1280x720', storagePath: 'D:\\Gravacoes\\Aurora\\CAM03', retentionDays: 15 },
  { id: '4', name: 'CAM-04 Corredor Loja A', clientId: '2', clientName: 'Shopping Centro', streamUrl: 'rtsp://10.0.1.50:554/stream1', protocol: 'RTSP', status: 'online', location: 'Piso 1', resolution: '1920x1080', storagePath: 'E:\\Gravacoes\\Shopping\\CAM04', retentionDays: 15 },
  { id: '5', name: 'CAM-05 Praça Alimentação', clientId: '2', clientName: 'Shopping Centro', streamUrl: 'rtsp://10.0.1.51:554/stream1', protocol: 'RTSP', status: 'offline', location: 'Piso 2', resolution: '1920x1080', storagePath: 'E:\\Gravacoes\\Shopping\\CAM05', retentionDays: 15 },
  { id: '6', name: 'CAM-06 Depósito', clientId: '3', clientName: 'Indústria MetalTech', streamUrl: 'rtmp://172.16.0.10/live/cam6', protocol: 'RTMP', status: 'recording', location: 'Galpão A', resolution: '2560x1440', storagePath: 'D:\\Gravacoes\\MetalTech\\CAM06', retentionDays: 20 },
  { id: '7', name: 'CAM-07 Linha de Produção', clientId: '3', clientName: 'Indústria MetalTech', streamUrl: 'rtsp://172.16.0.11:554/stream1', protocol: 'RTSP', status: 'online', location: 'Galpão B', resolution: '1920x1080', storagePath: 'D:\\Gravacoes\\MetalTech\\CAM07', retentionDays: 20 },
  { id: '8', name: 'CAM-08 Pátio Escola', clientId: '4', clientName: 'Escola Futuro', streamUrl: 'rtsp://192.168.2.10:554/stream1', protocol: 'RTSP', status: 'offline', location: 'Pátio', resolution: '1280x720', storagePath: 'D:\\Gravacoes\\Escola\\CAM08', retentionDays: 10 },
  { id: '9', name: 'CAM-09 Hall Entrada', clientId: '4', clientName: 'Escola Futuro', streamUrl: 'rtmp://192.168.2.11/live/cam9', protocol: 'RTMP', status: 'offline', location: 'Entrada', resolution: '1920x1080', storagePath: 'D:\\Gravacoes\\Escola\\CAM09', retentionDays: 10 },
];

export const mockAlarms: Alarm[] = [
  { id: '1', cameraId: '5', cameraName: 'CAM-05 Praça Alimentação', clientName: 'Shopping Centro', type: 'connection_lost', severity: 'critical', message: 'Conexão perdida com a câmera', timestamp: '2026-02-25T14:32:00', acknowledged: false },
  { id: '2', cameraId: '1', cameraName: 'CAM-01 Entrada Principal', clientName: 'Condomínio Aurora', type: 'motion', severity: 'warning', message: 'Movimento detectado fora do horário', timestamp: '2026-02-25T14:28:00', acknowledged: false },
  { id: '3', cameraId: '6', cameraName: 'CAM-06 Depósito', clientName: 'Indústria MetalTech', type: 'intrusion', severity: 'critical', message: 'Intrusão detectada na zona restrita', timestamp: '2026-02-25T14:15:00', acknowledged: false },
  { id: '4', cameraId: '8', cameraName: 'CAM-08 Pátio Escola', clientName: 'Escola Futuro', type: 'connection_lost', severity: 'critical', message: 'Câmera offline há mais de 30 minutos', timestamp: '2026-02-25T13:45:00', acknowledged: true },
  { id: '5', cameraId: '3', cameraName: 'CAM-03 Piscina', clientName: 'Condomínio Aurora', type: 'tampering', severity: 'warning', message: 'Possível obstrução da lente', timestamp: '2026-02-25T13:20:00', acknowledged: true },
  { id: '6', cameraId: '9', cameraName: 'CAM-09 Hall Entrada', clientName: 'Escola Futuro', type: 'connection_lost', severity: 'info', message: 'Reconexão automática em andamento', timestamp: '2026-02-25T12:50:00', acknowledged: true },
];

export const mockGuards: Guard[] = [
  { id: '1', name: 'Carlos Silva', cpf: '123.456.789-00', phone: '(11) 91234-5678', email: 'carlos@email.com', shift: 'night', status: 'active', clientIds: ['1', '2'], hireDate: '2023-06-15', schedule: [{ dayOfWeek: 1, startTime: '19:00', endTime: '07:00' }, { dayOfWeek: 3, startTime: '19:00', endTime: '07:00' }, { dayOfWeek: 5, startTime: '19:00', endTime: '07:00' }] },
  { id: '2', name: 'Maria Santos', cpf: '234.567.890-11', phone: '(11) 92345-6789', email: 'maria@email.com', shift: 'day', status: 'active', clientIds: ['1'], hireDate: '2023-08-20', schedule: [{ dayOfWeek: 1, startTime: '07:00', endTime: '19:00' }, { dayOfWeek: 2, startTime: '07:00', endTime: '19:00' }, { dayOfWeek: 3, startTime: '07:00', endTime: '19:00' }] },
  { id: '3', name: 'José Oliveira', cpf: '345.678.901-22', phone: '(11) 93456-7890', email: 'jose@email.com', shift: '12x36', status: 'active', clientIds: ['2', '3'], hireDate: '2024-01-10', schedule: [{ dayOfWeek: 0, startTime: '07:00', endTime: '19:00' }, { dayOfWeek: 2, startTime: '07:00', endTime: '19:00' }, { dayOfWeek: 4, startTime: '07:00', endTime: '19:00' }] },
  { id: '4', name: 'Ana Pereira', cpf: '456.789.012-33', phone: '(11) 94567-8901', email: 'ana@email.com', shift: 'night', status: 'on_leave', clientIds: ['3'], hireDate: '2023-11-05', schedule: [] },
  { id: '5', name: 'Roberto Lima', cpf: '567.890.123-44', phone: '(11) 95678-9012', email: 'roberto@email.com', shift: 'day', status: 'inactive', clientIds: ['4'], hireDate: '2023-03-01', schedule: [] },
];

export const mockInvoices: Invoice[] = [
  { id: '1', clientId: '1', clientName: 'Condomínio Aurora', amount: 1500, dueDate: '2026-03-10', status: 'pending', bank: 'sicredi' },
  { id: '2', clientId: '2', clientName: 'Shopping Centro', amount: 4500, dueDate: '2026-03-15', status: 'pending', bank: 'banco_do_brasil' },
  { id: '3', clientId: '3', clientName: 'Indústria MetalTech', amount: 3200, dueDate: '2026-03-05', status: 'paid', bank: 'inter', paidAt: '2026-03-04', paymentMethod: 'Pix' },
  { id: '4', clientId: '4', clientName: 'Escola Futuro', amount: 2000, dueDate: '2026-02-20', status: 'overdue', bank: 'caixa' },
  { id: '5', clientId: '1', clientName: 'Condomínio Aurora', amount: 1500, dueDate: '2026-02-10', status: 'paid', bank: 'sicredi', paidAt: '2026-02-09', paymentMethod: 'Boleto' },
  { id: '6', clientId: '2', clientName: 'Shopping Centro', amount: 4500, dueDate: '2026-02-15', status: 'paid', bank: 'banco_do_brasil', paidAt: '2026-02-15', paymentMethod: 'Transferência' },
  { id: '7', clientId: '3', clientName: 'Indústria MetalTech', amount: 3200, dueDate: '2026-02-05', status: 'paid', bank: 'inter', paidAt: '2026-02-04', paymentMethod: 'Pix' },
  { id: '8', clientId: '4', clientName: 'Escola Futuro', amount: 2000, dueDate: '2026-01-20', status: 'overdue', bank: 'caixa' },
];
