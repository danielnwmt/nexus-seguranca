import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isLocalInstallation, getLocalApiBase } from '@/hooks/useLocalApi';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; rateLimited?: boolean; message?: string; remainingAttempts?: number; remainingSeconds?: number }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For local installations, check if we have a locally-stored session
    if (isLocalInstallation()) {
      const stored = localStorage.getItem('nexus-local-session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUser(parsed.user);
          setSession(parsed as Session);
        } catch {}
      }
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isLocal = isLocalInstallation();

  const signIn = async (email: string, password: string) => {
    try {
      // Local server: call auth server directly using browser hostname (works with public IP)
      if (isLocal) {
        const apiBase = getLocalApiBase();
        const res = await fetch(`${apiBase}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          return { error: new Error(data.error === 'Invalid login credentials' ? 'Email ou senha inválidos' : (data.error || 'Erro de autenticação')) };
        }

        // Store session locally
        const localSession = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_type: data.token_type,
          expires_in: data.expires_in,
          user: data.user,
        };
        localStorage.setItem('nexus-local-session', JSON.stringify(localSession));
        setUser(data.user);
        setSession(localSession as any);

        return { error: null };
      }

      // Cloud: use server-side rate-limited auth endpoint
      const { data, error } = await supabase.functions.invoke('auth-login', {
        body: { email, password },
      });

      if (error) {
        return { error: new Error('Erro de conexão com o servidor') };
      }

      if (data?.error === 'rate_limited') {
        return {
          error: new Error(data.message),
          rateLimited: true,
          remainingSeconds: data.remaining_seconds,
        };
      }

      if (data?.error === 'invalid_credentials') {
        return {
          error: new Error(data.message || 'Email ou senha inválidos'),
          remainingAttempts: data.remaining_attempts,
        };
      }

      if (data?.error) {
        return { error: new Error(data.message || data.error) };
      }

      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      return { error: null };
    } catch (err) {
      const message = isLocal && err instanceof TypeError
        ? 'Não foi possível conectar ao servidor local. Verifique se o Nginx e o serviço nexus-auth estão ativos.'
        : (err as Error).message;
      return { error: new Error(message) };
    }
  };

  const signOut = async () => {
    if (isLocal) {
      localStorage.removeItem('nexus-local-session');
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
