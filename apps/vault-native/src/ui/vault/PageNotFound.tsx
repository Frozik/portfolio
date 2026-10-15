import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { BackLink } from '../kit/BackLink';
import { GUTTER } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { useVaultTexts } from '../texts';
import { useSession } from './session-context';

const paths = createVaultPaths('');

/** An address inside an open vault that names no page: said, never redirected, with the way to the list. */
export function PageNotFound() {
  const router = useRouter();
  const { vaultKey } = useSession();
  const t = useVaultTexts();
  return (
    <View style={styles.page}>
      <BackLink
        testID="back-to-list"
        label={t.card.back}
        onPress={() => router.dismissTo(paths.vault(vaultKey))}
      />
      <Notice testID="page-not-found" tone="caution" message={t.notFound.page} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: GUTTER },
});
