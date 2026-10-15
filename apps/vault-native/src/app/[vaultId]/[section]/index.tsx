import { useLocalSearchParams } from 'expo-router';

import { parseVaultPage } from '@frozik/vault-app/navigation/vault-paths';

import { CardListScreen } from '../../../ui/list/CardListScreen';
import { PageNotFound } from '../../../ui/vault/PageNotFound';

export default function Section() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const page = parseVaultPage(section);
  return page.kind === 'section' ? (
    <CardListScreen section={page.section} searching={false} />
  ) : (
    <PageNotFound />
  );
}
