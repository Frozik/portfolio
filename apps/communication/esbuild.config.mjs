import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

// tsc alone cannot produce a runnable bundle here: it emits extensionless
// relative imports, which Node's strict ESM rejects, and the workspace libs
// resolve to raw TypeScript ("exports": { "./*": "./src/*.ts" }). Bundling our
// own code together with @frozik/* solves both; npm dependencies stay external
// so packages that inspect their own files at runtime (node-config), spawn
// workers (pino transports) or load native addons (the HTTP/3 stack) keep
// working. The workspace libs' own npm dependencies are external too, and the
// image installs them flat (`node-linker=hoisted`) so `dist/` can find them.
const WORKSPACE_SCOPE = '@frozik/';

async function manifestOf(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

async function npmDependencies(manifestUrl, seen = new Set()) {
  const manifest = await manifestOf(manifestUrl);
  const names = Object.keys(manifest.dependencies ?? {});
  const external = new Set(names.filter(name => !name.startsWith(WORKSPACE_SCOPE)));
  for (const workspace of names.filter(name => name.startsWith(WORKSPACE_SCOPE))) {
    if (seen.has(workspace)) {
      continue;
    }
    seen.add(workspace);
    const library = workspace.slice(WORKSPACE_SCOPE.length);
    const nested = await npmDependencies(
      new URL(`../../libs/${library}/package.json`, import.meta.url),
      seen
    );
    nested.forEach(name => external.add(name));
  }
  return external;
}

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external: [...(await npmDependencies(new URL('./package.json', import.meta.url)))],
});
