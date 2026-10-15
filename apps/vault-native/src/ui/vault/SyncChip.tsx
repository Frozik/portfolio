import { observer } from 'mobx-react-lite';
import { StyleSheet, Text } from 'react-native';

import type { CloudLink } from '@frozik/vault-app/cloud/application/CloudLink';
import { cloudStatusText } from '@frozik/vault-app/texts/cloud/cloud-wording';

import { TEXT_SIZE } from '../kit/metrics';
import { useCloudTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/** The cloud's state in a word. */
export const SyncChip = observer(function SyncChip({ cloud }: { readonly cloud: CloudLink }) {
  const palette = usePalette();
  const texts = { cloud: useCloudTexts(), vault: useVaultTexts() };
  const { status } = cloud;
  if (status.kind === 'none') {
    return null;
  }
  const trouble = status.kind === 'stopped' || status.kind === 'unreachable';
  return (
    <Text
      testID="cloud-status"
      numberOfLines={1}
      style={[styles.chip, { color: trouble ? palette.danger : palette.fgFaint }]}
    >
      {cloudStatusText(texts, status)}
    </Text>
  );
});

const styles = StyleSheet.create({
  chip: { fontSize: TEXT_SIZE.caption, maxWidth: 160 },
});
