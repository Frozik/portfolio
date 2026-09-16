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
  only a real update of an already-controlled page does.
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
