import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { isNil } from 'lodash-es';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ICardRow } from '@frozik/vault-app/document/application/card-row';

import { CardIcon } from '../card-icon/CardIcon';
import { GAP, GUTTER, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { RowSlide } from '../kit/RowSlide';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { RowQuickActions } from './RowQuickActions';

/** A row is a touch target with room for two lines. */
const ROW_HEIGHT = 64;
const BADGE_ICON_SIZE = 14;
const MORE_ICON_SIZE = 22;

/**
 * One card of the list: the title and marks, and the login or a masked number — never a secret.
 * Its ⋯ slides the whole row left, the ⋯ with it, onto the quick actions that lie behind its end;
 * the ⋯ again, a long press or a tap on the row slides it back.
 */
export const CardRow = memo(function CardRow({
  row,
  siteIcon,
  actionsOpen,
  onOpen,
  onActions,
}: {
  readonly row: ICardRow;
  readonly siteIcon: Uint8Array<ArrayBuffer> | null;
  /** The row slid aside for its quick actions. */
  readonly actionsOpen: boolean;
  readonly onOpen: () => void;
  /** The ⋯ or a long press: slides the quick actions out, or back in. */
  readonly onActions: () => void;
}) {
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const t = vaultTexts.list;
  const { card } = row;
  const title = card.title === '' ? t.untitled : card.title;
  const more = (
    <Pressable
      testID="row-actions"
      accessibilityRole="button"
      accessibilityLabel={vaultTexts.phone.cardActions(title)}
      accessibilityState={{ expanded: actionsOpen }}
      onPress={onActions}
      style={styles.more}
    >
      <MaterialIcons name="more-vert" size={MORE_ICON_SIZE} color={palette.fgDim} />
    </Pressable>
  );
  return (
    <RowSlide open={actionsOpen} behind={<RowQuickActions card={card} />} showing={card.id}>
      <Pressable
        testID="card-row"
        accessibilityRole="link"
        onPress={actionsOpen ? onActions : onOpen}
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
            {row.hasFiles && (
              <MaterialIcons
                testID="row-has-files"
                name="attach-file"
                size={BADGE_ICON_SIZE}
                color={palette.fgDim}
                accessibilityLabel={t.badges.files}
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
        {more}
      </Pressable>
    </RowSlide>
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
