import { useState } from 'react';
import { Settings as SettingsIcon, Building2, ShieldCheck, RefreshCw, Save, Plus, Trash2, Edit, Smartphone, Copy, QrCode, Store, Server } from 'lucide-react';
import CompanySettings from '@/components/settings/CompanySettings';
import StorageServers from '@/components/settings/StorageServers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface BankConfig {
  id: string;
  bank: 'sicredi' | 'caixa' | 'banco_do_brasil' | 'inter';
  label: string;
  agencia: string;
  conta: string;
  convenio: string;
  apiKey: string;
  active: boolean;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  password: string;
  level: 'N1' | 'N2' | 'admin';
  active: boolean;
}

const bankLabels: Record<string, string> = {
  sicredi: 'Sicredi',
  caixa: 'Caixa Econômica',
  banco_do_brasil: 'Banco do Brasil',
  inter: 'Banco Inter',
};

const levelDescriptions: Record<string, string> = {
  N1: 'Apenas visualização',
  N2: 'Visualização, adiciona vigilante, câmera e edita. Sem acesso financeiro.',
  admin: 'Acesso total ao sistema',
};

const Settings = () => {
  const { toast } = useToast();

  const [banks, setBanks] = useState<BankConfig[]>([
    { id: '1', bank: 'sicredi', label: 'Sicredi', agencia: '', conta: '', convenio: '', apiKey: '', active: false },
    { id: '2', bank: 'caixa', label: 'Caixa Econômica', agencia: '', conta: '', convenio: '', apiKey: '', active: false },
    { id: '3', bank: 'banco_do_brasil', label: 'Banco do Brasil', agencia: '', conta: '', convenio: '', apiKey: '', active: false },
    { id: '4', bank: 'inter', label: 'Banco Inter', agencia: '', conta: '', convenio: '', apiKey: '', active: false },
  ]);

  const [users, setUsers] = useState<SystemUser[]>([
    { id: '1', name: 'Administrador', email: 'admin@bravo.com', password: '1234', level: 'admin', active: true },
  ]);

  const [pwaEnabled, setPwaEnabled] = useState(true);
  const systemUrl = window.location.origin;

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userForm, setUserForm] = useState<Omit<SystemUser, 'id'>>({ name: '', email: '', password: '', level: 'N1', active: true });

  const handleBankChange = (bankId: string, field: keyof BankConfig, value: string | boolean) => {
    setBanks(prev => prev.map(b => b.id === bankId ? { ...b, [field]: value } : b));
  };

  const handleSaveBanks = () => {
    toast({ title: 'Configurações bancárias salvas', description: 'As integrações foram atualizadas com sucesso.' });
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({ name: '', email: '', password: '', level: 'N1', active: true });
    setUserDialogOpen(true);
  };

  const openEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setUserForm({ name: user.name, email: user.email, password: user.password, level: user.level, active: user.active });
    setUserDialogOpen(true);
  };

  const handleSaveUser = () => {
    if (!userForm.name || !userForm.email) return;
    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userForm } : u));
    } else {
      setUsers(prev => [...prev, { ...userForm, id: Date.now().toString() }]);
    }
    setUserDialogOpen(false);
    toast({ title: editingUser ? 'Usuário atualizado' : 'Usuário adicionado' });
  };

  const handleDeleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    toast({ title: 'Usuário removido', variant: 'destructive' });
  };

  const handleCheckUpdate = () => {
    toast({ title: 'Sistema atualizado', description: 'Você já está na versão mais recente: v1.0.0' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground font-mono">Integrações, permissões e sistema</p>
        </div>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="company" className="gap-2"><Store className="w-4 h-4" />Empresa</TabsTrigger>
          <TabsTrigger value="banks" className="gap-2"><Building2 className="w-4 h-4" />Bancos</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2"><ShieldCheck className="w-4 h-4" />Permissões</TabsTrigger>
          <TabsTrigger value="storage" className="gap-2"><Server className="w-4 h-4" />Servidores</TabsTrigger>
          <TabsTrigger value="system" className="gap-2"><RefreshCw className="w-4 h-4" />Sistema</TabsTrigger>
          <TabsTrigger value="mobile" className="gap-2"><Smartphone className="w-4 h-4" />App Mobile</TabsTrigger>
        </TabsList>

        {/* ===== EMPRESA ===== */}
        <TabsContent value="company" className="space-y-4">
          <CompanySettings />
        </TabsContent>

        {/* ===== BANCOS ===== */}
        <TabsContent value="banks" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {banks.map(bank => (
              <Card key={bank.id} className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{bank.label}</CardTitle>
                    <Switch
                      checked={bank.active}
                      onCheckedChange={(v) => handleBankChange(bank.id, 'active', v)}
                    />
                  </div>
                  <CardDescription className="text-xs">
                    {bank.active ? 'Integração ativa' : 'Integração desativada'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Agência</Label>
                      <Input
                        value={bank.agencia}
                        onChange={e => handleBankChange(bank.id, 'agencia', e.target.value)}
                        placeholder="0000"
                        className="h-8 text-sm bg-muted border-border"
                        disabled={!bank.active}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Conta</Label>
                      <Input
                        value={bank.conta}
                        onChange={e => handleBankChange(bank.id, 'conta', e.target.value)}
                        placeholder="00000-0"
                        className="h-8 text-sm bg-muted border-border"
                        disabled={!bank.active}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Convênio / Beneficiário</Label>
                    <Input
                      value={bank.convenio}
                      onChange={e => handleBankChange(bank.id, 'convenio', e.target.value)}
                      placeholder="Número do convênio"
                      className="h-8 text-sm bg-muted border-border"
                      disabled={!bank.active}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Chave API / Token</Label>
                    <Input
                      type="password"
                      value={bank.apiKey}
                      onChange={e => handleBankChange(bank.id, 'apiKey', e.target.value)}
                      placeholder="••••••••"
                      className="h-8 text-sm bg-muted border-border"
                      disabled={!bank.active}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveBanks} className="gap-2">
              <Save className="w-4 h-4" /> Salvar Configurações Bancárias
            </Button>
          </div>
        </TabsContent>

        {/* ===== SERVIDORES ===== */}
        <TabsContent value="storage" className="space-y-4">
          <StorageServers />
        </TabsContent>

        {/* ===== PERMISSÕES ===== */}
        <TabsContent value="permissions" className="space-y-4">
          {/* Legend */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['N1', 'N2', 'admin'] as const).map(level => (
              <Card key={level} className="bg-card border-border">
                <CardContent className="p-4">
                  <Badge variant={level === 'admin' ? 'default' : 'secondary'} className="mb-2">{level === 'admin' ? 'Admin' : level}</Badge>
                  <p className="text-xs text-muted-foreground">{levelDescriptions[level]}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Usuários do Sistema</CardTitle>
              <Button size="sm" onClick={openAddUser} className="gap-1">
                <Plus className="w-4 h-4" /> Novo Usuário
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.level === 'admin' ? 'default' : 'secondary'}>
                          {user.level === 'admin' ? 'Admin' : user.level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-mono ${user.active ? 'text-success' : 'text-destructive'}`}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUser(user)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteUser(user.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== SISTEMA ===== */}
        <TabsContent value="system" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Informações do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Versão</Label>
                  <p className="text-sm font-mono text-foreground">v1.0.0</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Ambiente</Label>
                  <p className="text-sm font-mono text-foreground">Produção</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Última Atualização</Label>
                  <p className="text-sm font-mono text-foreground">25/02/2026</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2">
                    <div className="status-dot status-online" />
                    <span className="text-sm font-mono text-foreground">Online</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Button onClick={handleCheckUpdate} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Verificar Atualizações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== APP MOBILE ===== */}
        <TabsContent value="mobile" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">Acesso Mobile</CardTitle>
              <CardDescription className="text-xs">Configure o acesso ao sistema via dispositivos móveis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Modo PWA (Progressive Web App)</Label>
                  <p className="text-xs text-muted-foreground">Permite instalar o app direto pelo navegador</p>
                </div>
                <Switch checked={pwaEnabled} onCheckedChange={setPwaEnabled} />
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <Label className="text-xs text-muted-foreground">URL do Sistema</Label>
                <div className="flex gap-2">
                  <Input value={systemUrl} readOnly className="bg-muted border-border font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(systemUrl); toast({ title: 'URL copiada!' }); }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <QrCode className="w-10 h-10 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">QR Code</p>
                    <p className="text-xs text-muted-foreground">Escaneie com seu celular para acessar o sistema</p>
                  </div>
                </div>
                <div className="w-40 h-40 bg-muted border border-border rounded-lg flex items-center justify-center">
                  <QrCode className="w-20 h-20 text-muted-foreground/50" />
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <Label className="text-sm font-medium">Instruções de Instalação</Label>
                <div className="space-y-2">
                  <Card className="bg-muted border-border">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium text-foreground">📱 Android</p>
                      <p className="text-xs text-muted-foreground">Abra o Chrome → Menu (⋮) → "Adicionar à tela inicial" → Instalar</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted border-border">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium text-foreground">🍎 iOS (iPhone/iPad)</p>
                      <p className="text-xs text-muted-foreground">Abra o Safari → Compartilhar (↑) → "Adicionar à Tela de Início"</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted border-border">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium text-foreground">💻 Windows</p>
                      <p className="text-xs text-muted-foreground">Abra o Edge/Chrome → Ícone de instalar na barra de endereço → Instalar</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de usuário */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={userForm.name} onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Senha</Label>
              <Input type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} className="bg-muted border-border" placeholder="••••" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} className="bg-muted border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nível de Permissão</Label>
              <Select value={userForm.level} onValueChange={v => setUserForm(p => ({ ...p, level: v as SystemUser['level'] }))}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="N1">N1 — Apenas Visualização</SelectItem>
                  <SelectItem value="N2">N2 — Operador (sem financeiro)</SelectItem>
                  <SelectItem value="admin">Admin — Acesso Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={userForm.active} onCheckedChange={v => setUserForm(p => ({ ...p, active: v }))} />
              <Label className="text-xs">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveUser}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
