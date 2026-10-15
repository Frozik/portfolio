import { useLocalSearchParams } from 'expo-router';

import { CardListScreen } from '../../ui/list/CardListScreen';

export default function AllCards() {
  const { search } = useLocalSearchParams<{ search?: string }>();
  return <CardListScreen section="all" searching={search === '1'} />;
}
