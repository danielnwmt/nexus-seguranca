import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Mail, AlertCircle } from 'lucide-react';
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
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(`Aguarde ${remaining}s antes de tentar novamente.`);
      return;
    }

    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      const attempts = loginAttempts + 1;
      setLoginAttempts(attempts);
      if (attempts >= 5) {
        const lockout = Math.min(30000 * Math.pow(2, attempts - 5), 300000);
        setLockoutUntil(Date.now() + lockout);
      }
      setError('Email ou senha inválidos');
    } else {
      setLoginAttempts(0);
      setLockoutUntil(null);
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
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

      </div>
    </div>
  );
};

export default Login;
