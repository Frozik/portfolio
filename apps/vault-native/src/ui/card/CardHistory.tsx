import { formatDateTimeLocal } from '@frozik/utils/date/format';
import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import { diffCardStates } from '@frozik/vault/model/card-diff';
import type { TCardId } from '@frozik/vault/model/ids';
import { cardState } from '@frozik/vault/model/revision-edits';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { restore } from '@frozik/vault-app/document/application/card-actions';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import { changeKey, changeText } from '@frozik/vault-app/texts/document/change-wording';

import { BackLink } from '../kit/BackLink';
import { Button } from '../kit/Button';
import { GAP, GUTTER, RADIUS, TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { useEditorTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

const paths = createVaultPaths('');

/**
 * A card's earlier versions, newest first: when each was saved and how it
 * differs from the card now — labels only, never a secret's value — and
 * "restore", which is a new edit: the replaced version joins the history.
 */
export const CardHistory = observer(function CardHistory({
  section,
  cardId,
}: {
  readonly section: TVaultSection;
  readonly cardId: TCardId;
}) {
  const session = useSession();
  const router = useRouter();
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const editorTexts = useEditorTexts();
  const t = vaultTexts.history;
  const [restored, setRestored] = useState(false);
  const page = useRef<ScrollView>(null);
  const card = session.document.cards.get(cardId);
  const back = (): void => router.dismissTo(paths.card(session.vaultKey, section, cardId));
  if (isNil(card)) {
    return (
      <View style={styles.page}>
        <BackLink testID="history-back" label={t.back} onPress={back} />
        <Notice tone="caution" message={vaultTexts.phone.cardNotFound} />
      </View>
    );
  }
  const current = cardState(card);
  return (
    <ScrollView ref={page} testID="card-history" contentContainerStyle={styles.page}>
      <BackLink testID="history-back" label={t.back} onPress={back} />
      <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
        {t.title(card.title === '' ? vaultTexts.list.untitled : card.title)}
      </Text>
      {restored && <Notice testID="restored" message={t.restored} />}
      {card.history.length === 0 && <Text style={{ color: palette.fgFaint }}>{t.empty}</Text>}
      {card.history.map(revision => {
        const changes = diffCardStates(current, revision.snapshot);
        return (
          <View
            key={`${revision.at.wallMs}:${revision.at.counter}:${revision.at.node}`}
            testID="revision"
            style={[
              styles.revision,
              { borderColor: palette.line, backgroundColor: palette.bgCard },
            ]}
          >
            <Text style={[styles.when, { color: palette.fg }]}>
              {t.savedAt(formatDateTimeLocal(millisecondsToISO8601(revision.at.wallMs)))}
            </Text>
            <Text style={[styles.small, { color: palette.fgFaint }]}>
              {changes.length === 0 ? t.same : t.differs}
            </Text>
            {changes.map(change => (
              <Text key={changeKey(change)} style={[styles.small, { color: palette.fgDim }]}>
                • {changeText(editorTexts, change)}
              </Text>
            ))}
            {!session.readOnly && (
              <Button
                testID="restore-revision"
                variant="secondary"
                label={t.restore}
                onPress={() => {
                  session.transact(restore(card.id, revision.at));
                  setRestored(true);
                  page.current?.scrollTo({ y: 0 });
                }}
              />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  page: { gap: GAP, padding: GUTTER },
  title: { fontSize: TEXT_SIZE.heading, fontWeight: '600' },
  revision: { gap: 6, borderWidth: 1, borderRadius: RADIUS, padding: GAP },
  when: { fontSize: TEXT_SIZE.small, fontWeight: '500' },
  small: { fontSize: TEXT_SIZE.caption },
});
