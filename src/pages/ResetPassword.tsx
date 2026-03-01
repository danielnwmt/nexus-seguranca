import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';
import nexusLogo from '@/assets/nexus-logo.png';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { toast } from 'sonner';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { data: company } = useCompanySettings();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get('type') === 'recovery') {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const validatePassword = (pass: string): string | null => {
    if (pass.length < 8) return 'A senha deve ter pelo menos 8 caracteres';
    if (!/[A-Z]/.test(pass)) return 'A senha deve conter pelo menos uma letra maiúscula';
    if (!/[a-z]/.test(pass)) return 'A senha deve conter pelo menos uma letra minúscula';
    if (!/[0-9]/.test(pass)) return 'A senha deve conter pelo menos um número';
    if (!/[^A-Za-z0-9]/.test(pass)) return 'A senha deve conter pelo menos um caractere especial';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { force_password_change: false },
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      toast.success('Senha definida com sucesso!');
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={company?.logo_url || nexusLogo} alt={company?.name || 'Nexus Segurança'} className="w-20 h-20 object-contain mb-4 rounded-lg" />
          <h1 className="text-xl font-bold text-foreground tracking-wide">{company?.name?.toUpperCase() || 'NEXUS'}</h1>
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest">
            {isRecovery ? 'REDEFINIR SENHA' : 'CRIAR SENHA'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground text-center mb-2">
            {isRecovery 
              ? 'Digite sua nova senha abaixo.' 
              : 'Bem-vindo! Crie sua senha para acessar o sistema.'}
          </p>

          <div>
            <Label className="text-xs text-muted-foreground">Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 bg-muted border-border"
                required
                minLength={8}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Confirmar Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 bg-muted border-border"
                required
                minLength={8}
              />
            </div>
          </div>

          <div className="space-y-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              {password.length >= 8 ? <CheckCircle className="w-3 h-3 text-primary" /> : <span className="w-3 h-3 rounded-full border border-border inline-block" />}
              Mínimo 8 caracteres
            </div>
            <div className="flex items-center gap-1.5">
              {/[A-Z]/.test(password) ? <CheckCircle className="w-3 h-3 text-primary" /> : <span className="w-3 h-3 rounded-full border border-border inline-block" />}
              Uma letra maiúscula
            </div>
            <div className="flex items-center gap-1.5">
              {/[0-9]/.test(password) ? <CheckCircle className="w-3 h-3 text-primary" /> : <span className="w-3 h-3 rounded-full border border-border inline-block" />}
              Um número
            </div>
            <div className="flex items-center gap-1.5">
              {/[^A-Za-z0-9]/.test(password) ? <CheckCircle className="w-3 h-3 text-primary" /> : <span className="w-3 h-3 rounded-full border border-border inline-block" />}
              Um caractere especial
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Definir Senha'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
