import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import { storageFailureText } from '@frozik/vault-app/texts/vault/storage-failure-wording';

import { useAppModel } from '../app-model';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { GAP, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const paths = createVaultPaths('');
const DELETE_ICON_SIZE = 22;

function VaultRow({
  vault,
  open,
  onDelete,
}: {
  readonly vault: IKnownVault;
  readonly open: boolean;
  readonly onDelete: () => void;
}) {
  const router = useRouter();
  const palette = usePalette();
  const t = useVaultTexts();
  return (
    <View style={[styles.row, { borderColor: palette.line, backgroundColor: palette.bgCard }]}>
      <Pressable
        testID="vault-row"
        accessibilityRole="link"
        onPress={() => router.push(paths.vault(vault.vaultKey))}
        style={styles.open}
      >
        <Text numberOfLines={1} style={[styles.name, { color: palette.fg }]}>
          {vault.name}
        </Text>
        {vault.description.length > 0 && (
          <Text numberOfLines={2} style={[styles.detail, { color: palette.fgDim }]}>
            {vault.description}
          </Text>
        )}
        {open && (
          <Text testID="vault-open" style={[styles.caption, { color: palette.accent }]}>
            {t.deviceVaults.openNow}
          </Text>
        )}
        {vault.unsyncedChanges && (
          <Text style={[styles.caption, { color: palette.caution }]}>
            {t.deviceVaults.unsynced}
          </Text>
        )}
      </Pressable>
      <Pressable
        testID="vault-delete"
        accessibilityRole="button"
        accessibilityLabel={t.deviceVaults.delete(vault.name)}
        onPress={onDelete}
        style={styles.delete}
      >
        <MaterialIcons name="delete-outline" size={DELETE_ICON_SIZE} color={palette.fgDim} />
      </Pressable>
    </View>
  );
}

/** The vaults this phone knows, open before any unlock: names and descriptions only. */
export const VaultList = observer(function VaultList() {
  const { app } = useAppModel();
  const palette = usePalette();
  const t = useVaultTexts();
  const [deleting, setDeleting] = useState<IKnownVault | null>(null);
  const { vaults } = app.registry;
  if (!isNil(vaults.fail)) {
    return <Notice tone="error" message={storageFailureText(t, vaults.fail)} />;
  }
  if (isNil(vaults.value)) {
    return <Busy label={t.deviceVaults.title} />;
  }
  if (vaults.value.length === 0) {
    return (
      <Text testID="no-vaults" style={[styles.detail, { color: palette.fgDim }]}>
        {t.deviceVaults.empty}
      </Text>
    );
  }
  return (
    <View testID="vault-list" style={styles.list}>
      {vaults.value.map(vault => (
        <VaultRow
          key={vault.vaultKey}
          vault={vault}
          open={app.session?.vaultKey === vault.vaultKey}
          onDelete={() => setDeleting(vault)}
        />
      ))}
      {!isNil(deleting) && (
        <Dialog
          open
          title={t.deviceVaults.deleteTitle(deleting.name)}
          onClose={() => setDeleting(null)}
        >
          <Text style={[styles.detail, { color: palette.fgDim }]}>
            {t.deviceVaults.deleteMessagePhone}
          </Text>
          <Button
            testID="confirm-delete-vault"
            variant="danger"
            label={t.deviceVaults.deleteConfirm}
            onPress={() => {
              setDeleting(null);
              void app.forgetVault(deleting.vaultKey);
            }}
          />
          <Button
            variant="secondary"
            label={t.deviceVaults.cancel}
            onPress={() => setDeleting(null)}
          />
        </Dialog>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  list: { gap: GAP },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: RADIUS },
  open: { flex: 1, minHeight: TOUCH_SIZE + 8, padding: 14, gap: 2 },
  delete: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: TEXT_SIZE.body, fontWeight: '500' },
  detail: { fontSize: TEXT_SIZE.small },
  caption: { fontSize: TEXT_SIZE.caption },
});
