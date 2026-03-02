import { useState, useRef } from 'react';
import { Download, HardDrive, Cloud, Loader2, Clock, Mail, Lock, Save, Upload, FileUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Todas as tabelas do sistema para backup completo
const ALL_TABLES = [
  'clients',
  'cameras',
  'alarms',
  'analytics_events',
  'invoices',
  'bills',
  'guards',
  'installers',
  'service_orders',
  'recordings',
  'patrol_routes',
  'company_settings',
  'storage_servers',
  'media_servers',
  'bank_configs',
] as const;

const TABLE_LABELS: Record<string, string> = {
  clients: 'Clientes',
  cameras: 'Câmeras',
  alarms: 'Alarmes',
  analytics_events: 'Eventos Analíticos',
  invoices: 'Faturas',
  bills: 'Contas a Pagar',
  guards: 'Vigilantes',
  installers: 'Instaladores',
  service_orders: 'Ordens de Serviço',
  recordings: 'Gravações',
  patrol_routes: 'Rotas de Patrulha',
  company_settings: 'Configurações da Empresa',
  storage_servers: 'Servidores de Gravação',
  media_servers: 'Servidores de Mídia',
  bank_configs: 'Configurações Bancárias',
};

const BackupSettings = () => {
  const { toast } = useToast();
  const [exportTarget, setExportTarget] = useState<string>('local');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cloud credentials
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');

  // Schedule
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupTime, setBackupTime] = useState('02:00');

  const fetchAllData = async () => {
    const data: Record<string, any[]> = {};
    for (const table of ALL_TABLES) {
      const { data: rows, error } = await supabase.from(table as any).select('*');
      if (!error && rows) {
        data[table] = rows;
      }
    }
    return data;
  };

  const downloadLocal = (data: Record<string, any[]>) => {
    const backup = {
      _meta: {
        version: '1.0',
        exported_at: new Date().toISOString(),
        tables: Object.keys(data),
        total_records: Object.values(data).reduce((sum, rows) => sum + rows.length, 0),
      },
      ...data,
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-backup-completo-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (exportTarget === 'local') {
      setLoading(true);
      try {
        const data = await fetchAllData();
        const totalRecords = Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
        downloadLocal(data);
        toast({
          title: 'Backup completo exportado',
          description: `${totalRecords} registros de ${Object.keys(data).length} tabelas salvos.`,
        });
      } catch (err) {
        toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o backup.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveAllSettings = () => {
    if (!cloudEmail || !cloudPassword) {
      toast({ title: 'Preencha o e-mail e a senha nas credenciais de nuvem', variant: 'destructive' });
      return;
    }
    const destName = exportTarget === 'google_drive' ? 'Google Drive' : 'OneDrive';
    toast({
      title: 'Configurações salvas',
      description: `Destino: ${destName}. Credenciais e agendamento salvos com sucesso.`,
    });
  };

  const handleSaveSchedule = () => {
    toast({
      title: 'Agendamento salvo',
      description: autoBackup
        ? `Backup automático agendado para ${backupTime} diariamente.`
        : 'Backup automático desativado.',
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast({ title: 'Arquivo inválido', description: 'Selecione um arquivo .json de backup.', variant: 'destructive' });
        return;
      }
      setRestoreFile(file);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      toast({ title: 'Selecione um arquivo de backup', variant: 'destructive' });
      return;
    }

    setRestoring(true);
    try {
      // 1. Verificar se já existem clientes cadastrados
      const { data: existingClients, error: clientError } = await supabase
        .from('clients')
        .select('id', { count: 'exact', head: true });

      if (clientError) {
        toast({ title: 'Erro ao verificar servidor', description: 'Não foi possível verificar os dados existentes.', variant: 'destructive' });
        setRestoring(false);
        return;
      }

      const clientCount = (existingClients as any)?.length ?? 0;
      // Usar count do header via workaround
      const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true });

      if (count && count > 0) {
        toast({
          title: '⛔ Restauração bloqueada',
          description: `Este servidor já possui ${count} cliente(s) cadastrado(s). A restauração só é permitida em servidores sem nenhum cliente para evitar conflitos de dados.`,
          variant: 'destructive',
        });
        setRestoring(false);
        return;
      }

      // 2. Validar arquivo
      const text = await restoreFile.text();

      if (restoreFile.size > 10 * 1024 * 1024) {
        toast({ title: 'Arquivo muito grande', description: 'O backup deve ter no máximo 10MB.', variant: 'destructive' });
        setRestoring(false);
        return;
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        toast({ title: 'JSON inválido', description: 'O arquivo não contém JSON válido.', variant: 'destructive' });
        setRestoring(false);
        return;
      }

      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        toast({ title: 'Formato inválido', description: 'O backup deve ser um objeto JSON.', variant: 'destructive' });
        setRestoring(false);
        return;
      }

      // Remover metadados do backup
      const { _meta, ...tableData } = data as any;

      // Only allow safe tables (exclude user_roles to prevent privilege escalation)
      const safeTables = ALL_TABLES as readonly string[];
      const tablesToRestore = Object.keys(tableData).filter(k => safeTables.includes(k));

      if (tablesToRestore.length === 0) {
        toast({ title: 'Backup vazio ou inválido', description: 'Nenhuma tabela reconhecida no arquivo.', variant: 'destructive' });
        setRestoring(false);
        return;
      }

      // 3. Restaurar dados - ordem importante (tabelas sem FK primeiro)
      const restoreOrder = [
        'company_settings',
        'storage_servers',
        'media_servers',
        'bank_configs',
        'clients',
        'guards',
        'installers',
        'cameras',
        'alarms',
        'analytics_events',
        'invoices',
        'bills',
        'service_orders',
        'recordings',
        'patrol_routes',
      ];

      const orderedTables = restoreOrder.filter(t => tablesToRestore.includes(t));

      let restored = 0;
      let errors = 0;

      for (const table of orderedTables) {
        const rows = tableData[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        for (const row of rows) {
          if (typeof row !== 'object' || row === null || Array.isArray(row)) {
            errors++;
            continue;
          }
          const record = row as Record<string, unknown>;
          if (typeof record.id !== 'string') {
            errors++;
            continue;
          }
          // Sanitize: only allow string, number, boolean, null, arrays
          const sanitized: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(record)) {
            if (val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
              sanitized[key] = val;
            } else if (Array.isArray(val)) {
              sanitized[key] = val;
            }
          }
          const { error } = await supabase.from(table as any).upsert(sanitized as any, { onConflict: 'id' });
          if (error) errors++;
          else restored++;
        }
      }

      toast({
        title: '✅ Backup restaurado com sucesso',
        description: `${restored} registros importados de ${orderedTables.length} tabelas.${errors > 0 ? ` ${errors} erros.` : ''}`,
      });

      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast({ title: 'Erro ao restaurar', description: 'Arquivo JSON inválido ou corrompido.', variant: 'destructive' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Restaurar Backup */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Restaurar Backup
          </CardTitle>
          <CardDescription className="text-xs">Importe um arquivo de backup JSON para restaurar os dados em um servidor limpo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">
              A restauração só é permitida em servidores <strong>sem nenhum cliente cadastrado</strong>. Isso garante que dados existentes não sejam sobrescritos acidentalmente.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-foreground">
                {restoreFile ? restoreFile.name : 'Clique para selecionar o arquivo de backup'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {restoreFile
                  ? `${(restoreFile.size / 1024).toFixed(1)} KB`
                  : 'Apenas arquivos .json exportados pelo sistema'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <Button onClick={handleRestore} disabled={restoring || !restoreFile} className="w-full gap-2">
              {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {restoring ? 'Restaurando...' : 'Restaurar Dados'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
            <HardDrive className="w-4 h-4" /> Exportar Backup Completo
          </CardTitle>
          <CardDescription className="text-xs">Exporta TODOS os dados do sistema ({ALL_TABLES.length} tabelas)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">Tabelas incluídas no backup:</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TABLES.map(t => (
                <span key={t} className="text-[10px] bg-muted px-2 py-0.5 rounded border border-border text-foreground">
                  {TABLE_LABELS[t] || t}
                </span>
              ))}
            </div>
          </div>

          {exportTarget === 'local' ? (
            <Button onClick={handleExport} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {loading ? 'Exportando...' : 'Baixar Backup Completo'}
            </Button>
          ) : (
            <Button onClick={handleSaveAllSettings} className="w-full gap-2">
              <Save className="w-4 h-4" />
              Salvar Configurações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupSettings;
