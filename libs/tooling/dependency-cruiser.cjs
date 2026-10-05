/**
 * Layer and boundary rules from `.claude/rules/architecture.md`, enforced by
 * `pnpm layers` (part of `check-all`). Circular dependencies stay with madge.
 */
const FEATURE = '^apps/portfolio/src/features/([^/]+)/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'feature-isolation',
      comment:
        'A feature never imports from another feature; move shared code to src/shared or libs/*.',
      severity: 'error',
      from: { path: FEATURE },
      to: {
        path: '^apps/portfolio/src/features/([^/]+)/',
        pathNot: '^apps/portfolio/src/features/$1/',
      },
    },
    {
      name: 'domain-is-framework-free',
      comment: 'domain/ knows nothing about React, MobX, RxJS, the DOM or storage.',
      severity: 'error',
      from: { path: '/domain/' },
      to: {
        path: '/node_modules/(react|react-dom|mobx|mobx-react-lite|rxjs|idb|socket\\.io-client|yjs|y-webrtc|y-indexeddb)(/|$)',
      },
    },
    {
      name: 'domain-does-not-import-outer-layers',
      comment: 'domain/ never names application/, infrastructure/ or presentation/.',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: '/(application|infrastructure|presentation)/' },
    },
    {
      name: 'application-does-not-import-presentation',
      severity: 'error',
      from: { path: '/application/' },
      to: { path: '/presentation/' },
    },
    {
      name: 'presentation-does-not-import-infrastructure',
      comment:
        'Only a composition root may construct infrastructure objects and hand them to the application layer: the feature shell component (presentation/<Feature>.tsx) in the browser app, presentation/bootstrap.ts and its presentation/bootstrap/ modules on the server.',
      severity: 'error',
      from: {
        path: '/presentation/',
        pathNot: [
          '/presentation/[A-Z][A-Za-z0-9]*\\.tsx$',
          '^apps/communication/src/presentation/bootstrap\\.ts$',
          '^apps/communication/src/presentation/bootstrap/',
        ],
      },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'libs-do-not-import-apps',
      severity: 'error',
      from: { path: '^libs/' },
      to: { path: '^apps/' },
    },
    {
      name: 'browser-does-not-import-server',
      severity: 'error',
      from: { path: '^apps/portfolio/' },
      to: { path: '^apps/communication/' },
    },
    {
      name: 'browser-does-not-import-server-only-packages',
      comment:
        'Server-only packages must never reach the browser bundle. `socket.io-parser` / `engine.io-client` are legitimately pulled by the browser socket.io-client.',
      severity: 'error',
      from: {
        path: '^(apps/portfolio|libs/(utils|components|table|charts|bug-reporter|communication-protocol|proto)|libs/transport/src/(client|codec|frame|mux|tunnel|testing|shared))/',
      },
      to: {
        path: '/node_modules/(fastify|@fastify/[^/]+|socket\\.io|engine\\.io|jose|config|toml|@prometheus-io/client|pino|pino-pretty|p-retry|redis|@redis/[^/]+|@socket\\.io/redis-adapter|ws|@peculiar/x509|reflect-metadata)(/|$)',
      },
    },
    {
      name: 'transport-client-does-not-reach-server',
      comment:
        'The browser half of @frozik/transport never imports the Node half (native HTTP/3, ws, certificates).',
      severity: 'error',
      from: { path: '^libs/transport/src/', pathNot: '^libs/transport/src/server/' },
      to: { path: '^libs/transport/src/server/' },
    },
    {
      name: 'wire-types-stay-at-the-edge',
      comment:
        'Generated protobuf types are the wire contract: presentation (server) and infrastructure (browser) translate them; domain and application keep their own types.',
      severity: 'error',
      from: { path: '/(domain|application)/' },
      to: { path: '^libs/proto/' },
    },
    {
      name: 'table-kernel-is-view-free',
      comment:
        'The table kernel and every extension core are headless: React, the React adapter and the DOM stay in libs/table/src/react.',
      severity: 'error',
      from: { path: '^libs/table/src/(core|extensions)/' },
      to: {
        path: '(^libs/table/src/react/|/node_modules/(react|react-dom|mobx-react-lite)(/|$))',
      },
    },
    {
      name: 'table-extensions-are-isolated',
      comment:
        'A table extension never imports another extension; they meet only through the kernel.',
      severity: 'error',
      from: { path: '^libs/table/src/extensions/([^/]+)/' },
      to: {
        path: '^libs/table/src/extensions/([^/]+)/',
        pathNot: '^libs/table/src/extensions/$1/',
      },
    },
    {
      name: 'table-extension-ui-imports-own-core-only',
      comment:
        'The React part of an extension may import only its own core, the kernel and the shared adapter.',
      severity: 'error',
      from: { path: '^libs/table/src/react/extensions/([^/]+)/' },
      to: {
        path: '^libs/table/src/extensions/([^/]+)/',
        pathNot: '^libs/table/src/extensions/$1/',
      },
    },
    {
      name: 'charts-core-is-innermost',
      comment:
        'The chart kernel knows no data kind, mark, extension, backend or adapter: they all depend on it.',
      severity: 'error',
      from: { path: '^libs/charts/src/core/' },
      to: { path: '^libs/charts/src/(data|marks|extensions|webgpu|canvas2d|dom|react|theme)/' },
    },
    {
      name: 'charts-headless-layers-are-platform-free',
      comment:
        'Data kinds, marks and extension cores run without a DOM, a GPU or React: backends and adapters attach to them, never the other way round.',
      severity: 'error',
      from: { path: '^libs/charts/src/(core|data|marks|extensions|agent)/' },
      to: {
        path: '(^libs/charts/src/(webgpu|canvas2d|dom|react|theme)/|/node_modules/(react|react-dom|idb|webgpu-utils)(/|$))',
      },
    },
    {
      name: 'charts-families-are-independent',
      comment:
        'Data kinds, marks and extensions do not know each other: a series is assembled from them by the application.',
      severity: 'error',
      from: { path: '^libs/charts/src/(data|marks|extensions)/' },
      to: {
        path: '^libs/charts/src/(data|marks|extensions)/',
        pathNot: '^libs/charts/src/$1/',
      },
    },
    {
      name: 'charts-dom-knows-no-backend',
      comment: 'The browser host and the IndexedDB cache serve any backend.',
      severity: 'error',
      from: { path: '^libs/charts/src/dom/' },
      to: { path: '^libs/charts/src/(webgpu|canvas2d|react)/' },
    },
    {
      name: 'charts-extensions-are-isolated',
      comment:
        'A chart extension never imports another extension; they meet through the kernel and the slices declared in core.',
      severity: 'error',
      from: { path: '^libs/charts/src/extensions/([^/]+)/' },
      to: {
        path: '^libs/charts/src/extensions/([^/]+)/',
        pathNot: '^libs/charts/src/extensions/$1/',
      },
    },
    {
      name: 'charts-backends-are-independent',
      comment: 'A backend never imports another backend: a chart may be built from either alone.',
      severity: 'error',
      from: { path: '^libs/charts/src/(webgpu|canvas2d)/' },
      to: {
        path: '^libs/charts/src/(webgpu|canvas2d|react)/',
        pathNot: '^libs/charts/src/$1/',
      },
    },
    {
      name: 'charts-react-is-outermost',
      comment: 'Only the React adapter knows React.',
      severity: 'error',
      from: { path: '^libs/charts/src/', pathNot: '^libs/charts/src/react/' },
      to: { path: '(^libs/charts/src/react/|/node_modules/(react|react-dom)(/|$))' },
    },
    {
      name: 'charts-universal-is-a-composition',
      comment:
        'universal/ only puts the painters of both backends together; nothing in the library builds on it.',
      severity: 'error',
      from: { path: '^libs/charts/src/', pathNot: '^libs/charts/src/universal/' },
      to: { path: '^libs/charts/src/universal/' },
    },
    {
      name: 'bug-reporter-core-is-platform-free',
      comment:
        'The bug-reporter core is pure: no DOM-bound package, no React, no zip, download or metrics library — those live in collectors, capture, archive and delivery.',
      severity: 'error',
      from: { path: '^libs/bug-reporter/src/core/' },
      to: {
        path: '(^libs/bug-reporter/src/(collectors|capture|archive|delivery|reporter|react|theme|testing)/|/node_modules/(react|react-dom|client-zip|streamsaver|web-vitals|fix-webm-duration)(/|$))',
      },
    },
    {
      name: 'bug-reporter-adapters-meet-only-through-core',
      comment:
        'Collectors, capture, archive and delivery depend on the core only; the reporter composes them and the React adapter renders the reporter.',
      severity: 'error',
      from: { path: '^libs/bug-reporter/src/(collectors|capture|archive|delivery)/' },
      to: {
        path: '^libs/bug-reporter/src/(collectors|capture|archive|delivery|reporter|react)/',
        pathNot: '^libs/bug-reporter/src/$1/',
      },
    },
    {
      name: 'bug-reporter-react-is-outermost',
      comment: 'Only the React adapter knows React.',
      severity: 'error',
      from: { path: '^libs/bug-reporter/src/', pathNot: '^libs/bug-reporter/src/react/' },
      to: { path: '(^libs/bug-reporter/src/react/|/node_modules/(react|react-dom)(/|$))' },
    },
    {
      name: 'no-circular',
      comment:
        'Circular imports hide initialisation-order bugs and make modules impossible to test in isolation.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    // node_modules edges stay in the graph (the package rules above match on them) but are not followed.
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.test\\.tsx?$', '^(apps|libs)/[^/]+/dist/'] },
    // TypeScript 7 has no compiler API dependency-cruiser can use, so swc parses the sources; it keeps type-only imports in the graph.
    parser: 'swc',
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
