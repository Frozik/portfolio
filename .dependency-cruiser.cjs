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
      to: { path: '^apps/portfolio/src/features/([^/]+)/', pathNot: '^apps/portfolio/src/features/$1/' },
    },
    {
      name: 'domain-is-framework-free',
      comment: 'domain/ knows nothing about React, MobX, RxJS, the DOM or storage.',
      severity: 'error',
      from: { path: '/domain/' },
      to: {
        path: '^node_modules/(react|react-dom|mobx|mobx-react-lite|rxjs|idb|socket\\.io-client|yjs|y-webrtc|y-indexeddb)(/|$)',
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
        'Only a composition root may construct infrastructure objects and hand them to the application layer: the feature shell component (presentation/<Feature>.tsx) in the browser app, presentation/bootstrap.ts on the server.',
      severity: 'error',
      from: {
        path: '/presentation/',
        pathNot: ['/presentation/[A-Z][A-Za-z0-9]*\\.tsx$', '^apps/communication/src/presentation/bootstrap\\.ts$'],
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
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.test\\.tsx?$', '/dist/', '/node_modules/\\.pnpm/'] },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
