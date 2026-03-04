import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Building2, ShieldCheck, RefreshCw, Save, Plus, Trash2, Edit, Smartphone, Copy, QrCode, Store, Server, HardDrive, Bot, Globe, Palette, Loader2, KeyRound, Eye, EyeOff, Bell } from 'lucide-react';
import CompanySettings from '@/components/settings/CompanySettings';
import StorageServers from '@/components/settings/StorageServers';
import MediaServerSettings from '@/components/settings/MediaServerSettings';
import SystemUpdate from '@/components/settings/SystemUpdate';
import BackupSettings from '@/components/settings/BackupSettings';
import ChatbotSettings from '@/components/settings/ChatbotSettings';
import DomainSSL from '@/components/settings/DomainSSL';
import ThemeSettings from '@/components/settings/ThemeSettings';
import NotificationSettings from '@/components/settings/NotificationSettings';
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
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';

// ---- Types ----

interface BankConfig {
  id: string;
  bank: string;
  label: string;
  agencia: string;
  conta: string;
  convenio: string;
  has_api_key: boolean;
  active: boolean;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  level: string;
  active: boolean;
}

// ---- Constants ----

const levelDescriptions: Record<string, string> = {
  n1: 'Apenas visualização de câmeras e dashboard',
  n2: 'Visualização, adiciona vigilante, câmera e edita. Sem acesso financeiro.',
  n3: 'Operador avançado. Acesso a tudo exceto configurações e gerenciamento de usuários.',
  admin: 'Acesso total ao sistema',
};

const permissionModules = [
  { label: 'Dashboard', key: 'dashboard' },
  { label: 'Câmeras (visualizar)', key: 'cameras_view' },
  { label: 'Câmeras (editar)', key: 'cameras_edit' },
  { label: 'Clientes (visualizar)', key: 'clients_view' },
  { label: 'Clientes (editar)', key: 'clients_edit' },
  { label: 'Vigilantes', key: 'guards' },
  { label: 'Instaladores', key: 'installers' },
  { label: 'Ordens de Serviço', key: 'service_orders' },
  { label: 'Financeiro', key: 'financial' },
  { label: 'Alarmes', key: 'alarms' },
  { label: 'Atendimento', key: 'support' },
  { label: 'Configurações', key: 'settings' },
  { label: 'Gerenciar Usuários', key: 'users' },
];

const defaultPermissions: Record<string, Record<string, boolean>> = {
  n1: {
    dashboard: true, cameras_view: true, cameras_edit: false, clients_view: false, clients_edit: false,
    guards: false, installers: false, service_orders: false, financial: false, alarms: true, support: false, settings: false, users: false,
  },
  n2: {
    dashboard: true, cameras_view: true, cameras_edit: true, clients_view: true, clients_edit: false,
    guards: true, installers: false, service_orders: false, financial: false, alarms: true, support: true, settings: false, users: false,
  },
  n3: {
    dashboard: true, cameras_view: true, cameras_edit: true, clients_view: true, clients_edit: true,
    guards: true, installers: true, service_orders: true, financial: true, alarms: true, support: true, settings: false, users: false,
  },
  admin: {
    dashboard: true, cameras_view: true, cameras_edit: true, clients_view: true, clients_edit: true,
    guards: true, installers: true, service_orders: true, financial: true, alarms: true, support: true, settings: true, users: true,
  },
};

const Settings = () => {
  const { toast } = useToast();

  // ---- Bank Configs (server-side) ----
  const [banks, setBanks] = useState<BankConfig[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [bankApiKeys, setBankApiKeys] = useState<Record<string, string>>({});
  const [banksSaving, setBanksSaving] = useState(false);

  const fetchBanks = useCallback(async () => {
    setBanksLoading(true);
    try {
      if (isLocalInstallation()) {
        const res = await fetch(`${getLocalApiBase()}/rest/v1/bank_configs?select=id,bank,label,agencia,conta,convenio,active,api_key_encrypted,created_at,updated_at&order=label.asc`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error('Erro ao buscar bank_configs');
        const rows = await res.json();
        const mapped = (rows || []).map((b: any) => ({
          id: b.id, bank: b.bank, label: b.label, agencia: b.agencia || '',
          conta: b.conta || '', convenio: b.convenio || '', active: !!b.active,
          has_api_key: !!(b.api_key_encrypted && b.api_key_encrypted.length > 0),
          created_at: b.created_at, updated_at: b.updated_at,
        }));
        setBanks(mapped);
      } else {
        const { data, error } = await supabase.functions.invoke('manage-bank-config', { method: 'GET' });
        if (error) throw error;
        setBanks(data || []);
      }
    } catch {
      toast({ title: 'Erro ao carregar configurações bancárias', variant: 'destructive' });
    } finally {
      setBanksLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchBanks(); }, [fetchBanks]);

  const handleBankFieldChange = (bankId: string, field: string, value: string | boolean) => {
    setBanks(prev => prev.map(b => b.id === bankId ? { ...b, [field]: value } : b));
  };

  const handleSaveBanks = async () => {
    setBanksSaving(true);
    try {
      for (const bank of banks) {
        const payload: Record<string, any> = {
          id: bank.id,
          agencia: bank.agencia,
          conta: bank.conta,
          convenio: bank.convenio,
          active: bank.active,
        };
        const newKey = bankApiKeys[bank.id];
        if (newKey !== undefined && newKey !== '') {
          payload.api_key = newKey;
        }

        if (isLocalInstallation()) {
          // Local: PATCH direto no PostgREST
          const updates: Record<string, any> = {
            agencia: bank.agencia, conta: bank.conta,
            convenio: bank.convenio, active: bank.active,
          };
          if (newKey !== undefined && newKey !== '') {
            updates.api_key_encrypted = newKey;
          }
          const res = await fetch(`${getLocalApiBase()}/rest/v1/bank_configs?id=eq.${bank.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify(updates),
          });
          if (!res.ok) throw new Error('Erro ao salvar');
        } else {
          await supabase.functions.invoke('manage-bank-config', {
            method: 'PUT',
            body: payload,
          });
        }
      }
      setBankApiKeys({});
      toast({ title: 'Configurações bancárias salvas', description: 'As chaves de API são armazenadas de forma segura no servidor.' });
      fetchBanks();
    } catch {
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' });
    } finally {
      setBanksSaving(false);
    }
  };

  // ---- Users (server-side) ----
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersSaving, setUsersSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      if (isLocalInstallation()) {
        const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
        const res = await fetch(`${getLocalApiBase()}/api/local/manage-users`, {
          headers: { 'Authorization': `Bearer ${session.access_token || ''}` },
        });
        if (!res.ok) throw new Error('Erro ao carregar usuários');
        const data = await res.json();
        setUsers(data || []);
      } else {
        const { data, error } = await supabase.functions.invoke('manage-users', { method: 'GET' });
        if (error) throw error;
        setUsers(data || []);
      }
    } catch {
      toast({ title: 'Erro ao carregar usuários', variant: 'destructive' });
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

   // ---- Permissions are read-only reference (enforced via RLS) ----

  // ---- PWA ----
  const [pwaEnabled, setPwaEnabled] = useState(true);
  const systemUrl = window.location.origin;

  // ---- User Dialog ----
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ userId: string; password: string } | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

  // Helper para chamadas de gerenciamento de usuários (local ou cloud)
  const invokeManageUsers = async (body: Record<string, unknown>) => {
    if (isLocalInstallation()) {
      const session = JSON.parse(localStorage.getItem('nexus-local-session') || '{}');
      const res = await fetch(`${getLocalApiBase()}/api/local/manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token || ''}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      return data;
    } else {
      const { data, error } = await supabase.functions.invoke('manage-users', { body });
      if (error) throw error;
      return data;
    }
  };

  const handleResetPassword = async (targetUserId: string) => {
    setResettingPassword(targetUserId);
    try {
      const data = await invokeManageUsers({ action: 'reset_password', user_id: targetUserId });
      if (data?.error) {
        toast({ title: data.error, variant: 'destructive' });
        return;
      }
      setResetPasswordResult({ userId: targetUserId, password: data.temporary_password });
      setShowResetPassword(false);
      toast({ title: 'Senha redefinida com sucesso' });
    } catch {
      toast({ title: 'Erro ao redefinir senha', variant: 'destructive' });
    } finally {
      setResettingPassword(null);
    }
  };

  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', level: 'n1', active: true });

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({ name: '', email: '', password: '', level: 'n1', active: true });
    setUserDialogOpen(true);
  };

  const openEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setUserForm({ name: user.name, email: user.email, password: '', level: user.level, active: user.active });
    setUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.email) return;
    setUsersSaving(true);
    try {
      if (editingUser) {
        await invokeManageUsers({
          action: 'update',
          user_id: editingUser.id,
          name: userForm.name,
          level: userForm.level,
          active: userForm.active,
        });
        toast({ title: 'Usuário atualizado' });
      } else {
        if (!userForm.password || userForm.password.length < 8) {
          toast({ title: 'Senha deve ter pelo menos 8 caracteres', variant: 'destructive' });
          setUsersSaving(false);
          return;
        }
        const data = await invokeManageUsers({
          action: 'create',
          email: userForm.email,
          password: userForm.password,
          name: userForm.name,
          level: userForm.level,
        });
        if (data?.error) {
          toast({ title: data.error, variant: 'destructive' });
          setUsersSaving(false);
          return;
        }
        toast({ title: 'Usuário criado', description: 'O usuário deverá redefinir a senha no primeiro acesso.' });
      }
      setUserDialogOpen(false);
      fetchUsers();
    } catch {
      toast({ title: 'Erro ao salvar usuário', variant: 'destructive' });
    } finally {
      setUsersSaving(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const data = await invokeManageUsers({ action: 'delete', user_id: id });
      if (data?.error) {
        toast({ title: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Usuário removido', variant: 'destructive' });
      fetchUsers();
    } catch {
      toast({ title: 'Erro ao remover usuário', variant: 'destructive' });
    }
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
          <TabsTrigger value="backup" className="gap-2"><HardDrive className="w-4 h-4" />Backup</TabsTrigger>
          <TabsTrigger value="chatbot" className="gap-2"><Bot className="w-4 h-4" />Chatbot</TabsTrigger>
          <TabsTrigger value="domain" className="gap-2"><Globe className="w-4 h-4" />Domínio</TabsTrigger>
          <TabsTrigger value="system" className="gap-2"><RefreshCw className="w-4 h-4" />Sistema</TabsTrigger>
          <TabsTrigger value="mobile" className="gap-2"><Smartphone className="w-4 h-4" />App Mobile</TabsTrigger>
          <TabsTrigger value="theme" className="gap-2"><Palette className="w-4 h-4" />Aparência</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" />Notificações</TabsTrigger>
        </TabsList>

        {/* ===== EMPRESA ===== */}
        <TabsContent value="company" className="space-y-4">
          <CompanySettings />
        </TabsContent>

        {/* ===== BANCOS ===== */}
        <TabsContent value="banks" className="space-y-4">
          {banksLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {banks.map(bank => (
                  <Card key={bank.id} className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{bank.label}</CardTitle>
                        <Switch
                          checked={bank.active}
                          onCheckedChange={(v) => handleBankFieldChange(bank.id, 'active', v)}
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
                            onChange={e => handleBankFieldChange(bank.id, 'agencia', e.target.value)}
                            placeholder="0000"
                            className="h-8 text-sm bg-muted border-border"
                            disabled={!bank.active}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Conta</Label>
                          <Input
                            value={bank.conta}
                            onChange={e => handleBankFieldChange(bank.id, 'conta', e.target.value)}
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
                          onChange={e => handleBankFieldChange(bank.id, 'convenio', e.target.value)}
                          placeholder="Número do convênio"
                          className="h-8 text-sm bg-muted border-border"
                          disabled={!bank.active}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Chave API / Token
                          {bank.has_api_key && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">Configurada</Badge>
                          )}
                        </Label>
                        <Input
                          type="password"
                          value={bankApiKeys[bank.id] || ''}
                          onChange={e => setBankApiKeys(prev => ({ ...prev, [bank.id]: e.target.value }))}
                          placeholder={bank.has_api_key ? '••••••••  (deixe vazio para manter)' : 'Insira a chave API'}
                          className="h-8 text-sm bg-muted border-border"
                          disabled={!bank.active}
                        />
                        <p className="text-[10px] text-muted-foreground">🔒 Armazenada de forma segura no servidor</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveBanks} className="gap-2" disabled={banksSaving}>
                  {banksSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Configurações Bancárias
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ===== SERVIDORES ===== */}
        <TabsContent value="storage" className="space-y-4">
          <MediaServerSettings />
          <StorageServers />
        </TabsContent>

        {/* ===== BACKUP ===== */}
        <TabsContent value="backup" className="space-y-4">
          <BackupSettings />
        </TabsContent>

        {/* ===== CHATBOT ===== */}
        <TabsContent value="chatbot" className="space-y-4">
          <ChatbotSettings />
        </TabsContent>

        {/* ===== PERMISSÕES ===== */}
        <TabsContent value="permissions" className="space-y-4">
          {/* Legend */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {(['n1', 'n2', 'n3', 'admin'] as const).map(level => (
              <Card key={level} className="bg-card border-border">
                <CardContent className="p-4">
                  <Badge variant={level === 'admin' ? 'default' : 'secondary'} className="mb-2">{level === 'admin' ? 'Admin' : level.toUpperCase()}</Badge>
                  <p className="text-xs text-muted-foreground">{levelDescriptions[level]}</p>
                </CardContent>
              </Card>
            ))}
          </div>

           {/* Permissions Matrix */}
           <Card className="bg-card border-border">
             <CardHeader className="pb-3">
               <div>
                 <CardTitle className="text-base">Matriz de Permissões</CardTitle>
                 <CardDescription className="text-xs">
                   Referência visual dos acessos de cada nível. As permissões são aplicadas automaticamente no banco de dados via políticas de segurança (RLS).
                 </CardDescription>
               </div>
             </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead className="text-center">N1</TableHead>
                    <TableHead className="text-center">N2</TableHead>
                    <TableHead className="text-center">N3</TableHead>
                    <TableHead className="text-center">Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionModules.map(mod => (
                    <TableRow key={mod.key}>
                      <TableCell className="font-medium text-sm">{mod.label}</TableCell>
                      {(['n1', 'n2', 'n3', 'admin'] as const).map(level => (
                        <TableCell key={level} className="text-center">
                          <Switch
                             checked={defaultPermissions[level][mod.key]}
                             disabled={true}
                             className="mx-auto"
                           />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Usuários do Sistema</CardTitle>
              <Button size="sm" onClick={openAddUser} className="gap-1">
                <Plus className="w-4 h-4" /> Novo Usuário
              </Button>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                     <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Senha</TableHead>
                      <TableHead className="w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.level === 'admin' ? 'default' : 'secondary'}>
                            {user.level === 'admin' ? 'Admin' : user.level.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-mono ${user.active ? 'text-success' : 'text-destructive'}`}>
                            {user.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {resetPasswordResult?.userId === user.id ? (
                            <div className="flex items-center gap-1">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                {showResetPassword ? resetPasswordResult.password : '••••••••'}
                              </code>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowResetPassword(v => !v)}>
                                {showResetPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(resetPasswordResult.password); toast({ title: 'Senha copiada!' }); }}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs gap-1"
                              onClick={() => handleResetPassword(user.id)}
                              disabled={resettingPassword === user.id}
                            >
                              {resettingPassword === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                              Redefinir
                            </Button>
                          )}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== DOMÍNIO / SSL ===== */}
        <TabsContent value="domain" className="space-y-4">
          <DomainSSL />
        </TabsContent>

        {/* ===== SISTEMA ===== */}
        <TabsContent value="system" className="space-y-4">
          <SystemUpdate />
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

        {/* ===== APARÊNCIA ===== */}
        <TabsContent value="theme" className="space-y-4">
          <ThemeSettings />
        </TabsContent>

        {/* ===== NOTIFICAÇÕES ===== */}
        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettings />
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
              <Label className="text-xs">Email</Label>
              <Input 
                type="email" 
                value={userForm.email} 
                onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} 
                className="bg-muted border-border"
                disabled={!!editingUser}
              />
            </div>
            {!editingUser && (
              <div className="space-y-1">
                <Label className="text-xs">Senha temporária</Label>
                <Input 
                  type="password" 
                  value={userForm.password} 
                  onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} 
                  className="bg-muted border-border" 
                  placeholder="Mínimo 8 caracteres"
                />
                <p className="text-[10px] text-muted-foreground">O usuário será solicitado a redefinir no primeiro acesso</p>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Nível de Permissão</Label>
              <Select value={userForm.level} onValueChange={v => setUserForm(p => ({ ...p, level: v }))}>
                <SelectTrigger className="bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="n1">N1 — Apenas Visualização</SelectItem>
                  <SelectItem value="n2">N2 — Operador (sem financeiro)</SelectItem>
                  <SelectItem value="n3">N3 — Operador Avançado</SelectItem>
                  <SelectItem value="admin">Admin — Acesso Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingUser && (
              <div className="flex items-center gap-2">
                <Switch checked={userForm.active} onCheckedChange={v => setUserForm(p => ({ ...p, active: v }))} />
                <Label className="text-xs">Ativo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveUser} disabled={usersSaving}>
              {usersSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
