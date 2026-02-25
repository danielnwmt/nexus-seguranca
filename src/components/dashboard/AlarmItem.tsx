import { Alarm } from '@/types/monitoring';
import { AlertTriangle, Wifi, WifiOff, Eye, ShieldAlert, Check } from 'lucide-react';

interface AlarmItemProps {
  alarm: Alarm;
  onAcknowledge?: (id: string) => void;
}

const typeIcons = {
  motion: Eye,
  connection_lost: WifiOff,
  tampering: AlertTriangle,
  intrusion: ShieldAlert,
};

const severityStyles = {
  critical: 'border-l-alarm-critical bg-alarm-critical/5',
  warning: 'border-l-alarm-warning bg-alarm-warning/5',
  info: 'border-l-alarm-info bg-alarm-info/5',
};

const severityTextStyles = {
  critical: 'text-alarm-critical',
  warning: 'text-alarm-warning',
  info: 'text-alarm-info',
};

const AlarmItem = ({ alarm, onAcknowledge }: AlarmItemProps) => {
  const Icon = typeIcons[alarm.type];
  const time = new Date(alarm.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`border-l-2 rounded-r-md p-3 ${severityStyles[alarm.severity]} ${!alarm.acknowledged ? 'pulse-alarm' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon className={`w-4 h-4 mt-0.5 ${severityTextStyles[alarm.severity]}`} />
          <div>
            <p className="text-xs font-medium text-foreground">{alarm.message}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {alarm.cameraName} • {alarm.clientName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground">{time}</span>
          {!alarm.acknowledged && onAcknowledge && (
            <button
              onClick={() => onAcknowledge(alarm.id)}
              className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Check className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlarmItem;
