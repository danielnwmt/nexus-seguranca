import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import { initTheme } from "./components/settings/ThemeSettings";

registerSW({ immediate: true });
initTheme();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Elemento principal da aplicação não encontrado.');
}

const root = createRoot(rootElement);
const hasCloudConfig = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

if (!hasCloudConfig) {
  root.render(
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <section className="w-full max-w-lg border border-destructive/40 bg-card p-6 rounded-lg">
        <h1 className="text-xl font-bold text-destructive">Configuração incompleta</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A publicação não recebeu as configurações de conexão. Configure as variáveis da nuvem e publique novamente.
        </p>
      </section>
    </main>,
  );
} else {
  import('./App.tsx').then(({ default: App }) => root.render(<App />));
}
