import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { AboutSection } from '@frozik/vault-react/settings/AboutSection';
import { BackupsSection } from '@frozik/vault-react/settings/BackupsSection';
import { ChangePasswordPanel } from '@frozik/vault-react/settings/ChangePasswordPanel';
import { CloudSection } from '@frozik/vault-react/settings/CloudSection';
import { DataSection } from '@frozik/vault-react/settings/DataSection';
import { DeviceLockSection } from '@frozik/vault-react/settings/DeviceLockSection';
import { ForgetVaultButton } from '@frozik/vault-react/settings/ForgetVaultButton';
import { PasskeysSection } from '@frozik/vault-react/settings/PasskeysSection';
import { QuickUnlockPanel } from '@frozik/vault-react/settings/QuickUnlockPanel';
import { RecoveryKeyPanel } from '@frozik/vault-react/settings/RecoveryKeyPanel';
import { RotateKeyPanel } from '@frozik/vault-react/settings/RotateKeyPanel';
import { TemplatesSection } from '@frozik/vault-react/settings/TemplatesSection';
import { VaultTitleForm } from '@frozik/vault-react/settings/VaultTitleForm';
import { settingsT } from '@frozik/vault-react/texts/settings';
import { paths } from '../paths';

const Group = ({ title, children }: { readonly title: string; readonly children: ReactNode }) => (
  <section className="flex flex-col gap-4 border-b border-line pb-6">
    <h2 className="text-[17px] font-semibold text-fg">{title}</h2>
    {children}
  </section>
);

/** Every setting of the open vault on this device, one column a thumb scrolls through. */
export const SettingsScreen = observer(
  ({
    app,
    session,
    version,
  }: {
    readonly app: VaultApp;
    readonly session: VaultSession;
    readonly version: string;
  }) => {
    const t = settingsT;
    const navigate = useNavigate();
    const forget = useEventCallback(() => {
      void navigate(paths.start());
      void app.forgetVault();
    });
    return (
      <div className="flex flex-col gap-6 overflow-y-auto px-4 pt-3 pb-8" data-testid="settings">
        <h1 className="text-[22px] font-semibold text-fg">{t.title}</h1>
        <Group title={t.security}>
          <DeviceLockSection deviceSettings={session.deviceSettings} />
          <QuickUnlockPanel create={() => session.flows.quickUnlockOf()} />
        </Group>
        <Group title={t.vault}>
          <VaultTitleForm
            title={session.document.settings}
            onRename={title => void app.renameVault(title)}
          />
          <ChangePasswordPanel keys={session.keys} />
          <RecoveryKeyPanel session={session} siteAddress={window.location.origin} />
          <PasskeysSection session={session} />
          <RotateKeyPanel rotation={session.rotation} />
          <ForgetVaultButton onForget={forget} />
        </Group>
        <CloudSection store={app} session={session} />
        <BackupsSection session={session} />
        <TemplatesSection session={session} />
        <DataSection session={session} />
        <section className="flex flex-col gap-2">
          <AboutSection>
            <p className="text-[13px] text-fg-dim" data-testid="settings-version">
              Ciphra Vault {version}
            </p>
          </AboutSection>
        </section>
      </div>
    );
  }
);
