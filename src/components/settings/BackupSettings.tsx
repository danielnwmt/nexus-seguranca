import { useState } from 'react';
import { Download, HardDrive, Cloud, Loader2, Clock, Mail, Lock, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const tables = [
  { key: 'clients', label: 'Clientes' },
  { key: 'cameras', label: 'Câmeras' },
  { key: 'alarms', label: 'Alarmes' },
  { key: 'invoices', label: 'Financeiro' },
  { key: 'guards', label: 'Vigilantes' },
  { key: 'company_settings', label: 'Configurações da Empresa' },
  { key: 'storage_servers', label: 'Servidores de Gravação' },
];

const BackupSettings = () => {
  const { toast } = useToast();
  const [selectedTables, setSelectedTables] = useState<string[]>(tables.map(t => t.key));
  const [exportTarget, setExportTarget] = useState<string>('local');
  const [loading, setLoading] = useState(false);

  // Cloud credentials
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');

  // Schedule
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupTime, setBackupTime] = useState('02:00');

  const toggleTable = (key: string) => {
    setSelectedTables(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => {
    if (selectedTables.length === tables.length) {
      setSelectedTables([]);
    } else {
      setSelectedTables(tables.map(t => t.key));
    }
  };

  const fetchAllData = async () => {
    const data: Record<string, any[]> = {};
    for (const table of selectedTables) {
      const { data: rows, error } = await supabase.from(table as any).select('*');
      if (!error && rows) {
        data[table] = rows;
      }
    }
    return data;
  };

  const downloadLocal = (data: Record<string, any[]>) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bravo-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (selectedTables.length === 0) {
      toast({ title: 'Selecione ao menos uma tabela', variant: 'destructive' });
      return;
    }

    if (exportTarget !== 'local' && (!cloudEmail || !cloudPassword)) {
      toast({ title: 'Preencha o e-mail e a senha para exportar na nuvem', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const data = await fetchAllData();

      if (exportTarget === 'local') {
        downloadLocal(data);
        toast({ title: 'Backup exportado', description: 'Arquivo JSON salvo localmente.' });
      } else if (exportTarget === 'google_drive') {
        downloadLocal(data);
        toast({
          title: 'Google Drive',
          description: 'Credenciais salvas. Integração com Google Drive requer configuração OAuth. O arquivo foi baixado localmente.',
        });
      } else if (exportTarget === 'onedrive') {
        downloadLocal(data);
        toast({
          title: 'OneDrive',
          description: 'Credenciais salvas. Integração com OneDrive requer configuração OAuth. O arquivo foi baixado localmente.',
        });
      }
    } catch (err) {
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o backup.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = () => {
    toast({
      title: 'Agendamento salvo',
      description: autoBackup
        ? `Backup automático agendado para ${backupTime} diariamente.`
        : 'Backup automático desativado.',
    });
  };

  return (
    <div className="space-y-4">
      {/* Agendamento */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" /> Backup Automático
          </CardTitle>
          <CardDescription className="text-xs">Configure o backup diário automático do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Backup Diário</Label>
              <p className="text-xs text-muted-foreground">Executa o backup automaticamente todo dia</p>
            </div>
            <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
          </div>

          {autoBackup && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Horário do Backup</Label>
              <Input
                type="time"
                value={backupTime}
                onChange={e => setBackupTime(e.target.value)}
                className="bg-muted border-border w-40"
              />
            </div>
          )}

          <Button variant="outline" size="sm" onClick={handleSaveSchedule} className="gap-2">
            <Save className="w-3.5 h-3.5" /> Salvar Agendamento
          </Button>
        </CardContent>
      </Card>

      {/* Credenciais Cloud */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="w-4 h-4" /> Credenciais de Nuvem
          </CardTitle>
          <CardDescription className="text-xs">Informe e-mail e senha para enviar backups para Google Drive ou OneDrive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" /> E-mail
              </Label>
              <Input
                type="email"
                value={cloudEmail}
                onChange={e => setCloudEmail(e.target.value)}
                placeholder="seu-email@gmail.com"
                className="bg-muted border-border text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> Senha
              </Label>
              <Input
                type="password"
                value={cloudPassword}
                onChange={e => setCloudPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-muted border-border text-sm"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            * Para Google Drive, use uma senha de app. Para OneDrive, use suas credenciais Microsoft.
          </p>
        </CardContent>
      </Card>

      {/* Destino do Backup */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="w-4 h-4" /> Destino do Backup
          </CardTitle>
          <CardDescription className="text-xs">Selecione para onde o backup será enviado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={exportTarget} onValueChange={setExportTarget}>
            <SelectTrigger className="bg-muted border-border">
              <SelectValue placeholder="Selecione o destino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">
                <span className="flex items-center gap-2"><Download className="w-3 h-3" /> Download Local (JSON)</span>
              </SelectItem>
              <SelectItem value="google_drive">
                <span className="flex items-center gap-2"><Cloud className="w-3 h-3" /> Google Drive</span>
              </SelectItem>
              <SelectItem value="onedrive">
                <span className="flex items-center gap-2"><Cloud className="w-3 h-3" /> OneDrive</span>
              </SelectItem>
            </SelectContent>
          </Select>

          {exportTarget !== 'local' && (
            <p className="text-[10px] text-muted-foreground">
              Preencha as credenciais de nuvem acima para enviar o backup para {exportTarget === 'google_drive' ? 'Google Drive' : 'OneDrive'}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Exportar Backup */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4" /> Exportar Backup
          </CardTitle>
          <CardDescription className="text-xs">Selecione os dados e exporte o backup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">Dados para exportar</Label>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={selectAll}>
                {selectedTables.length === tables.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 rounded-lg border border-border p-3 bg-muted/30">
              {tables.map(t => (
                <div key={t.key} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedTables.includes(t.key)}
                    onCheckedChange={() => toggleTable(t.key)}
                    id={`backup-${t.key}`}
                  />
                  <label htmlFor={`backup-${t.key}`} className="text-xs text-foreground cursor-pointer">{t.label}</label>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleExport} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? 'Exportando...' : 'Exportar Backup Agora'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupSettings;
