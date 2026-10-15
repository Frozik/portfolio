import { useLocalSearchParams } from 'expo-router';

import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import { parseVaultPage } from '@frozik/vault-app/navigation/vault-paths';
import type { TCardId } from '@frozik/vault/model/ids';

import History from '../../app/[vaultId]/[section]/[cardId]/history';
import VaultLayout from '../../app/[vaultId]/_layout';
import Audit from '../../app/[vaultId]/audit';
import Settings from '../../app/[vaultId]/settings';
import { CardPage } from '../card/CardPage';
import { CardListScreen } from '../list/CardListScreen';
import { StartScreen } from '../start/StartScreen';
import { PageNotFound } from '../vault/PageNotFound';

function AllCards() {
  const { search } = useLocalSearchParams<{ search?: string }>();
  return <CardListScreen section="all" searching={search === '1'} />;
}

function Card() {
  const { section, cardId } = useLocalSearchParams<{ section: TVaultSection; cardId: TCardId }>();
  return <CardPage section={section} cardId={cardId} />;
}

function Section() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const page = parseVaultPage(section);
  return page.kind === 'section' ? (
    <CardListScreen section={page.section} searching={false} />
  ) : (
    <PageNotFound />
  );
}

/** The app's own vault routes under its start screen; index routes are named by what they render. */
export const OPEN_VAULT_ROUTES = {
  index: () => <StartScreen />,
  '[vaultId]/_layout': VaultLayout,
  '[vaultId]/index': AllCards,
  '[vaultId]/[section]/index': Section,
  '[vaultId]/[section]/[cardId]/index': Card,
  '[vaultId]/[section]/[cardId]/history': History,
  '[vaultId]/audit': Audit,
  '[vaultId]/settings': Settings,
};
