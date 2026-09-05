import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import type { VitePWAOptions } from 'vite-plugin-pwa';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// vite-plugin-pwa re-exports workbox-build's option types only through its own
// options object, so the transform type is derived from there.
type ManifestTransform = NonNullable<
  NonNullable<VitePWAOptions['workbox']>['manifestTransforms']
>[number];

const ENABLE_BUNDLE_STATS = process.env.ANALYZE === 'true';
const ENABLE_HTTPS = process.env.HTTPS === 'true';

const BASE = '/portfolio';
const OUT_DIR = 'dist';
const DAY_SECONDS = 24 * 60 * 60;
const RUNTIME_ASSET_CACHE_MAX_ENTRIES = 200;
const RUNTIME_ASSET_CACHE_MAX_AGE_SECONDS = 30 * DAY_SECONDS;

/**
 * Precache only the app shell — `index.html`, everything it references
 * (entry, modulepreloads, CSS) and the PWA icons. Every other hashed asset is
 * cached on first use instead (see `runtimeCaching`): precaching all feature
 * chunks pulled ~6 MB (TensorFlow, react-pdf, …) right after the landing page
 * opened, competing with the user's first navigation on mobile data.
 */
const precacheAppShellOnly: ManifestTransform = manifestEntries => {
  const indexHtml = readFileSync(resolve(import.meta.dirname, OUT_DIR, 'index.html'), 'utf8');
  const referencedAssets = new Set(
    [...indexHtml.matchAll(/assets\/[^"']+/g)].map(match => match[0])
  );
  const manifest = manifestEntries.filter(
    entry => !entry.url.startsWith('assets/') || referencedAssets.has(entry.url)
  );
  return { manifest };
};

export default defineConfig({
  base: BASE,
  // Low-poly 3D assets (CC0, Kenney car kit) ship as raw GLB binaries.
  assetsInclude: ['**/*.glb'],
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        manifestTransforms: [precacheAppShellOnly],
        runtimeCaching: [
          {
            urlPattern: new RegExp(`${BASE}/assets/`),
            handler: 'CacheFirst',
            options: {
              cacheName: 'hashed-assets',
              expiration: {
                maxEntries: RUNTIME_ASSET_CACHE_MAX_ENTRIES,
                maxAgeSeconds: RUNTIME_ASSET_CACHE_MAX_AGE_SECONDS,
              },
            },
          },
        ],
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
        codeSplitting: {
          groups: [
            // The React runtime changes only on upgrades: a chunk of its own stays
            // cached across app deploys instead of being re-downloaded with the entry.
            { name: 'react', test: /\/node_modules\/(react-dom|scheduler)\// },
            // Everything else from node_modules and libs/* that the entry needs,
            // in one chunk — otherwise each module shared with a lazy route
            // becomes its own request (a dozen lodash-es files on the landing).
            { name: 'vendor', test: /\/(node_modules|libs\/[^/]+\/src)\//, tags: ['$initial'] },
          ],
        },
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
