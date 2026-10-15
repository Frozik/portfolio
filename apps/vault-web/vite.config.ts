import { resolve } from 'node:path';

import { COLOR_ROLES } from '@frozik/components/tokens/color-roles';
import { LANGUAGES } from '@frozik/utils/i18n/language';
import { readAppVersion } from '@frozik/vite-plugins/app-version';
import { contentSecurityPolicy } from '@frozik/vite-plugins/content-security-policy';
import { readHostFile } from '@frozik/vite-plugins/host-file';
import { kdbxWithoutNodeCrypto } from '@frozik/vite-plugins/kdbx-without-node-crypto';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { THEME_KEY } from './src/app/theme-key.ts';
import { vaultWebContentSecurityPolicy } from './vite-plugins/content-security-policy.ts';
import { prePaint } from './vite-plugins/pre-paint.ts';
import { spaFallback } from './vite-plugins/spa-fallback.ts';

/** CI computes the release version before building and hands it over in this variable. */
const VERSION_ENV = 'VAULT_WEB_VERSION';

/** `true` builds the emergency worker that retires every installed copy (`dist-kill-switch/sw.js`). */
const KILL_SWITCH = process.env.VAULT_WEB_KILL_SWITCH === 'true';
/** The whole build is precached; workbox would silently skip a file above its 2 MB default, and the app would break offline. */
const MAX_PRECACHED_FILE_BYTES = 8 * 1024 * 1024;

function killSwitchDefine(): Plugin {
  return {
    name: 'kill-switch-define',
    config: () => ({ define: { __KILL_SWITCH__: KILL_SWITCH } }),
  };
}

/** The vault's own OAuth client comes from `infra/hosts/`; without one the app offers no Google Drive. */
const HOST = readHostFile(resolve(import.meta.dirname, '..', '..'));

export default defineConfig({
  base: '/',
  // Every app worker starts as `type: 'module'`; ES output keeps a worker's dynamic imports lazy.
  // The KeePass import reads kdbxweb inside a worker, which has its own plugin list.
  worker: { format: 'es', plugins: () => [kdbxWithoutNodeCrypto()] },
  // The dev server's dependency scan does not follow workers: found on first use, these were
  // bundled anew mid-session, and the forced reload left two copies of React on the page.
  optimizeDeps: {
    include: [
      '@frozik/vault-app > @zxcvbn-ts/core',
      '@frozik/vault-app > @zxcvbn-ts/language-common',
      '@frozik/vault-app > @zxcvbn-ts/language-en',
      '@frozik/vault-app > @zxcvbn-ts/language-ru',
      '@frozik/vault > hash-wasm',
      '@frozik/vault > kdbxweb',
    ],
  },
  define: {
    __APP_VERSION__: JSON.stringify(readAppVersion(VERSION_ENV)),
    'import.meta.env.VITE_GOOGLE_VAULT_CLIENT_ID': JSON.stringify(
      HOST.values.GOOGLE_VAULT_CLIENT_ID ?? ''
    ),
  },
  plugins: [
    tailwindcss(),
    react(),
    prePaint({ themeKey: THEME_KEY, languages: LANGUAGES, background: COLOR_ROLES.bg }),
    contentSecurityPolicy(vaultWebContentSecurityPolicy()),
    spaFallback(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      // The page registers the worker itself and decides when a new build may take over.
      injectRegister: false,
      // `public/manifest.webmanifest` is the app's manifest.
      manifest: false,
      injectManifest: {
        // A classic worker: registered without `type: 'module'`, it must not be an ES module.
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,wasm,woff2}'],
        globIgnores: ['404.html'],
        maximumFileSizeToCacheInBytes: MAX_PRECACHED_FILE_BYTES,
        // The emergency build carries no app, so it has no manifest to inject.
        injectionPoint: KILL_SWITCH ? undefined : 'self.__WB_MANIFEST',
        buildPlugins: { vite: [killSwitchDefine()] },
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/e-[hash].js',
        chunkFileNames: 'assets/c-[hash].js',
        assetFileNames: 'assets/a-[hash].[ext]',
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
