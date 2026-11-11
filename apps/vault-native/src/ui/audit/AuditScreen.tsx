import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AUDIT_CATEGORIES } from '@frozik/vault/audit/audit-report';
import type { TAuditCategory } from '@frozik/vault/audit/audit-report';
import { membersOf } from '@frozik/vault/model/classify-cards';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Checkbox } from '../kit/Checkbox';
import { GAP, GUTTER, TEXT_SIZE } from '../kit/metrics';
import { useAuditTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';
import { AuditGroup } from './AuditGroup';

type TIconName = ComponentProps<typeof MaterialIcons>['name'];

/** Categories where a new password is the fix: their cards get a link to the site's change page. */
const PASSWORD_PROBLEMS: ReadonlySet<TAuditCategory> = new Set(['leaked', 'weak', 'reused', 'old']);

const CATEGORY_LOOKS: Readonly<
  Record<TAuditCategory, { readonly icon: TIconName; readonly tone: 'danger' | 'caution' }>
> = {
  leaked: { icon: 'gpp-bad', tone: 'danger' },
  weak: { icon: 'lock-open', tone: 'danger' },
  reused: { icon: 'repeat', tone: 'danger' },
  'insecure-url': { icon: 'http', tone: 'caution' },
  'no-2fa': { icon: 'phonelink-lock', tone: 'caution' },
  old: { icon: 'history-toggle-off', tone: 'caution' },
  expired: { icon: 'event-busy', tone: 'danger' },
  expiring: { icon: 'schedule', tone: 'caution' },
};

/** The audit: a group per finding with its mark, count and cards; the opt-in breach check; the 2FA Directory credit. */
export const AuditScreen = observer(function AuditScreen() {
  const session = useSession();
  const palette = usePalette();
  const t = useAuditTexts();
  const vaultTexts = useVaultTexts();
  const { report, twoFactorDomains, directoryLoaded } = session.audit;
  const { checkLeaks } = session.deviceSettings.settings;
  const found = AUDIT_CATEGORIES.flatMap(category => {
    const cards = report.byCategory.get(category) ?? [];
    return cards.length === 0 ? [] : [{ category, cards }];
  });
  const duplicates = membersOf(session.view.classification, 'duplicates');
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
      {found.length === 0 && duplicates.length === 0 && (
        <Text testID="audit-clean" style={[styles.text, { color: palette.fg }]}>
          {t.clean}
        </Text>
      )}
      {found.map(({ category, cards }) => (
        <AuditGroup
          key={category}
          testID={`audit-${category}`}
          icon={CATEGORY_LOOKS[category].icon}
          tone={CATEGORY_LOOKS[category].tone}
          title={t.categories[category]}
          cards={cards}
          section="problems"
          offerPasswordChange={PASSWORD_PROBLEMS.has(category)}
        />
      ))}
      {duplicates.length > 0 && (
        <AuditGroup
          testID="audit-duplicates"
          icon="content-copy"
          tone="caution"
          title={vaultTexts.sections.duplicates}
          cards={duplicates}
          section="duplicates"
          offerPasswordChange={false}
        />
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
});
