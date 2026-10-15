import type { IVaultTitle } from '@frozik/vault/model/vault-settings-edits';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { CardFrame } from '@frozik/components/ui/CardFrame';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { AboutSection } from '@frozik/vault-react/settings/AboutSection';
import { BackupsSection } from '@frozik/vault-react/settings/BackupsSection';
import { ChangePasswordPanel } from '@frozik/vault-react/settings/ChangePasswordPanel';
import { DeviceLockSection } from '@frozik/vault-react/settings/DeviceLockSection';
import { ForgetVaultButton } from '@frozik/vault-react/settings/ForgetVaultButton';
import { RotateKeyPanel } from '@frozik/vault-react/settings/RotateKeyPanel';
import { TemplatesSection } from '@frozik/vault-react/settings/TemplatesSection';
import { VaultTitleForm } from '@frozik/vault-react/settings/VaultTitleForm';
import { settingsT } from '@frozik/vault-react/texts/settings';

/**
 * This device's timeouts for the vault, the vault's name and description,
 * removing it from the device, and what the vault is built on.
 */
export const VaultSettings = observer(
  ({
    session,
    backTo,
    cloud,
    data,
    recovery,
    onRename,
    onForget,
  }: {
    readonly session: VaultSession;
    readonly backTo: string;
    /** Where the vault is kept, and connecting a cloud. */
    readonly cloud: ReactNode;
    /** Import and export. */
    readonly data: ReactNode;
    /** The recovery key and its Emergency Kit. */
    readonly recovery: ReactNode;
    readonly onRename: (title: IVaultTitle) => void;
    readonly onForget: () => void;
  }) => {
    const t = settingsT;
    return (
      <section className="flex max-w-[640px] flex-col gap-6">
        <NavLink to={backTo} className="text-[13px] text-landing-fg-dim underline">
          {t.back}
        </NavLink>
        <h2 className="text-[22px] font-medium text-landing-fg">{t.title}</h2>

        <CardFrame className="flex flex-col gap-4 p-6">
          <h3 className="text-[16px] font-medium text-landing-fg">{t.security}</h3>
          <DeviceLockSection deviceSettings={session.deviceSettings} />
        </CardFrame>

        <CardFrame className="flex flex-col gap-4 p-6">
          <h3 className="text-[16px] font-medium text-landing-fg">{t.vault}</h3>
          <VaultTitleForm title={session.document.settings} onRename={onRename} />
          <ChangePasswordPanel keys={session.keys} />
          {recovery}
          <RotateKeyPanel rotation={session.rotation} />
          <ForgetVaultButton onForget={onForget} />
        </CardFrame>

        {cloud}
        <BackupsSection session={session} />
        <TemplatesSection session={session} />
        {data}

        <CardFrame className="flex flex-col gap-2 p-6">
          <AboutSection />
        </CardFrame>
      </section>
    );
  }
);
