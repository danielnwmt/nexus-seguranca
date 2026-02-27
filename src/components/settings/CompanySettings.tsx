import { useState, useEffect } from 'react';
import { Building2, Upload, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const maskCNPJ = (value: string) => {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

const CompanySettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: '',
    name: 'Bravo Monitoramento',
    razao_social: '',
    cnpj: '',
    address: '',
    phone: '',
    email: '',
    logo_url: '',
  });

  useEffect(() => {
    loadCompanySettings();
  }, []);

  const loadCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();
    if (data) {
      setForm({
        id: data.id,
        name: data.name || '',
        razao_social: (data as any).razao_social || '',
        cnpj: data.cnpj || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        logo_url: data.logo_url || '',
      });
      if (data.logo_url) setLogoPreview(data.logo_url);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `company/logo.${fileExt}`;

    const { error } = await supabase.storage
      .from('client-cameras')
      .upload(filePath, file, { upsert: true });

    if (error) {
      toast({ title: 'Erro ao enviar logo', description: error.message, variant: 'destructive' });
      return;
    }

    const { data: urlData } = supabase.storage.from('client-cameras').getPublicUrl(filePath);
    const logoUrl = urlData.publicUrl;
    setLogoPreview(logoUrl);
    setForm(p => ({ ...p, logo_url: logoUrl }));
    queryClient.invalidateQueries({ queryKey: ['company_settings'] });
    toast({ title: 'Logo enviado com sucesso' });
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('company_settings')
      .update({
        name: form.name,
        razao_social: form.razao_social,
        cnpj: form.cnpj,
        address: form.address,
        phone: form.phone,
        email: form.email,
        logo_url: form.logo_url,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', form.id);

    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['company_settings'] });
      toast({ title: 'Dados da empresa salvos com sucesso' });
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Informações da Empresa
        </CardTitle>
        <CardDescription className="text-xs">Edite os dados e logotipo da empresa</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Building2 className="w-10 h-10 text-muted-foreground/50" />
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Logotipo da Empresa</Label>
            <div>
              <label htmlFor="logo-upload">
                <Button variant="outline" size="sm" className="gap-2 cursor-pointer" asChild>
                  <span>
                    <Upload className="w-3.5 h-3.5" /> Enviar Logo
                  </span>
                </Button>
              </label>
              <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            <p className="text-[10px] text-muted-foreground">PNG, JPG ou WebP. Máx 2MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nome Fantasia</Label>
            <Input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="bg-muted border-border"
              placeholder="Nome fantasia"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Razão Social</Label>
            <Input
              value={form.razao_social}
              onChange={e => setForm(p => ({ ...p, razao_social: e.target.value }))}
              className="bg-muted border-border"
              placeholder="Razão social da empresa"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">CNPJ</Label>
            <Input
              value={form.cnpj}
              onChange={e => setForm(p => ({ ...p, cnpj: maskCNPJ(e.target.value) }))}
              className="bg-muted border-border font-mono"
              placeholder="00.000.000/0000-00"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Endereço</Label>
          <Input
            value={form.address}
            onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
            className="bg-muted border-border"
            placeholder="Rua, número - Cidade/UF"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <Input
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: maskPhone(e.target.value) }))}
              className="bg-muted border-border font-mono"
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="bg-muted border-border"
              placeholder="contato@empresa.com"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            <Save className="w-4 h-4" /> {loading ? 'Salvando...' : 'Salvar Dados da Empresa'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompanySettings;
