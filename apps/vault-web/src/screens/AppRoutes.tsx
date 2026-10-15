import { observer } from 'mobx-react-lite';
import { Suspense, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

import { Spinner } from '@frozik/components/ui/Spinner';

import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { CreateScreen, OpenFromCloudScreen } from './lazy-screens';
import { RequiredUpdateScreen } from './RequiredUpdateScreen';
import { InstallGate } from './start/InstallGate';
import { StartScreen } from './start/StartScreen';
import { VaultScreen } from './vault/VaultScreen';

/** Every address of the app; a build below the security floor shows only why it waits. */
export const AppRoutes = observer(
  ({
    app,
    updates,
    version,
    installFirst,
  }: {
    readonly app: VaultApp;
    readonly updates: UpdateWatch;
    readonly version: string;
    /** An iPhone in a Safari tab: the Home Screen app comes first. */
    readonly installFirst: boolean;
  }) => {
    const [gateLifted, setGateLifted] = useState(false);
    const { pathname } = useLocation();
    /** Only a page opened at the start launches into a vault; one opened on a vault already is there. */
    const [takeLaunch] = useState(() => {
      let left = pathname === '/';
      return (): boolean => {
        const taken = left;
        left = false;
        return taken;
      };
    });
    if (updates.verdict === 'required') {
      return <RequiredUpdateScreen />;
    }
    if (installFirst && !gateLifted) {
      return <InstallGate onContinue={() => setGateLifted(true)} />;
    }
    return (
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route
            path="/"
            element={
              <StartScreen app={app} updates={updates} version={version} takeLaunch={takeLaunch} />
            }
          />
          <Route path="/new" element={<CreateScreen app={app} inCloud={false} />} />
          <Route path="/open" element={<OpenFromCloudScreen app={app} />} />
          <Route path="/open/new" element={<CreateScreen app={app} inCloud />} />
          <Route path="/:vaultId/*" element={<VaultScreen app={app} version={version} />} />
        </Routes>
      </Suspense>
    );
  }
);
