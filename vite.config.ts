import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// En GitHub Pages la app vive en https://<usuario>.github.io/<repositorio>/
// El flujo de GitHub Actions pasa BASE_PATH con el nombre del repositorio.
export default defineConfig(({ command, isPreview }) => ({
  // `vite preview` también debe usar la base del build para servir dist/ correctamente.
  base: command === 'build' || isPreview ? process.env.BASE_PATH ?? '/pizarra-ultimate/' : '/',
  // Herramientas aparte (p. ej. sacar jugadas de videos, con ffmpeg) no son parte de la app:
  // vigilarlas tumbaba el servidor cuando sus archivos estaban en uso.
  server: { watch: { ignored: ['**/tools/**', '**/supabase/**', '**/docs/**'] } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Pizarra Ultimate',
        short_name: 'Pizarra',
        description: 'Diseña, anima y muestra jugadas de ultimate frisbee.',
        lang: 'es',
        dir: 'ltr',
        theme_color: '#2F7D3A',
        background_color: '#0f2a14',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        categories: ['sports', 'education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Todo lo necesario para funcionar sin internet (incluye los módulos de exportar).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
}));
