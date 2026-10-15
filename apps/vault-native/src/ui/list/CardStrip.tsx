import type { IVaultCard } from '@frozik/vault/model/card';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardIcon } from '../card-icon/CardIcon';
import { GAP, GUTTER, TEXT_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const ITEM_WIDTH = 72;

/** A row of cards one tap away above the list: the favourites, or those opened lately. */
export function CardStrip({
  title,
  cards,
  testID,
  iconOf,
  onOpen,
}: {
  readonly title: string;
  readonly cards: readonly IVaultCard[];
  readonly testID: string;
  readonly iconOf: (card: IVaultCard) => Uint8Array<ArrayBuffer> | null;
  readonly onOpen: (card: IVaultCard) => void;
}) {
  const palette = usePalette();
  const t = useVaultTexts().list;
  if (cards.length === 0) {
    return null;
  }
  return (
    <View accessibilityLabel={title} style={styles.strip}>
      <Text style={[styles.heading, { color: palette.fgFaint }]}>{title}</Text>
      <ScrollView
        testID={testID}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.items}
      >
        {cards.map(card => (
          <Pressable
            key={card.id}
            testID={`${testID}-card`}
            accessibilityRole="link"
            onPress={() => onOpen(card)}
            style={styles.item}
          >
            <CardIcon card={card} siteIcon={iconOf(card)} />
            <Text numberOfLines={2} style={[styles.title, { color: palette.fg }]}>
              {card.title === '' ? t.untitled : card.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 6 },
  heading: { fontSize: TEXT_SIZE.caption, paddingHorizontal: GUTTER },
  items: { gap: GAP, paddingHorizontal: GUTTER },
  item: { width: ITEM_WIDTH, alignItems: 'center', gap: 4 },
  title: { fontSize: TEXT_SIZE.caption, textAlign: 'center' },
});
