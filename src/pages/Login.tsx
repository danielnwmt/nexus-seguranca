import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isLocalInstallation } from '@/hooks/useLocalApi';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Mail, AlertCircle, ShieldAlert, User } from 'lucide-react';
import { maskCpf } from '@/lib/masks';
import { useCompanySettings } from '@/hooks/useCompanySettings';

// Animated particle network background
const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(120, Math.floor((window.innerWidth * window.innerHeight) / 8000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2 + 1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 210, 190, ${0.15 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 220, 200, 0.7)';
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.beginPath();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        grad.addColorStop(0, 'rgba(0, 220, 200, 0.15)');
        grad.addColorStop(1, 'rgba(0, 220, 200, 0)');
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
};

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { data: company } = useCompanySettings();
  const [identifier, setIdentifier] = useState('');
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
      if (isLocalInstallation()) {
        const stored = localStorage.getItem('nexus-local-session');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.user?.user_metadata?.force_password_change) {
              navigate('/reset-password');
              setLoading(false);
              return;
            }
          } catch {}
        }
        navigate('/');
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.force_password_change) {
          navigate('/reset-password');
        } else {
          navigate('/');
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, hsl(200, 30%, 12%) 0%, hsl(190, 40%, 18%) 50%, hsl(180, 35%, 14%) 100%)' }}
    >
      <ParticleBackground />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-xl shadow-2xl p-8">
          {/* Logo / Brand */}
          <div className="flex flex-col items-center mb-8">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-16 mb-3 object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-3 border border-primary/30">
                <span className="text-2xl font-bold text-primary">N</span>
              </div>
            )}
            <h1 className="text-xl font-bold text-foreground tracking-widest">
              {company?.name?.toUpperCase() || 'NEXUS'}
            </h1>
            <p className="text-[10px] font-mono text-primary tracking-[0.3em] mt-1">MONITORAMENTO</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-9 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50"
                  required
                  disabled={isRateLimited}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50"
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

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 text-sm tracking-wide"
              disabled={loading || isRateLimited}
            >
              {loading ? 'Entrando...' : isRateLimited ? 'Bloqueado temporariamente' : 'ENTRAR'}
            </Button>

            {isRateLimited && (
              <p className="text-[10px] text-center text-muted-foreground">
                🔒 Proteção contra força bruta ativada no servidor
              </p>
            )}
          </form>

        </div>
      </div>
    </div>
  );
};

export default Login;
