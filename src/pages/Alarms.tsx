import { useState } from 'react';
import { Bell, CheckCheck, Filter } from 'lucide-react';
import { mockAlarms } from '@/data/mockData';
import AlarmItem from '@/components/dashboard/AlarmItem';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Alarms = () => {
  const [alarms, setAlarms] = useState(mockAlarms);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filtered = alarms.filter(a => {
    const matchSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && !a.acknowledged) ||
      (filterStatus === 'acknowledged' && a.acknowledged);
    return matchSeverity && matchStatus;
  });

  const handleAcknowledge = (id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const handleAcknowledgeAll = () => {
    setAlarms(prev => prev.map(a => ({ ...a, acknowledged: true })));
  };

  const activeCount = alarms.filter(a => !a.acknowledged).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alarmes</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {activeCount > 0 ? (
              <span className="text-alarm-critical">{activeCount} alarme(s) ativo(s)</span>
            ) : (
              'Todos os alarmes foram reconhecidos'
            )}
          </p>
        </div>
        {activeCount > 0 && (
          <Button variant="outline" onClick={handleAcknowledgeAll} className="gap-2 border-border text-foreground hover:bg-muted">
            <CheckCheck className="w-4 h-4" /> Reconhecer Todos
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-36 bg-muted border-border"><SelectValue placeholder="Severidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="warning">Alerta</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-muted border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="acknowledged">Reconhecidos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alarm List */}
      <div className="space-y-2 max-w-2xl">
        {filtered.map(alarm => (
          <AlarmItem key={alarm.id} alarm={alarm} onAcknowledge={handleAcknowledge} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="w-12 h-12 mb-3" />
          <p className="text-sm">Nenhum alarme encontrado</p>
        </div>
      )}
    </div>
  );
};

export default Alarms;
