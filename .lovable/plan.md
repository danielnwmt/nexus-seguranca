

## Plan: Configure PWA Completo com `vite-plugin-pwa`

### Situacao atual

O projeto tem um `manifest.json` manual e meta tags basicas, mas nao possui um service worker, o que significa que o app nao funciona offline e nao dispara o prompt de instalacao automaticamente.

### O que sera feito

1. **Instalar `vite-plugin-pwa`** — Adicionar a dependencia que gera automaticamente o service worker e gerencia o manifest.

2. **Configurar `vite.config.ts`** — Integrar o plugin VitePWA com:
   - Manifest completo (nome, icones, cores, display standalone)
   - Workbox com `navigateFallbackDenylist: [/^\/~oauth/]` (requisito de seguranca)
   - Estrategia `generateSW` para cache automatico de assets
   - `registerType: 'autoUpdate'` para atualizacoes transparentes

3. **Atualizar `index.html`** — Adicionar meta tags para Apple (apple-mobile-web-app-capable, apple-touch-icon) e atualizar og:title/description para Bravo Monitoramento.

4. **Criar icones PWA** — Gerar icones placeholder nos tamanhos 192x192 e 512x512 em `public/` (SVG convertido).

5. **Registrar o Service Worker em `src/main.tsx`** — Importar `registerSW` do vite-plugin-pwa para ativar o auto-update.

6. **Remover `public/manifest.json`** — O plugin VitePWA gera o manifest automaticamente, evitando conflito.

### Detalhes tecnicos

**vite.config.ts** — Adicao do plugin:
```typescript
import { VitePWA } from 'vite-plugin-pwa';

// No array de plugins:
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    navigateFallbackDenylist: [/^\/~oauth/],
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
  },
  manifest: {
    name: 'Bravo Monitoramento',
    short_name: 'Bravo',
    description: 'Sistema de monitoramento de câmeras',
    theme_color: '#0a0f14',
    background_color: '#0a0f14',
    display: 'standalone',
    orientation: 'any',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
})
```

**src/main.tsx** — Registro do SW:
```typescript
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });
```

**index.html** — Meta tags adicionais:
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/pwa-192x192.png" />
```

**Icones** — Criar `public/pwa-192x192.png` e `public/pwa-512x512.png` como SVGs simples com o logo/inicial "B" em fundo escuro.

### Arquivos modificados
- `package.json` — adicionar `vite-plugin-pwa`
- `vite.config.ts` — configurar plugin
- `src/main.tsx` — registrar service worker
- `src/vite-env.d.ts` — adicionar types do virtual:pwa-register
- `index.html` — meta tags Apple + limpeza og tags
- `public/manifest.json` — remover (substituido pelo plugin)
- `public/pwa-192x192.png` e `public/pwa-512x512.png` — criar icones

