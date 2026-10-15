import { useLocalSearchParams } from 'expo-router';

import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import type { TCardId } from '@frozik/vault/model/ids';

import { CardHistory } from '../../../../ui/card/CardHistory';

export default function History() {
  const { section, cardId } = useLocalSearchParams<{ section: TVaultSection; cardId: TCardId }>();
  return <CardHistory section={section} cardId={cardId} />;
}
