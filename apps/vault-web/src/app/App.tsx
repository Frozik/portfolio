import { COLOR_ROLES } from '@frozik/components/tokens/color-roles';
import { followKeyboardInset } from '@frozik/utils/viewport/keyboard-inset';
import { useEffect, useState } from 'react';

import { currentInstallState } from '@frozik/vault-browser/device/install-state';
import { resumePendingClipboardClear } from '@frozik/vault-browser/exposure/browser-clipboard';
import { LANGUAGE } from '@frozik/vault-react/texts/language';
import { BrowserRouter } from 'react-router-dom';

import { AppRoutes } from '../screens/AppRoutes';
import { PrivacyCurtain } from '../screens/PrivacyCurtain';
import { ThemeCorner } from '../screens/ThemeCorner';
import { createUpdateWatch, createVaultApp } from './composition-root';
import { followDocumentTheme } from './document-theme';
import { followUpdates } from './updates';

const INSTALL_STATE = currentInstallState();

/**
 * The page is the app: its `VaultApp` lives as long as the tab, and a lock
 * ends both with a reload, so nothing here is torn down on unmount.
 */
export const App = () => {
  const [app] = useState(() => createVaultApp(LANGUAGE));
  const [updates] = useState(createUpdateWatch);

  useEffect(() => {
    void app.registry.refresh();
  }, [app]);
  useEffect(() => followDocumentTheme(app.appearance, COLOR_ROLES.bg), [app]);
  useEffect(resumePendingClipboardClear, []);
  useEffect(() => followKeyboardInset(document.documentElement), []);
  // The dev server serves no service worker; updates are a built app's concern.
  useEffect(() => (import.meta.env.PROD ? followUpdates(app, updates) : undefined), [app, updates]);

  return (
    <BrowserRouter>
      <AppRoutes
        app={app}
        updates={updates}
        version={__APP_VERSION__}
        installFirst={INSTALL_STATE === 'iphone-browser'}
      />
      <ThemeCorner app={app} />
      <PrivacyCurtain />
    </BrowserRouter>
  );
};
