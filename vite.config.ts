import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    build: {
      target: 'es2020'
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        },
        manifest: {
          name: 'যুব সমাজ সমবায় সমিতি',
          short_name: 'সমবায় সমিতি',
          description: 'একটি পূর্ণাঙ্গ সমবায় সমিতি ব্যবস্থাপনা অ্যাপ্লিকেশন।',
          theme_color: '#f97316',
          icons: [
            {
              src: 'https://picsum.photos/192/192?seed=coop',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://picsum.photos/512/512?seed=coop',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
