import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import { storageFailureText } from '@frozik/vault-app/texts/vault/storage-failure-wording';

import { useAppModel } from '../app-model';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { GAP, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { Screen } from '../kit/Screen';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useBack } from '../useBack';

const paths = createVaultPaths('');

function TargetRow({
  vault,
  open,
  onPick,
}: {
  readonly vault: IKnownVault;
  readonly open: boolean;
  readonly onPick: () => void;
}) {
  const palette = usePalette();
  const t = useVaultTexts();
  return (
    <Pressable
      testID="take-in-vault"
      accessibilityRole="button"
      onPress={onPick}
      style={[styles.row, { borderColor: palette.line, backgroundColor: palette.bgCard }]}
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
        <Text testID="take-in-vault-open" style={[styles.caption, { color: palette.accent }]}>
          {t.deviceVaults.openNow}
        </Text>
      )}
    </Pressable>
  );
}

/** `/import`: another manager's file handed over goes into a vault this phone knows, or into a new one. */
export const TakeInScreen = observer(function TakeInScreen() {
  const { app, pendingImport } = useAppModel();
  const router = useRouter();
  const palette = usePalette();
  const t = useVaultTexts();
  const back = useBack(paths.start());
  const { file } = pendingImport;
  const { vaults } = app.registry;
  const pick = (vaultKey: IKnownVault['vaultKey']): void => {
    pendingImport.aim({ kind: 'vault', vaultKey });
    router.navigate(paths.vault(vaultKey));
  };
  const createNew = (): void => {
    pendingImport.aim({
      kind: 'new',
      known: new Set(vaults.value?.map(vault => vault.vaultKey) ?? []),
    });
    router.push(paths.create());
  };
  const cancel = (): void => {
    pendingImport.drop();
    back();
  };
  return (
    <Screen title={t.phone.takeInTitle} testID="take-in">
      {!isNil(file) && (
        <Text style={[styles.detail, { color: palette.fgDim }]}>
          {t.phone.takeInHint(file.name)}
        </Text>
      )}
      {!isNil(vaults.fail) && <Notice tone="error" message={storageFailureText(t, vaults.fail)} />}
      {isNil(vaults.value) && isNil(vaults.fail) && <Busy label={t.deviceVaults.title} />}
      {!isNil(vaults.value) && vaults.value.length > 0 && (
        <View testID="take-in-vaults" style={styles.list}>
          {vaults.value.map(vault => (
            <TargetRow
              key={vault.vaultKey}
              vault={vault}
              open={app.session?.vaultKey === vault.vaultKey}
              onPick={() => pick(vault.vaultKey)}
            />
          ))}
        </View>
      )}
      <View style={styles.list}>
        <Button
          testID="take-in-new"
          label={t.phone.takeInNew}
          disabled={isNil(file)}
          onPress={createNew}
        />
        <Button
          testID="take-in-cancel"
          variant="secondary"
          label={t.phone.takeInCancel}
          onPress={cancel}
        />
      </View>
    </Screen>
  );
});

const styles = StyleSheet.create({
  list: { gap: GAP },
  row: { minHeight: TOUCH_SIZE + 8, padding: 14, gap: 2, borderWidth: 1, borderRadius: RADIUS },
  name: { fontSize: TEXT_SIZE.body, fontWeight: '500' },
  detail: { fontSize: TEXT_SIZE.small },
  caption: { fontSize: TEXT_SIZE.caption },
});
