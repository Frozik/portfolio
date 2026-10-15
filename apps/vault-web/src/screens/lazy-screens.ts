import { lazy } from 'react';

/** Screens a cold start to the unlock screen never needs: each loads on its first visit. */
export const CreateScreen = lazy(() =>
  import('./start/CreateScreen').then(module => ({ default: module.CreateScreen }))
);
export const OpenFromCloudScreen = lazy(() =>
  import('./start/OpenFromCloudScreen').then(module => ({ default: module.OpenFromCloudScreen }))
);
export const OpenVault = lazy(() =>
  import('./open/OpenVault').then(module => ({ default: module.OpenVault }))
);
export const EditorScreen = lazy(() =>
  import('./open/EditorScreen').then(module => ({ default: module.EditorScreen }))
);
export const SettingsScreen = lazy(() =>
  import('./settings/SettingsScreen').then(module => ({ default: module.SettingsScreen }))
);
export const AuditPage = lazy(() =>
  import('@frozik/vault-react/audit/AuditPage').then(module => ({ default: module.AuditPage }))
);
export const CardHistory = lazy(() =>
  import('@frozik/vault-react/card/CardHistory').then(module => ({ default: module.CardHistory }))
);
