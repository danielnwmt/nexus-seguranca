import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Mail, AlertCircle, ShieldAlert } from 'lucide-react';
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
    <div
      className="min-h-screen flex flex-col items-center justify-end pb-12 p-4 relative"
      style={{
        backgroundImage: 'url(/images/login-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark gradient overlay - lighter on top to show logo, darker at bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-2xl font-bold text-white tracking-widest">
            {company?.name?.toUpperCase() || 'NEXUS'}
          </h1>
          <p className="text-xs font-mono text-primary tracking-[0.3em]">MONITORAMENTO</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-white/10 bg-black/70 backdrop-blur-md p-6">
          <div>
            <Label className="text-xs text-white/70">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
                disabled={isRateLimited}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-white/70">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
                disabled={isRateLimited}
              />
            </div>
          </div>

          {error && (
            <div className={`flex items-center gap-2 text-xs ${isRateLimited ? 'text-yellow-400' : 'text-red-400'}`}>
              {isRateLimited ? <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
              <div>
                <span>{error}</span>
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <span className="block text-white/50 mt-0.5">
                    {remainingAttempts} tentativa{remainingAttempts !== 1 ? 's' : ''} restante{remainingAttempts !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
            disabled={loading || isRateLimited}
          >
            {loading ? 'Entrando...' : isRateLimited ? 'Bloqueado temporariamente' : 'Entrar'}
          </Button>

          {isRateLimited && (
            <p className="text-[10px] text-center text-white/50">
              🔒 Proteção contra força bruta ativada no servidor
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
