import { useState, useEffect } from 'react';
import { Smartphone, Download, CheckCircle, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanySettings } from '@/hooks/useCompanySettings';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const { data: company } = useCompanySettings();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  if (isStandalone || installed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">App Instalado!</h1>
          <p className="text-muted-foreground text-sm">
            O {company?.name || 'Nexus'} já está instalado no seu dispositivo. Você pode acessá-lo pela tela inicial.
          </p>
          <Button onClick={() => window.location.href = '/login'} className="w-full">
            Ir para o Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, hsl(200, 30%, 12%) 0%, hsl(190, 40%, 18%) 50%, hsl(180, 35%, 14%) 100%)' }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.07] backdrop-blur-xl shadow-2xl p-8 text-center space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto border border-primary/30">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-foreground tracking-wide">
              {company?.name?.toUpperCase() || 'NEXUS'}
            </h1>
            <p className="text-[10px] font-mono text-primary tracking-[0.3em] mt-1">APP MOBILE</p>
          </div>

          <p className="text-sm text-muted-foreground">
            Instale o aplicativo no seu celular para acesso rápido ao sistema de monitoramento.
          </p>

          {/* Android / Chrome install */}
          {deferredPrompt && (
            <Button onClick={handleInstall} className="w-full h-12 text-sm font-semibold gap-2">
              <Download className="w-5 h-5" />
              Instalar App
            </Button>
          )}

          {/* iOS instructions */}
          {isIOS && !deferredPrompt && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3 text-left">
              <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Share className="w-4 h-4 text-primary" /> Como instalar no iPhone/iPad:
              </p>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Toque no ícone de <strong>Compartilhar</strong> <Share className="w-3 h-3 inline" /> na barra inferior do Safari</li>
                <li>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></li>
                <li>Toque em <strong>"Adicionar"</strong> no canto superior direito</li>
              </ol>
            </div>
          )}

          {/* Generic fallback */}
          {!isIOS && !deferredPrompt && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3 text-left">
              <p className="text-xs font-semibold text-foreground">Como instalar:</p>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Abra o menu do navegador (⋮ três pontos)</li>
                <li>Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong></li>
              </ol>
            </div>
          )}

          <Button variant="ghost" onClick={() => window.location.href = '/login'} className="w-full text-xs text-muted-foreground">
            Voltar ao Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Install;
