import { useState } from 'react';
import { Download, HardDrive, Cloud, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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

    setLoading(true);
    try {
      const data = await fetchAllData();

      if (exportTarget === 'local') {
        downloadLocal(data);
        toast({ title: 'Backup exportado', description: 'Arquivo JSON salvo localmente.' });
      } else if (exportTarget === 'google_drive') {
        // Placeholder - requires Google Drive API integration
        downloadLocal(data);
        toast({
          title: 'Google Drive',
          description: 'Integração com Google Drive requer configuração de API. O arquivo foi baixado localmente.',
        });
      } else if (exportTarget === 'onedrive') {
        // Placeholder - requires OneDrive API integration
        downloadLocal(data);
        toast({
          title: 'OneDrive',
          description: 'Integração com OneDrive requer configuração de API. O arquivo foi baixado localmente.',
        });
      }
    } catch (err) {
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o backup.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="w-4 h-4" /> Backup do Sistema
          </CardTitle>
          <CardDescription className="text-xs">Exporte os dados do sistema para backup local ou nuvem</CardDescription>
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

          <div>
            <Label className="text-xs text-muted-foreground">Destino do Backup</Label>
            <Select value={exportTarget} onValueChange={setExportTarget}>
              <SelectTrigger className="bg-muted border-border mt-1">
                <SelectValue />
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
          </div>

          <Button onClick={handleExport} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? 'Exportando...' : 'Exportar Backup'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupSettings;