import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { MultilineEditor } from '@frozik/components/components/RichEditor/MultilineEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { Select } from '@frozik/components/components/select/Select';
import type { Milliseconds } from '@frozik/utils/date/types';
import { CURRENT_SCHEMA_VERSION } from '@frozik/vault/format/manifest';
import type { IVaultTitle } from '@frozik/vault/model/vault-settings-edits';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { ConfirmDialog } from '../../../../shared/ui/ConfirmDialog';
import type { VaultSession } from '../../application/VaultSession';
import {
  CLIPBOARD_CLEAR_CHOICES,
  HIDDEN_LOCK_CHOICES,
  IDLE_LOCK_CHOICES,
} from '../../domain/device-settings';
import { VaultField } from '../components/VaultField';
import { settingsT } from '../translations/settings';
import { BackupsSection } from './BackupsSection';
import { ChangePasswordPanel } from './ChangePasswordPanel';
import { durationLabel } from './duration-label';
import { RotateKeyPanel } from './RotateKeyPanel';
import { TemplatesSection } from './TemplatesSection';

const NEVER = 'never';
const DESCRIPTION_MAX_ROWS = 4;

function hiddenKey(ms: Milliseconds | null): string {
  return ms === null ? NEVER : String(ms);
}

function choiceOptions(choices: readonly (Milliseconds | null)[]) {
  return choices.map(ms => ({ value: hiddenKey(ms), label: durationLabel(ms) }));
}

/**
 * This device's timeouts for the vault, the vault's name and description,
 * removing it from the device, and what the vault is built on. The settings
 * of the vault itself (thresholds, icons) arrive with the audit (v1).
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
    const locale = getCurrentLanguage();
    const { settings } = session.deviceSettings;
    const [name, setName] = useState(session.document.settings.name);
    const [description, setDescription] = useState(session.document.settings.description);
    const [confirmingForget, setConfirmingForget] = useState(false);

    return (
      <section className="flex max-w-[640px] flex-col gap-6">
        <NavLink to={backTo} className="text-[13px] text-landing-fg-dim underline">
          {t.back}
        </NavLink>
        <h2 className="text-[22px] font-medium text-landing-fg">{t.title}</h2>

        <CardFrame className="flex flex-col gap-4 p-6">
          <h3 className="text-[16px] font-medium text-landing-fg">{t.security}</h3>
          <VaultField label={t.idleLock}>
            {() => (
              <Select
                aria-label={t.idleLock}
                options={choiceOptions(IDLE_LOCK_CHOICES)}
                value={String(settings.lock.idle)}
                onValueChange={value =>
                  session.deviceSettings.update({
                    lock: { ...settings.lock, idle: Number(value) as Milliseconds },
                  })
                }
                locale={locale}
              />
            )}
          </VaultField>
          <VaultField label={t.hiddenLock}>
            {() => (
              <Select
                aria-label={t.hiddenLock}
                options={choiceOptions(HIDDEN_LOCK_CHOICES)}
                value={hiddenKey(settings.lock.hidden)}
                onValueChange={value =>
                  session.deviceSettings.update({
                    lock: {
                      ...settings.lock,
                      hidden: value === NEVER ? null : (Number(value) as Milliseconds),
                    },
                  })
                }
                locale={locale}
              />
            )}
          </VaultField>
          <VaultField label={t.clipboardClear} hint={t.clipboardNote}>
            {describedBy => (
              <Select
                aria-label={t.clipboardClear}
                aria-describedby={describedBy}
                options={choiceOptions(CLIPBOARD_CLEAR_CHOICES)}
                value={String(settings.clipboardClearMs)}
                onValueChange={value =>
                  session.deviceSettings.update({ clipboardClearMs: Number(value) as Milliseconds })
                }
                locale={locale}
              />
            )}
          </VaultField>
          <VaultField label={t.siteIcons} hint={t.siteIconsNote}>
            {() => (
              <Checkbox
                checked={settings.loadSiteIcons}
                onCheckedChange={loadSiteIcons => session.deviceSettings.update({ loadSiteIcons })}
              >
                {t.siteIconsToggle}
              </Checkbox>
            )}
          </VaultField>
        </CardFrame>

        <CardFrame className="flex flex-col gap-4 p-6">
          <h3 className="text-[16px] font-medium text-landing-fg">{t.vault}</h3>
          <VaultField label={t.name}>
            {() => <TextEditor aria-label={t.name} value={name} onValueChange={setName} />}
          </VaultField>
          <VaultField label={t.description} hint={t.descriptionHint}>
            {describedBy => (
              <MultilineEditor
                aria-label={t.description}
                aria-describedby={describedBy}
                maxRows={DESCRIPTION_MAX_ROWS}
                value={description}
                onValueChange={setDescription}
              />
            )}
          </VaultField>
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            disabled={
              name.trim() === '' ||
              (name.trim() === session.document.settings.name &&
                description.trim() === session.document.settings.description)
            }
            onClick={() => onRename({ name, description })}
          >
            {t.saveTitle}
          </Button>
          <ChangePasswordPanel keys={session.keys} />
          {recovery}
          <RotateKeyPanel rotation={session.rotation} />
          <Button
            type="button"
            variant="danger"
            className="self-start"
            onClick={() => setConfirmingForget(true)}
          >
            {t.forget}
          </Button>
        </CardFrame>

        {cloud}
        <BackupsSection session={session} />
        <TemplatesSection session={session} />
        {data}

        <CardFrame className="flex flex-col gap-2 p-6">
          <h3 className="text-[16px] font-medium text-landing-fg">{t.about}</h3>
          <p className="text-[13px] text-landing-fg-dim">
            {t.formatVersion(CURRENT_SCHEMA_VERSION)}
          </p>
          <span className="text-[13px] font-medium text-landing-fg">{t.credits}</span>
          <ul className="list-disc pl-5 text-[12px] text-landing-fg-dim">
            {t.creditsList.map(credit => (
              <li key={credit}>{credit}</li>
            ))}
          </ul>
        </CardFrame>

        <ConfirmDialog
          open={confirmingForget}
          title={t.forgetTitle}
          description={t.forgetMessage}
          confirmLabel={t.forgetConfirm}
          cancelLabel={t.cancel}
          tone="danger"
          onConfirm={() => {
            setConfirmingForget(false);
            onForget();
          }}
          onCancel={() => setConfirmingForget(false)}
        />
      </section>
    );
  }
);
