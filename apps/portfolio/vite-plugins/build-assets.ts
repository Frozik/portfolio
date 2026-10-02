import { readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

import type { Plugin } from 'vite';

const ASSETS_DIR = 'assets';

/** Every hashed asset of a finished browser build, as the service worker addresses them (`assets/c-xxxx.js`). */
export function listBuildAssets(outDir: string): readonly string[] {
  return readdirSync(resolve(outDir, ASSETS_DIR), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => relative(outDir, resolve(entry.parentPath, entry.name)).split(sep).join('/'))
    .toSorted();
}

/**
 * Bakes the asset list into the service worker as `__BUILD_ASSETS__`. The plugin
 * belongs to the worker build only, which vite-plugin-pwa starts once the browser
 * bundle is in `outDir`, so the list is exact for this deployment — the worker
 * can tell its own assets from a previous build's without a network round trip.
 */
export function buildAssetsDefine(outDir: string): Plugin {
  return {
    name: 'build-assets-define',
    config: () => ({ define: { __BUILD_ASSETS__: JSON.stringify(listBuildAssets(outDir)) } }),
  };
}
