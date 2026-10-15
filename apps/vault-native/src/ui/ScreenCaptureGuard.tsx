import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';

const GUARD_KEY = 'ciphra-vault';

/**
 * Screenshots, screen recording and the recents picture stay blocked; only an
 * unlocked vault whose settings on this device allow it lifts the block, and
 * any lock puts it back — the unlock screens are never captured.
 */
export const ScreenCaptureGuard = observer(function ScreenCaptureGuard({
  app,
}: {
  readonly app: VaultApp;
}) {
  const allowed =
    app.lifecycle.kind === 'unlocked' &&
    app.session?.deviceSettings.settings.allowScreenshots === true;
  useEffect(() => {
    void (allowed ? allowScreenCaptureAsync(GUARD_KEY) : preventScreenCaptureAsync(GUARD_KEY));
  }, [allowed]);
  return null;
});
