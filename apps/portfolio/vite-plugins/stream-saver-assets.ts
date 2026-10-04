import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import type { Plugin } from 'vite';

/** Where StreamSaver's page and worker are served, below the app base; the service worker's scope follows. */
export const STREAM_SAVER_DIR = 'stream-saver';

const FILES: Readonly<Record<string, string>> = {
  'mitm.html': 'text/html; charset=utf-8',
  'sw.js': 'text/javascript; charset=utf-8',
};

const require = createRequire(import.meta.url);

/**
 * Serves StreamSaver's `mitm.html` and `sw.js` from the package itself —
 * dev server and build alike — so the bug reporter can stream a download to
 * disk without a vendored copy that drifts from the installed version.
 */
export function streamSaverAssets(): Plugin {
  const sources = Object.keys(FILES).map(file => ({
    file,
    path: require.resolve(`streamsaver/${file}`),
  }));
  return {
    name: 'stream-saver-assets',
    configureServer(server) {
      const prefix = `${server.config.base}${STREAM_SAVER_DIR}/`;
      server.middlewares.use((request, response, next) => {
        const url = request.url ?? '';
        const source = url.startsWith(prefix)
          ? sources.find(candidate => url === `${prefix}${candidate.file}`)
          : undefined;
        if (source === undefined) {
          next();
          return;
        }
        response.setHeader('Content-Type', FILES[source.file] ?? 'application/octet-stream');
        response.end(readFileSync(source.path));
      });
    },
    generateBundle() {
      for (const source of sources) {
        this.emitFile({
          type: 'asset',
          fileName: `${STREAM_SAVER_DIR}/${source.file}`,
          source: readFileSync(source.path),
        });
      }
    },
  };
}
