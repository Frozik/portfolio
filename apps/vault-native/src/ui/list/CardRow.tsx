import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { isNil } from 'lodash-es';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ICardRow } from '@frozik/vault-app/document/application/card-row';

import { CardIcon } from '../card-icon/CardIcon';
import { GAP, GUTTER, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/** A row is a touch target with room for two lines. */
const ROW_HEIGHT = 64;
const BADGE_ICON_SIZE = 14;
const MORE_ICON_SIZE = 22;

/** One card of the list: the title and marks, and the login or a masked number — never a secret. */
export const CardRow = memo(function CardRow({
  row,
  siteIcon,
  onOpen,
  onActions,
}: {
  readonly row: ICardRow;
  readonly siteIcon: Uint8Array<ArrayBuffer> | null;
  readonly onOpen: () => void;
  /** A long press: copy without opening, and the card's marks. */
  readonly onActions: () => void;
}) {
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const t = vaultTexts.list;
  const { card } = row;
  const title = card.title === '' ? t.untitled : card.title;
  return (
    <Pressable
      testID="card-row"
      accessibilityRole="link"
      onPress={onOpen}
      onLongPress={onActions}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: palette.lineSoft },
        pressed && { backgroundColor: palette.bgElevated },
      ]}
    >
      <CardIcon card={card} siteIcon={siteIcon} />
      <View style={styles.text}>
        <View style={styles.line}>
          <Text numberOfLines={1} style={[styles.title, { color: palette.fg }]}>
            {title}
          </Text>
          {card.favorite && (
            <MaterialIcons
              name="star"
              size={BADGE_ICON_SIZE}
              color={palette.caution}
              accessibilityLabel={t.badges.favorite}
            />
          )}
          {card.protected && (
            <MaterialIcons
              name="lock"
              size={BADGE_ICON_SIZE}
              color={palette.fgDim}
              accessibilityLabel={t.badges.protected}
            />
          )}
        </View>
        <View style={styles.line}>
          {!isNil(row.subtitle) && (
            <Text numberOfLines={1} style={[styles.detail, { color: palette.fgFaint }]}>
              {row.subtitle}
            </Text>
          )}
          {!isNil(row.expiry) && (
            <Text
              style={[
                styles.detail,
                { color: row.expiry === 'expired' ? palette.danger : palette.caution },
              ]}
            >
              {t.badges[row.expiry]}
            </Text>
          )}
          {row.hasOneTimeCode && (
            <Text style={[styles.detail, { color: palette.fgFaint }]}>{t.badges.otp}</Text>
          )}
        </View>
      </View>
      <Pressable
        testID="row-actions"
        accessibilityRole="button"
        accessibilityLabel={vaultTexts.phone.cardActions(title)}
        onPress={onActions}
        style={styles.more}
      >
        <MaterialIcons name="more-vert" size={MORE_ICON_SIZE} color={palette.fgDim} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingLeft: GUTTER,
    borderBottomWidth: 1,
  },
  more: { width: TOUCH_SIZE, height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: TEXT_SIZE.body, fontWeight: '500' },
  detail: { flexShrink: 1, fontSize: TEXT_SIZE.caption },
});
