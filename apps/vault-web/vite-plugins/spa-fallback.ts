import type { Plugin } from 'vite';

/**
 * GitHub Pages answers an unknown path with `404.html`: a copy of the page
 * lets a deep link (`/v/<vault>/…`) open the app, which reads the address
 * itself. The installed app never asks: its service worker serves the page.
 */
export function spaFallback(): Plugin {
  return {
    name: 'spa-fallback',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const page = bundle['index.html'];
      if (page?.type === 'asset') {
        this.emitFile({ type: 'asset', fileName: '404.html', source: page.source });
      }
    },
  };
}
