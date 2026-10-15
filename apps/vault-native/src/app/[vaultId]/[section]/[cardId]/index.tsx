import { useLocalSearchParams } from 'expo-router';

import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import type { TCardId } from '@frozik/vault/model/ids';

import { CardPage } from '../../../../ui/card/CardPage';

export default function Card() {
  const { section, cardId } = useLocalSearchParams<{ section: TVaultSection; cardId: TCardId }>();
  return <CardPage section={section} cardId={cardId} />;
}
