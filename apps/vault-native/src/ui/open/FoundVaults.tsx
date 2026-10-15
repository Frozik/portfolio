import type { IStorageObjectStat, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../kit/Button';
import { GAP, TEXT_SIZE } from '../kit/metrics';
import { useCloudTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/** The vaults found in the folder, each to open; an empty folder offers a new vault made there. */
export function FoundVaults({
  vaults,
  onOpen,
  onCreate,
}: {
  readonly vaults: readonly IStorageObjectStat[];
  readonly onOpen: (path: TStoragePath) => void;
  readonly onCreate: () => void;
}) {
  const palette = usePalette();
  const t = useCloudTexts().section;
  if (vaults.length === 0) {
    return (
      <>
        <Text testID="no-vaults-here" style={[styles.text, { color: palette.fgDim }]}>
          {t.noVaultsToOpen}
        </Text>
        <Button testID="create-here" label={t.createHere} onPress={onCreate} />
      </>
    );
  }
  return (
    <View style={styles.list}>
      {vaults.map(vault => (
        <View key={vault.path} style={styles.row}>
          <Text testID="found-vault" style={[styles.path, { color: palette.fg }]}>
            {vault.path}
          </Text>
          <Button testID="open-found-vault" label={t.open} onPress={() => onOpen(vault.path)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: GAP },
  row: { gap: 8 },
  text: { fontSize: TEXT_SIZE.small },
  path: { fontSize: TEXT_SIZE.body },
});
