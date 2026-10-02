# Portfolio app

The browser app of the [portfolio](../../README.md) monorepo: a Vite + React 19
shell (`src/app/` — routing, root store, layouts, bootstrap) around independent
feature slices (`src/features/<name>/`, each layered `domain` · `application` ·
`infrastructure` · `presentation`) and a shared kernel (`src/shared/` — UI
primitives, the OIDC and signaling stack, hooks, i18n). Every feature has its
own `README.md` with what it does and how.

## Engineering

Every check is a Moon task (`moon.yml`, `apps/*/moon.yml`): oxlint and oxfmt for lint and
format, TypeScript 7, dependency-cruiser for layer boundaries and cycles
(`libs/tooling/dependency-cruiser.cjs`), knip for dead code, Vitest projects, Playwright
smoke tests (`apps/portfolio/e2e`). Dependency versions live once in
`pnpm-workspace.yaml` (`catalog:`); git hooks are `lefthook.yml`; CI runs
`moon ci` and deploys to GitHub Pages from `main`.

## Performance & PWA

The landing page is tuned for Lighthouse on a throttled mobile profile
(measure only against `vite build` + `vite preview` or the live site — the
dev server serves unminified pre-bundled dependencies and is not
representative):

- **Critical path is one level deep.** The landing (`welcome`) is imported
  statically, so its code ships in the entry; the React runtime and the
  shared vendor code are separate `modulepreload`ed chunks that stay cached
  across deploys. Everything else — every demo, the auth/signaling stack
  (Google Identity, MobX session), the QR / menu / contact dialogs, the PDF
  export — loads on navigation or on click.
- **Ambient canvases have a CPU budget.** `useAmbientCanvas` sizes canvases
  from `ResizeObserver` (no forced layout after React commits), caps the
  device-pixel ratio and frame rate per surface, pauses off-screen and
  hidden canvases, and allocates below-the-fold canvases only when they
  first scroll into view. The full-screen glow is painted at 1/8 resolution
  and upscaled.
- **Service worker precaches the app shell** (`index.html`, its scripts and
  CSS, icons) **plus the CV download** (the react-pdf chunk and its fonts, the
  one lazy asset most visitors click); other hashed feature chunks are cached
  on first use with a cache-first strategy. A first-time install never reloads the page —
  only a real update of an already-controlled page does. The worker is our
  own (`src/sw/sw.ts`, built by vite-plugin-pwa in `injectManifest` mode);
  the asset list of the deployment is baked into it at build time
  (`vite-plugins/build-assets.ts`), so on activation it drops cached assets
  of previous builds instead of relying on age or entry limits.
- **The offline pack makes every route work without a network.** Every hashed
  asset outside the precached shell (about 2.4 MB compressed for the whole
  site) can be downloaded into the asset cache in one go. The installed app
  (standalone display mode, or `appinstalled` the moment the visitor accepts
  the install prompt) downloads it by itself and tops it up on every launch;
  a browser tab is never charged for it unasked — the menu shows the state
  and offers the download (`src/app/offline/`, the "offline" section of the
  menu). Once asked for, the pack keeps itself current: the request leaves a
  marker in a cache, and the next build's worker downloads its own pack while
  installing, before activation drops the previous build's assets — so a
  deployment never leaves a route uncached, not even for the tab that is open
  when it happens. Downloads resume where they stopped, and the page requests
  persistent storage before each download so the pack survives storage
  pressure. Cached assets are matched with
  `ignoreVary`: hosts answer with `Vary: Origin`, and a module `import()`
  sends an `Origin` header the pack download did not, which would otherwise
  turn every stored entry into a miss. `e2e/offline.spec.ts` downloads the
  pack through the menu and opens the games with the network cut.
- **Updates can never get stuck.** The browser refetches `sw.js` on every
  navigation (`updateViaCache` keeps it out of the HTTP cache beyond the
  24-hour cap), the page checks for an update every minute and when it
  resurfaces, and a new worker claims open pages at once; every page reloads
  on that claim except for the first claim of a first visit, which installs
  rather than updates. The two mechanisms
  that could trap users in an old build are pinned by `e2e/update.spec.ts`:
  the worker script is in no cache (the asset route matches `assets/` only),
  and the shell is precached with a content revision so a new build replaces
  it; the same test rewrites `dist/sw.js` under a running page and expects
  the page to reload under the new worker, and a downloaded pack to be
  completed again by the worker that installs.
- **The landing is prerendered at build time** by the `prerendered-landing`
  Vite plugin (`apps/portfolio/vite-plugins/`): it runs an SSR build of the
  render entry, renders the route to static HTML in a worker thread per
  language, puts both fragments into `index.html` where an inline script
  picks the visitor's language before the first paint, and React hydrates
  the survivor. The entry script
  and its module preloads start only once the first paint is reported, so
  the HTML and CSS never share bandwidth with JavaScript. Deep links served
  through `404.html` or the service-worker fallback render from scratch.
- **Releases are automatic**: after a green CI run on `main`, semantic-release
  reads the Conventional Commits since the last tag (`feat` → minor, `fix` /
  `perf` / `refactor` → patch, `!` → major), tags the commit and publishes a
  GitHub Release with the notes; other commit types release nothing. Nothing
  is written back to the branch — the tag is the version. CI predicts it
  with the same rules (`predict-version` from `libs/tooling`) before building,
  the build is stamped with it and the version is part of the build's cache
  hash, and the deploy publishes that very artifact instead of building
  again; the GitHub button's tooltip shows it. A push that releases nothing
  keeps the last version. Locally the stamp is `git describe --tags`.
- **Budgets are enforced** by `pnpm lighthouse` (`apps/portfolio/lighthouserc.json`):
  Performance ≥ 95 on mobile, the other categories at 100, and transfer-size
  caps for scripts, CSS and third-party code.
