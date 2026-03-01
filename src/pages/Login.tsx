import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Mail, AlertCircle, ShieldAlert } from 'lucide-react';
import nexusLogo from '@/assets/nexus-logo.png';
import { useCompanySettings } from '@/hooks/useCompanySettings';

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { data: company } = useCompanySettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn(email, password);

    if (result.error) {
      if (result.rateLimited) {
        setIsRateLimited(true);
        setError(result.error.message);
      } else {
        setIsRateLimited(false);
        setRemainingAttempts(result.remainingAttempts ?? null);
        setError(result.error.message);
      }
    } else {
      setIsRateLimited(false);
      setRemainingAttempts(null);
      // Check if user needs to set password on first access
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.force_password_change) {
        navigate('/reset-password');
      } else {
        navigate('/');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={company?.logo_url || nexusLogo} alt={company?.name || 'Nexus Segurança'} className="w-20 h-20 object-contain mb-4 rounded-lg" />
          <h1 className="text-xl font-bold text-foreground tracking-wide">{company?.name?.toUpperCase() || 'NEXUS'}</h1>
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest">MONITORAMENTO</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="pl-9 bg-muted border-border"
                required
                disabled={isRateLimited}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 bg-muted border-border"
                required
                disabled={isRateLimited}
              />
            </div>
          </div>

          {error && (
            <div className={`flex items-center gap-2 text-xs ${isRateLimited ? 'text-warning' : 'text-destructive'}`}>
              {isRateLimited ? <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
              <div>
                <span>{error}</span>
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <span className="block text-muted-foreground mt-0.5">
                    {remainingAttempts} tentativa{remainingAttempts !== 1 ? 's' : ''} restante{remainingAttempts !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || isRateLimited}>
            {loading ? 'Entrando...' : isRateLimited ? 'Bloqueado temporariamente' : 'Entrar'}
          </Button>

          {isRateLimited && (
            <p className="text-[10px] text-center text-muted-foreground">
              🔒 Proteção contra força bruta ativada no servidor
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
