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

## Agent tools (WebMCP)

Pages expose typed tools to browser agents through
[WebMCP](https://developer.chrome.com/docs/ai/webmcp) (`document.modelContext`,
Chrome's origin trial 149–156 or `chrome://flags/#enable-webmcp-testing`), so an
agent calls a function instead of guessing at the DOM. Every page offers
`portfolio_list_demos` and `portfolio_open_demo`; a demo adds its own tools while
it is open — sudoku, the charts (`@frozik/charts/agent`), the table
(`@frozik/table/agent`) and the controls (the component library's
`editor-agent-tools`). The kernel (`defineAgentTool`, `refuse`,
`registerAgentTools`) lives in `@frozik/utils/webmcp/`, so libraries ship their
own tool factories; the app only registers them.

- **One adapter owns the draft API** (`@frozik/utils/webmcp/modelContext.ts`).
  It has already moved once (`navigator` → `document`, `provideContext` →
  `registerTool`), so nothing else touches it. `useAgentTools`
  (`src/shared/webmcp/`) registers on mount and withdraws on
  unmount by aborting the registration signal, as the spec unregisters.
- **The top bar shows a WebMCP badge on demos with their own tools**
  (`useFeatureAgentTools` announces them, `WebMcpBadge` links to the `/webmcp`
  page, which lists every tool per demo).
  It glows with a live dot and the tool count when this browser registered
  them; without WebMCP it stays dim and says so.
- **Visitors without WebMCP pay nothing.** Tool modules and zod sit behind a
  dynamic import that runs only when `document.modelContext` exists.
- **Input is parsed, not trusted.** A tool declares a zod schema; the agent sees
  it as JSON Schema. Chrome 154 does not validate arguments itself, so ones
  that break the schema are answered with the reason before the tool body runs.
- **Mistakes come back as results, not exceptions.** Chrome hands the agent a
  bare "invocation failed" for a thrown error, so anything the agent can fix
  (a given cell, an unknown demo, a bad argument) returns `{ error }` with the
  reason; throwing is left for bugs.
- **Agent moves go through the same store actions** as the player's clicks, so
  undo, validation and the rendered board stay one source of truth.

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
- **A second service worker lives beside ours.** The bug reporter streams
  its zip to disk through StreamSaver where the native save dialog is
  missing (Firefox, Safari); its `mitm.html` and `sw.js` are served from the
  installed package under `/portfolio/stream-saver/`
  (`vite-plugins/stream-saver-assets.ts`), which is that worker's own scope.
  The app worker's navigation route denies that path and the precache ignores
  it: `mitm.html` is requested before its worker exists, and answering it
  with the shell would break every streamed download.
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
