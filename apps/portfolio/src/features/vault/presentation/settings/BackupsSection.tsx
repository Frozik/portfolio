import { Select } from '@frozik/components/components/select/Select';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { formatDateTimeLocal } from '@frozik/utils/date/format';
import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import type { ISnapshotEntry } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { ConfirmDialog } from '../../../../shared/ui/ConfirmDialog';
import type { TRestoreOutcome } from '../../application/VaultBackups';
import type { VaultSession } from '../../application/VaultSession';
import { BACKUPS_KEPT_CHOICES } from '../../domain/device-settings';
import { registryFailureText } from '../registry-failure-text';
import { settingsT } from '../translations/settings';

const BYTES_PER_KILOBYTE = 1024;

function whenText(entry: ISnapshotEntry): string {
  return formatDateTimeLocal(millisecondsToISO8601(entry.takenAt));
}

function sizeText(bytes: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilobyte',
    maximumFractionDigits: 0,
  }).format(Math.max(1, bytes / BYTES_PER_KILOBYTE));
}

function outcomeAlert(outcome: TRestoreOutcome) {
  const t = settingsT.backups;
  switch (outcome.kind) {
    case 'restored': {
      const { restored, revived, trashed } = outcome.summary;
      return <Alert type="success" message={t.restored(restored, revived, trashed)} />;
    }
    case 'older-key':
      return <Alert type="error" message={t.olderKey} />;
    case 'unreadable':
      return <Alert type="error" message={t.unreadable} />;
    default:
      return assertNever(outcome);
  }
}

/** This device's earlier versions of the vault, how many to keep, and the rollback to one of them. */
export const BackupsSection = observer(({ session }: { readonly session: VaultSession }) => {
  const t = settingsT.backups;
  const locale = getCurrentLanguage();
  const { backups, deviceSettings } = session;
  const [confirming, setConfirming] = useState<ISnapshotEntry | null>(null);
  const [outcome, setOutcome] = useState<TRestoreOutcome | null>(null);
  const { entries } = backups;

  useEffect(() => {
    void backups.refresh();
  }, [backups]);

  const restore = (entry: ISnapshotEntry) => {
    setConfirming(null);
    void backups.restore(entry.id).then(setOutcome);
  };

  return (
    <CardFrame className="flex flex-col gap-4 p-6">
      <h3 className="text-[16px] font-medium text-landing-fg">{t.title}</h3>
      <p className="text-[13px] text-landing-fg-dim">{t.intro}</p>
      <label className="flex items-center gap-3 text-[13px] text-landing-fg">
        {t.kept}
        <Select
          aria-label={t.kept}
          options={BACKUPS_KEPT_CHOICES.map(count => ({
            value: String(count),
            label: t.keptCount(count),
          }))}
          value={String(deviceSettings.settings.backupsKept)}
          onValueChange={value => deviceSettings.update({ backupsKept: Number(value) })}
          locale={locale}
        />
      </label>
      {!isNil(outcome) && outcomeAlert(outcome)}
      {!isNil(entries.fail) && <Alert type="error" message={registryFailureText(entries.fail)} />}
      {entries.value?.length === 0 && <p className="text-[13px] text-landing-fg-dim">{t.none}</p>}
      {!isNil(entries.value) && entries.value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.value.map(entry => (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 text-[13px]">
              <span className="font-mono text-landing-fg">{whenText(entry)}</span>
              <span className="text-landing-fg-dim">{t.reasons[entry.reason]}</span>
              <span className="text-landing-fg-faint">{sizeText(entry.size, locale)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                disabled={backups.restoring || session.readOnly}
                onClick={() => setConfirming(entry)}
              >
                {t.restore}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!isNil(confirming)}
        title={t.restoreTitle(isNil(confirming) ? '' : whenText(confirming))}
        description={t.restoreMessage}
        confirmLabel={t.restore}
        cancelLabel={settingsT.cancel}
        tone="danger"
        onConfirm={() => {
          if (!isNil(confirming)) {
            restore(confirming);
          }
        }}
        onCancel={() => setConfirming(null)}
      />
    </CardFrame>
  );
});
