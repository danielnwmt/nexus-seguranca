export interface Client {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  address: string;
  camerasCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
  monthlyFee?: number;
  paymentDueDay?: number;
}

export type AnalyticType =
  | 'lpr'
  | 'weapon_detection'
  | 'line_crossing'
  | 'area_intrusion'
  | 'loitering'
  | 'human_car_classification'
  | 'fallen_person'
  | 'people_counting'
  | 'tampering';

export const ANALYTIC_LABELS: Record<AnalyticType, string> = {
  lpr: 'LPR (Leitura de Placas)',
  weapon_detection: 'Detecção de Armas',
  line_crossing: 'Cruzamento de Linha',
  area_intrusion: 'Intrusão de Área',
  loitering: 'Vadiagem (Loitering)',
  human_car_classification: 'Classificação Humano/Carro',
  fallen_person: 'Pessoa Caída',
  people_counting: 'Contagem de Pessoas',
  tampering: 'Tampering (Sabotagem)',
};

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
  storagePath: string;
  retentionDays: 5 | 10 | 15 | 20 | 25 | 30;
  analytics: AnalyticType[];
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

export interface Guard {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  shift: 'day' | 'night' | '12x36';
  status: 'active' | 'inactive' | 'on_leave';
  clientIds: string[];
  hireDate: string;
  schedule: GuardSchedule[];
}

export interface GuardSchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  bank?: 'sicredi' | 'caixa' | 'banco_do_brasil' | 'inter';
  paidAt?: string;
  boletoUrl?: string;
}
