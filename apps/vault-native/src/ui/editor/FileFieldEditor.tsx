import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { fileAssetIdsOf } from '@frozik/vault/model/asset-edits';
import type { ICardField } from '@frozik/vault/model/card';
import type { TAssetId } from '@frozik/vault/model/ids';
import type { IAsset } from '@frozik/vault/model/vault-document';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { INewFile, TAttachRefusal } from '@frozik/vault-app/document/domain/new-file';
import { attachRefusalText } from '@frozik/vault-app/texts/vault/status-wording';

import { pickFiles } from '../../device-files/pick-files';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { GAP, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const ICON_SIZE = 18;
/** A file field in the editor: choose files from the phone, and remove one. */
export function FileFieldEditor({
  field,
  assets,
  onAttach,
  onDetach,
}: {
  readonly field: ICardField;
  readonly assets: ReadonlyMap<TAssetId, IAsset>;
  readonly onAttach: (files: readonly INewFile[]) => Promise<readonly TAttachRefusal[]>;
  readonly onDetach: (assetId: TAssetId) => void;
}) {
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const t = vaultTexts.files;
  const [refusals, setRefusals] = useState<readonly TAttachRefusal[]>([]);
  const [attaching, setAttaching] = useState(false);
  const attach = (): void => {
    setAttaching(true);
    void pickFiles(field.value.cardinality === 'list')
      .then(async files => {
        if (files.length > 0) {
          setRefusals(await onAttach(files));
        }
      })
      .finally(() => setAttaching(false));
  };
  return (
    <View style={styles.files}>
      {fileAssetIdsOf(field).map(assetId => {
        const name = assets.get(assetId)?.name ?? assetId;
        return (
          <View key={assetId} style={styles.file}>
            <Text numberOfLines={1} style={[styles.name, { color: palette.fg }]}>
              {name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.remove(name)}
              onPress={() => onDetach(assetId)}
              style={styles.remove}
            >
              <MaterialIcons name="close" size={ICON_SIZE} color={palette.fgDim} />
            </Pressable>
          </View>
        );
      })}
      <Button
        testID="attach-files"
        variant="secondary"
        label={t.choose}
        disabled={attaching}
        onPress={attach}
      />
      {attaching && <Busy label={t.choose} />}
      {refusals.map(refusal => (
        <Text
          key={refusal}
          accessibilityRole="alert"
          style={[styles.name, { color: palette.danger }]}
        >
          {attachRefusalText(vaultTexts, refusal)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  files: { gap: GAP },
  file: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontSize: TEXT_SIZE.small },
  remove: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
});
