import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

  const signIn = async (email: string, password: string) => {
    try {
      // Use server-side rate-limited auth endpoint
      const { data, error } = await supabase.functions.invoke('auth-login', {
        body: { email, password },
      });

      if (error) {
        return { error: new Error('Erro de conexão com o servidor') };
      }

      // Rate limited
      if (data?.error === 'rate_limited') {
        return {
          error: new Error(data.message),
          rateLimited: true,
          remainingSeconds: data.remaining_seconds,
        };
      }

      // Invalid credentials
      if (data?.error === 'invalid_credentials') {
        return {
          error: new Error(data.message || 'Email ou senha inválidos'),
          remainingAttempts: data.remaining_attempts,
        };
      }

      // Other errors
      if (data?.error) {
        return { error: new Error(data.message || data.error) };
      }

      // Success - set session from the response
      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
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
