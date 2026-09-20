import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

// tsc alone cannot produce a runnable bundle here: it emits extensionless
// relative imports, which Node's strict ESM rejects, and the workspace libs
// resolve to raw TypeScript ("exports": { "./*": "./src/*.ts" }). Bundling our
// own code together with @frozik/* solves both; npm dependencies stay external
// so packages that inspect their own files at runtime (node-config) or spawn
// workers (pino transports) keep working.
const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(manifest.dependencies ?? {}).filter(
  name => !name.startsWith('@frozik/')
);

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external,
});
