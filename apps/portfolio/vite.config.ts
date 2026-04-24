import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const ENABLE_BUNDLE_STATS = process.env.ANALYZE === 'true';
const ENABLE_HTTPS = process.env.HTTPS === 'true';

const BASE = '/portfolio';

export default defineConfig({
  base: BASE,
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        navigateFallback: `${BASE}/index.html`,
        navigateFallbackAllowlist: [new RegExp(`^${BASE}`)],
        navigateFallbackDenylist: [/\.pdf$/],
      },
      manifest: {
        name: 'Portfolio',
        short_name: 'Portfolio',
        description: 'Interactive demos: neural networks, WebGPU, physics simulations',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: `${BASE}/`,
        scope: `${BASE}/`,
        icons: [
          {
            src: `${BASE}/pwa-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${BASE}/pwa-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${BASE}/pwa-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    ENABLE_BUNDLE_STATS &&
      visualizer({
        filename: 'bundle-stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: true,
      }),
    ENABLE_HTTPS && basicSsl(),
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/e-[hash].js`,
        chunkFileNames: `assets/c-[hash].js`,
        assetFileNames: `assets/a-[hash].[ext]`,
      },
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  server: {
    host: '0.0.0.0',
  },
});
