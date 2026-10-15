import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import type { VaultFileOpening } from '@frozik/vault-app/cloud/application/VaultFileOpening';
import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { adoptFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';
import { cloudT } from '@frozik/vault-react/texts/cloud';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { ScreenFrame } from '../frame/ScreenFrame';
import { paths } from '../paths';
import { UpdateNotice } from '../UpdateNotice';
import { useWideLayout } from '../wide-layout';
import { useLaunchVault } from './useLaunchVault';
import { STEPPED } from './useStepBack';
import { VaultFileDrop } from './VaultFileDrop';
import { VaultList } from './VaultList';

const PRODUCT_NAME = 'Ciphra Vault';

const Version = ({ version }: { readonly version: string }) => (
  <>
    {PRODUCT_NAME} <span data-testid="app-version">{version}</span>
  </>
);

const OpenFile = observer(
  ({ opening, size }: { readonly opening: VaultFileOpening; readonly size: 'md' | 'lg' }) => {
    const navigate = useNavigate();
    const open = () =>
      void opening.open().then(vaultKey => {
        if (!isNil(vaultKey)) {
          void navigate(paths.vault(vaultKey));
        }
      });
    return (
      <Button
        type="button"
        size={size}
        variant="secondary"
        data-testid="open-vault-file"
        disabled={opening.state.kind === 'opening'}
        onClick={open}
      >
        {vaultT.phone.openFile}
      </Button>
    );
  }
);

const OpeningFailure = observer(({ opening }: { readonly opening: VaultFileOpening }) =>
  opening.state.kind === 'failed' ? (
    <Alert
      type="error"
      data-testid="vault-file-failed"
      message={adoptFailureText(cloudT, opening.state.failure)}
    />
  ) : null
);

const Ways = ({
  size,
  opening,
}: {
  readonly size: 'md' | 'lg';
  readonly opening: VaultFileOpening | null;
}) => (
  <>
    <Button asChild size={size}>
      <Link to={paths.openFromCloud()} state={STEPPED} data-testid="open-from-cloud">
        {vaultT.phone.openFromCloud}
      </Link>
    </Button>
    <Button asChild size={size} variant="secondary">
      <Link to={paths.create()} state={STEPPED} data-testid="create-vault">
        {vaultT.phone.create}
      </Link>
    </Button>
    {!isNil(opening) && <OpenFile opening={opening} size={size} />}
  </>
);

/** With a way to open files, a `.pwv` dropped anywhere on the first screen joins this device. */
const Droppable = ({
  opening,
  children,
}: {
  readonly opening: VaultFileOpening | null;
  readonly children: ReactNode;
}) => (isNil(opening) ? children : <VaultFileDrop opening={opening}>{children}</VaultFileDrop>);

/** A wide screen's first screen: what the app is on the left, the vaults and the ways to get one on the right. */
const WideStart = observer(
  ({
    app,
    updates,
    version,
  }: {
    readonly app: VaultApp;
    readonly updates: UpdateWatch;
    readonly version: string;
  }) => (
    <div className="mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-16 px-12">
      <section className="flex flex-col justify-center gap-6 py-16">
        <h1 className="text-[32px] font-semibold text-fg">{PRODUCT_NAME}</h1>
        <p className="text-[24px] leading-snug text-fg">
          {vaultT.headlinePrimary} <span className="text-accent">{vaultT.headlineAccent}</span>
        </p>
        <p className="text-[15px] leading-relaxed text-fg-dim">{vaultT.subtitle}</p>
        <p className="text-[12px] text-fg-faint">
          <Version version={version} />
        </p>
      </section>
      <section className="flex flex-col justify-center gap-6 py-16" aria-labelledby="device-vaults">
        <UpdateNotice watch={updates} />
        <h2 id="device-vaults" className="text-[20px] font-medium text-fg">
          {vaultT.deviceVaults.title}
        </h2>
        <VaultList
          registry={app.registry}
          className="grid grid-cols-2"
          onForget={vault => void app.forgetVault(vault.vaultKey)}
        />
        <div className="flex flex-wrap gap-3">
          <Ways size="md" opening={app.fileOpening} />
        </div>
        {!isNil(app.fileOpening) && <OpeningFailure opening={app.fileOpening} />}
      </section>
    </div>
  )
);

/** The first screen: the vaults this device knows, and the ways to get one. */
export const StartScreen = observer(
  ({
    app,
    updates,
    version,
    takeLaunch,
  }: {
    readonly app: VaultApp;
    readonly updates: UpdateWatch;
    /** This build's release, shown so a user can tell which one runs. */
    readonly version: string;
    /** The page's launch, given once: the start then opens the vault opened last. */
    readonly takeLaunch: () => boolean;
  }) => {
    useLaunchVault(app, takeLaunch);
    const wide = useWideLayout();
    if (wide) {
      return (
        <Droppable opening={app.fileOpening}>
          <WideStart app={app} updates={updates} version={version} />
        </Droppable>
      );
    }
    return (
      <Droppable opening={app.fileOpening}>
        <ScreenFrame
          footer={
            <footer className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[12px] text-fg-faint">
              <Version version={version} />
            </footer>
          }
        >
          <h1 className="text-[24px] font-semibold text-fg">{PRODUCT_NAME}</h1>
          <UpdateNotice watch={updates} />
          <section className="flex flex-col gap-3" aria-labelledby="device-vaults">
            <h2 id="device-vaults" className="text-[17px] font-medium text-fg">
              {vaultT.deviceVaults.title}
            </h2>
            <VaultList
              registry={app.registry}
              onForget={vault => void app.forgetVault(vault.vaultKey)}
            />
          </section>
          <div className="flex flex-col gap-3">
            <Ways size="lg" opening={app.fileOpening} />
          </div>
          {!isNil(app.fileOpening) && <OpeningFailure opening={app.fileOpening} />}
        </ScreenFrame>
      </Droppable>
    );
  }
);
