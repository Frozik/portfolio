import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TBackupInterval } from '@frozik/vault-app/device/domain/backup-interval';
import { BACKUP_INTERVALS } from '@frozik/vault-app/device/domain/backup-interval';
import type { VaultBackupFolder } from '@frozik/vault-app/interchange/application/VaultBackupFolder';
import { snapshotSizeText } from '@frozik/vault-app/texts/vault/status-wording';

import { BottomSheet } from '../kit/BottomSheet';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { FieldButton } from '../kit/FieldButton';
import { IconButton } from '../kit/IconButton';
import { GAP, GUTTER, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { Select } from '../kit/Select';
import { useLanguage, useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

const NEVER = 'never';

function intervalKey(interval: TBackupInterval): string {
  return interval === null ? NEVER : String(interval);
}

const BackupFiles = observer(function BackupFiles({
  backups,
}: {
  readonly backups: VaultBackupFolder;
}) {
  const palette = usePalette();
  const language = useLanguage();
  const t = useSettingsTexts().backupFolder;
  const { listing } = backups;
  if (listing.kind === 'loading') {
    return <Busy label={t.files} />;
  }
  if (listing.kind === 'unavailable') {
    return <Notice testID="backup-files-unavailable" tone="error" message={t.unavailable} />;
  }
  if (listing.files.length === 0) {
    return (
      <Text testID="backup-files-empty" style={[styles.empty, { color: palette.fgFaint }]}>
        {t.empty}
      </Text>
    );
  }
  const when = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <View testID="backup-files">
      {listing.files.map(file => (
        <View
          key={file.name}
          testID="backup-file"
          style={[styles.file, { borderBottomColor: palette.lineSoft }]}
        >
          <View style={styles.fileText}>
            <Text testID="backup-file-name" style={[styles.name, { color: palette.fg }]}>
              {file.name}
            </Text>
            <Text style={[styles.meta, { color: palette.fgDim }]}>
              {when.format(file.modifiedAt)} · {snapshotSizeText(file.size, language)}
            </Text>
          </View>
          <IconButton
            testID="backup-file-share"
            icon="share"
            label={t.share(file.name)}
            onPress={() => void backups.share(file.name)}
          />
          <IconButton
            testID="backup-file-remove"
            icon="delete-outline"
            label={t.remove(file.name)}
            onPress={() => void backups.remove(file.name)}
          />
        </View>
      ))}
    </View>
  );
});

/**
 * Copies of the vault in a folder on this phone: how often one is made by itself, the folder and
 * its copies (shared to another app or deleted), and one made now.
 */
export const BackupSection = observer(function BackupSection() {
  const session = useSession();
  const palette = usePalette();
  const language = useLanguage();
  const t = useSettingsTexts();
  const [backups] = useState(() => session.flows.backupFolderOf());
  const [filesOpen, setFilesOpen] = useState(false);
  useEffect(() => {
    void backups?.refresh();
    return () => backups?.dispose();
  }, [backups]);
  if (isNil(backups)) {
    return null;
  }
  const { making, lastBackupAt } = backups;
  return (
    <>
      <Select
        testID="backup-interval"
        label={t.backupFolder.interval}
        options={BACKUP_INTERVALS.map(interval => ({
          value: intervalKey(interval),
          label: interval === null ? t.backupFolder.never : t.backupFolder.every(interval),
        }))}
        value={intervalKey(backups.interval)}
        onChange={value =>
          backups.setInterval(
            BACKUP_INTERVALS.find(interval => intervalKey(interval) === value) ?? null
          )
        }
      />
      <FieldButton
        testID="backup-location"
        label={t.backupFolder.location}
        value={backups.location}
        icon="folder-open"
        cut="start"
        onPress={() => {
          void backups.refresh();
          setFilesOpen(true);
        }}
      />
      <Text style={[styles.hint, { color: palette.fgFaint }]}>{t.backupFolder.removedWithApp}</Text>
      {backups.leavesOutBigFiles && (
        <Text style={[styles.hint, { color: palette.fgFaint }]}>{t.backups.file.bigFiles}</Text>
      )}
      {lastBackupAt !== null && (
        <Text testID="backup-last" style={[styles.hint, { color: palette.fgDim }]}>
          {t.backupFolder.last(
            new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
              lastBackupAt
            )
          )}
        </Text>
      )}
      <Button
        testID="backup-now"
        icon="backup"
        label={t.backupFolder.now}
        disabled={making.kind === 'making'}
        onPress={() => void backups.backUpNow()}
      />
      {making.kind === 'making' && <Busy label={t.backupFolder.now} />}
      {making.kind === 'made' && (
        <Notice testID="backup-made" tone="info" message={t.backupFolder.made(making.name)} />
      )}
      {making.kind === 'failed' && (
        <Notice testID="backup-failed" tone="error" message={t.backupFolder.failed} />
      )}
      <BottomSheet
        testID="backup-files-sheet"
        open={filesOpen}
        title={t.backupFolder.files}
        onClose={() => setFilesOpen(false)}
      >
        <View style={styles.sheet}>
          <BackupFiles backups={backups} />
        </View>
      </BottomSheet>
    </>
  );
});

const styles = StyleSheet.create({
  hint: { fontSize: TEXT_SIZE.small },
  empty: { fontSize: TEXT_SIZE.small, paddingVertical: GAP },
  sheet: { paddingHorizontal: GUTTER },
  file: {
    minHeight: TOUCH_SIZE + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileText: { flex: 1, gap: 2, paddingVertical: 8 },
  name: { fontSize: TEXT_SIZE.body },
  meta: { fontSize: TEXT_SIZE.small },
});
