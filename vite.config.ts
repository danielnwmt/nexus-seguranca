import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const CLOUD_DEFAULTS = {
  VITE_SUPABASE_URL: "https://prmblhpsmuiugwpadyee.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBybWJsaHBzbXVpdWd3cGFkeWVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTUwODQsImV4cCI6MjA4NzU3MTA4NH0.T2Kc0UhYj7Uoph5Bx5QajygJzqtTsK2VRkkyqW_7jJ8",
  VITE_SUPABASE_PROJECT_ID: "prmblhpsmuiugwpadyee",
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const cloudEnv = {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || CLOUD_DEFAULTS.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY:
      env.VITE_SUPABASE_PUBLISHABLE_KEY || CLOUD_DEFAULTS.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PROJECT_ID:
      env.VITE_SUPABASE_PROJECT_ID || CLOUD_DEFAULTS.VITE_SUPABASE_PROJECT_ID,
  };

  return ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ['**/*.{js,css,html,ico,svg,webp}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'Nexus Segurança',
        short_name: 'Nexus',
        description: 'Sistema profissional de monitoramento e segurança eletrônica',
        theme_color: '#0a0f14',
        background_color: '#0a0f14',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['security', 'business', 'utilities'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Alarmes', short_name: 'Alarmes', url: '/alarms', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Ao Vivo', short_name: 'Live', url: '/live', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
    }),
  ].filter(Boolean),
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(cloudEnv.VITE_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(cloudEnv.VITE_SUPABASE_PUBLISHABLE_KEY),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(cloudEnv.VITE_SUPABASE_PROJECT_ID),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "react-router-dom", "leaflet", "react-leaflet"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "react-router-dom", "leaflet", "react-leaflet"],
    force: true,
  },
  });
});
