import { AUDIT_CATEGORIES } from '@frozik/vault/audit/audit-report';
import type { TAuditCategory } from '@frozik/vault/audit/audit-report';
import type { IVaultCard } from '@frozik/vault/model/card';
import { changePasswordUrlOfCard } from '@frozik/vault/model/change-password-url';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { Button } from '../kit/Button';
import { Checkbox } from '../kit/Checkbox';
import { GAP, GUTTER, RADIUS, TEXT_SIZE } from '../kit/metrics';
import { useAuditTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useOpenLink } from '../useOpenLink';
import { useSession } from '../vault/session-context';

const paths = createVaultPaths('');
/** Categories where a new password is the fix: their cards get a link to the site's change page. */
const PASSWORD_PROBLEMS: ReadonlySet<TAuditCategory> = new Set(['leaked', 'weak', 'reused', 'old']);

const CategoryCards = observer(function CategoryCards({
  category,
  cards,
}: {
  readonly category: TAuditCategory;
  readonly cards: readonly IVaultCard[];
}) {
  const session = useSession();
  const router = useRouter();
  const palette = usePalette();
  const openLink = useOpenLink();
  const t = useAuditTexts();
  const vaultTexts = useVaultTexts();
  return (
    <View
      testID={`audit-${category}`}
      style={[styles.block, { borderColor: palette.line, backgroundColor: palette.bgCard }]}
    >
      <Text accessibilityRole="header" style={[styles.heading, { color: palette.fg }]}>
        {t.categories[category]} · {cards.length}
      </Text>
      {cards.map(card => {
        const changeAt = PASSWORD_PROBLEMS.has(category) ? changePasswordUrlOfCard(card) : null;
        return (
          <View key={card.id} style={styles.card}>
            <Button
              variant="secondary"
              label={card.title || vaultTexts.list.untitled}
              onPress={() => router.push(paths.card(session.vaultKey, 'problems', card.id))}
            />
            {!isNil(changeAt) && (
              <Button
                variant="secondary"
                label={t.changePassword}
                onPress={() => openLink(changeAt)}
              />
            )}
          </View>
        );
      })}
    </View>
  );
});

/** The audit: one block per category with its cards, the opt-in breach check and the 2FA Directory credit. */
export const AuditScreen = observer(function AuditScreen() {
  const session = useSession();
  const palette = usePalette();
  const t = useAuditTexts();
  const { report, twoFactorDomains, directoryLoaded } = session.audit;
  const { checkLeaks } = session.deviceSettings.settings;
  const found = AUDIT_CATEGORIES.flatMap(category => {
    const cards = report.byCategory.get(category) ?? [];
    return cards.length === 0 ? [] : [{ category, cards }];
  });
  return (
    <ScrollView testID="audit" contentContainerStyle={styles.page}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
        {t.title}
      </Text>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.intro}</Text>
      <Checkbox
        testID="check-leaks"
        label={t.checkLeaks}
        checked={checkLeaks}
        onChange={value => session.deviceSettings.update({ checkLeaks: value })}
      />
      <Text style={[styles.small, { color: palette.fgFaint }]}>{t.checkLeaksNote}</Text>
      {found.length === 0 ? (
        <Text testID="audit-clean" style={[styles.text, { color: palette.fg }]}>
          {t.clean}
        </Text>
      ) : (
        found.map(({ category, cards }) => (
          <CategoryCards key={category} category={category} cards={cards} />
        ))
      )}
      {directoryLoaded && (
        <Text testID="two-factor-directory" style={[styles.small, { color: palette.fgFaint }]}>
          {isNil(twoFactorDomains) ? t.directoryMissing : t.twoFactorCredit}
        </Text>
      )}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  page: { gap: GAP, padding: GUTTER },
  title: { fontSize: TEXT_SIZE.title, fontWeight: '600' },
  text: { fontSize: TEXT_SIZE.small },
  small: { fontSize: TEXT_SIZE.caption },
  block: { gap: 8, borderWidth: 1, borderRadius: RADIUS, padding: GAP },
  heading: { fontSize: TEXT_SIZE.body, fontWeight: '500' },
  card: { gap: 6 },
});
