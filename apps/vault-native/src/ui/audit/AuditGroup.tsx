import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { IVaultCard } from '@frozik/vault/model/card';
import { changePasswordUrlOfCard } from '@frozik/vault/model/change-password-url';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardRowOf } from '@frozik/vault-app/document/application/card-row';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { CardIcon } from '../card-icon/CardIcon';
import { CountBadge } from '../kit/CountBadge';
import { GAP, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useAuditTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useOpenLink } from '../useOpenLink';
import { useSession } from '../vault/session-context';

const paths = createVaultPaths('');
const GROUP_ICON_SIZE = 22;
const LINK_ICON_SIZE = 20;

/** One thing the audit found: its mark and name with how many cards, then the cards themselves. */
export const AuditGroup = observer(function AuditGroup({
  testID,
  icon,
  tone,
  title,
  cards,
  section,
  offerPasswordChange,
}: {
  readonly testID: string;
  readonly icon: ComponentProps<typeof MaterialIcons>['name'];
  readonly tone: 'danger' | 'caution';
  readonly title: string;
  readonly cards: readonly IVaultCard[];
  /** The list a card opened from here goes back to. */
  readonly section: TVaultSection;
  /** A new password is the fix: each card links to its site's change page, when it has one. */
  readonly offerPasswordChange: boolean;
}) {
  const session = useSession();
  const router = useRouter();
  const palette = usePalette();
  const openLink = useOpenLink();
  const t = useAuditTexts();
  const untitled = useVaultTexts().list.untitled;
  return (
    <View
      testID={testID}
      style={[styles.group, { borderColor: palette.line, backgroundColor: palette.bgCard }]}
    >
      <View style={styles.header}>
        <MaterialIcons
          name={icon}
          size={GROUP_ICON_SIZE}
          color={tone === 'danger' ? palette.danger : palette.caution}
        />
        <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
          {title}
        </Text>
        <CountBadge count={cards.length} testID={`${testID}-count`} />
      </View>
      {cards.map(card => {
        const changeAt = offerPasswordChange ? changePasswordUrlOfCard(card) : null;
        const { subtitle } = cardRowOf(card, session.view.expiryOf(card));
        return (
          <View key={card.id} style={[styles.card, { borderTopColor: palette.lineSoft }]}>
            <Pressable
              testID="audit-card"
              accessibilityRole="link"
              onPress={() => router.push(paths.card(session.vaultKey, section, card.id))}
              style={styles.open}
            >
              <CardIcon card={card} siteIcon={session.view.siteIconOf(card)} />
              <View style={styles.text}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: palette.fg }]}>
                  {card.title === '' ? untitled : card.title}
                </Text>
                {!isNil(subtitle) && (
                  <Text numberOfLines={1} style={[styles.detail, { color: palette.fgFaint }]}>
                    {subtitle}
                  </Text>
                )}
              </View>
            </Pressable>
            {!isNil(changeAt) && (
              <Pressable
                testID="audit-change-password"
                accessibilityRole="link"
                accessibilityLabel={t.changePassword}
                onPress={() => openLink(changeAt)}
                style={styles.change}
              >
                <MaterialIcons name="open-in-new" size={LINK_ICON_SIZE} color={palette.accent} />
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: GAP, paddingTop: GAP },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: GAP },
  title: { flexShrink: 1, fontSize: TEXT_SIZE.body, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  open: {
    flex: 1,
    minHeight: TOUCH_SIZE + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  text: { flex: 1, gap: 2 },
  cardTitle: { fontSize: TEXT_SIZE.body },
  detail: { fontSize: TEXT_SIZE.caption },
  change: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
});
