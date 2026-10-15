import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { TCardId, TTabId } from '@frozik/vault/model/ids';
import { linkedCardIds } from '@frozik/vault/model/link-edits';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { readCard } from '@frozik/vault-app/document/application/card-reading';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { CardIcon } from '../card-icon/CardIcon';
import { BackLink } from '../kit/BackLink';
import { Button } from '../kit/Button';
import { GAP, GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { useEditorTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useOpenLink } from '../useOpenLink';
import { useSession } from '../vault/session-context';
import { BankCardFace } from './BankCardFace';
import { CardBanners } from './CardBanners';
import { FieldView } from './FieldView';
import { ProtectedGate } from './ProtectedGate';

const paths = createVaultPaths('');
const ICON_SIZE = 20;

/** A card as read, full screen: back to its section, its marks, its fields by tab, the cards it belongs with. */
export const CardScreen = observer(function CardScreen({
  section,
  cardId,
}: {
  readonly section: TVaultSection;
  readonly cardId: TCardId;
}) {
  const session = useSession();
  const router = useRouter();
  const palette = usePalette();
  const openLink = useOpenLink();
  const t = useVaultTexts();
  const editorTexts = useEditorTexts();
  const [tabId, setTabId] = useState<TTabId | null>(null);
  const [openingGate, setOpeningGate] = useState(false);
  const card = session.document.cards.get(cardId);
  const exists = !isNil(card);
  useEffect(() => {
    session.reveal.hideAll();
    if (exists) {
      session.recent.opened(cardId);
    }
  }, [session, cardId, exists]);

  const back = (
    <BackLink
      testID="back-to-list"
      label={t.card.back}
      onPress={() =>
        router.dismissTo(
          section === 'all'
            ? paths.vault(session.vaultKey)
            : paths.section(session.vaultKey, section)
        )
      }
    />
  );
  if (isNil(card)) {
    return (
      <View style={styles.page}>
        {back}
        <Notice tone="caution" message={t.phone.cardNotFound} />
      </View>
    );
  }
  const shut = card.protected && !session.protectedGate.isOpen;
  const reading = readCard(card, shut);
  const shownTab = reading.tabs.find(tab => tab.id === tabId) ?? reading.tabs[0];
  const linked = linkedCardIds(session.document, card.id).flatMap(id => {
    const other = session.document.cards.get(id);
    return isNil(other) ? [] : [other];
  });
  return (
    <ScrollView testID="card" contentContainerStyle={styles.page}>
      {back}
      <View style={styles.header}>
        <CardIcon card={card} siteIcon={session.view.siteIconOf(card)} />
        <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
          {card.title === '' ? t.list.untitled : card.title}
        </Text>
        {card.favorite && (
          <MaterialIcons
            name="star"
            size={ICON_SIZE}
            color={palette.caution}
            accessibilityLabel={t.list.badges.favorite}
          />
        )}
        {card.protected && (
          <MaterialIcons
            name="lock"
            size={ICON_SIZE}
            color={palette.fgDim}
            accessibilityLabel={t.list.badges.protected}
          />
        )}
      </View>
      {!session.readOnly && !shut && (
        <Button
          testID="edit-card"
          variant="secondary"
          label={editorTexts.edit}
          disabled={!session.editing.canStart}
          onPress={() => session.editing.startEditing(card.id)}
        />
      )}
      <Button
        testID="card-history"
        variant="secondary"
        label={t.history.open}
        onPress={() => router.push(paths.history(session.vaultKey, section, card.id))}
      />
      <CardBanners card={card} view={session.view} />
      {reading.bankCard && <BankCardFace card={card} />}
      {shut && (
        <>
          <Notice message={t.card.protectedNotice} />
          <Button
            testID="open-protected"
            label={t.protectedGate.open}
            onPress={() => setOpeningGate(true)}
          />
        </>
      )}
      {!isNil(reading.changePasswordUrl) && (
        <Button
          testID="change-password"
          variant="secondary"
          label={t.cardExtras.changePassword}
          onPress={() => openLink(reading.changePasswordUrl ?? '')}
        />
      )}
      {reading.tabs.length > 1 && (
        <ScrollView
          horizontal
          accessibilityRole="tablist"
          accessibilityLabel={t.card.tabs}
          contentContainerStyle={styles.tabs}
        >
          {reading.tabs.map(tab => {
            const selected = tab.id === shownTab?.id;
            return (
              <Pressable
                key={tab.id}
                testID={`card-tab-${tab.id}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTabId(tab.id)}
                style={[styles.tab, { borderColor: selected ? palette.accent : palette.line }]}
              >
                <Text style={{ color: selected ? palette.fg : palette.fgDim }}>
                  {tab.title ?? t.card.mainTab}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {!isNil(shownTab) && (
        <View>
          {shownTab.fields.map(field => (
            <FieldView key={field.id} field={field} cardId={card.id} />
          ))}
        </View>
      )}
      {linked.length > 0 && (
        <View testID="linked-cards" style={styles.linked}>
          <Text style={[styles.subheading, { color: palette.fgFaint }]}>{t.cardExtras.linked}</Text>
          {linked.map(other => (
            <Button
              key={other.id}
              variant="secondary"
              label={other.title === '' ? t.list.untitled : other.title}
              onPress={() => router.push(paths.card(session.vaultKey, section, other.id))}
            />
          ))}
        </View>
      )}
      {openingGate && <ProtectedGate onClose={() => setOpeningGate(false)} />}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  page: { gap: GAP, padding: GUTTER },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flexShrink: 1, fontSize: TEXT_SIZE.title, fontWeight: '600' },
  tabs: { gap: 8 },
  tab: {
    minHeight: TOUCH_SIZE,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: GAP,
    justifyContent: 'center',
  },
  linked: { gap: 8 },
  subheading: { fontSize: TEXT_SIZE.caption },
});
