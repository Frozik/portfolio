import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { IVaultCard } from '@frozik/vault/model/card';
import { CARD_SORTS } from '@frozik/vault/model/card-sort';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cardRowOf } from '@frozik/vault-app/document/application/card-row';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { Button } from '../kit/Button';
import { GAP, GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useEditorTexts, useTemplateTranslator, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';
import { CardRow } from './CardRow';
import { CardStrip } from './CardStrip';
import { NewCardDialog } from './NewCardDialog';
import { RowActions } from './RowActions';
import { sectionLabelOf } from './section-label';
import { SectionSheet } from './SectionSheet';

const paths = createVaultPaths('');
const CHEVRON_SIZE = 20;

/** A section of the vault: its name (the sections sheet behind it), the sort, the search, the strips, the cards. */
export const CardListScreen = observer(function CardListScreen({
  section,
  searching,
}: {
  readonly section: TVaultSection;
  /** Opened from the Search tab: the field takes the keyboard at once. */
  readonly searching: boolean;
}) {
  const session = useSession();
  const router = useRouter();
  const palette = usePalette();
  const t = useVaultTexts();
  const [sheetOpen, setSheetOpen] = useState(false);
  const search = useRef<TextInput>(null);
  const [actionsFor, setActionsFor] = useState<IVaultCard | null>(null);
  const [choosingTemplate, setChoosingTemplate] = useState(false);
  const translate = useTemplateTranslator();
  const editorTexts = useEditorTexts();
  const { view, vaultKey } = session;
  useEffect(() => {
    view.show(section);
  }, [view, section]);
  useEffect(() => {
    if (searching) {
      search.current?.focus();
    }
  }, [searching]);
  const current = view.sections.find(entry => entry.section === view.section);
  const open = (card: IVaultCard): void => router.push(paths.card(vaultKey, view.section, card.id));
  const cards = view.visibleCards;
  const showStrips = view.section === 'all' && view.query === '';
  const nothingFound = view.query !== '';

  return (
    <View testID="card-list-screen" style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Pressable
            testID="open-sections"
            accessibilityRole="button"
            onPress={() => setSheetOpen(true)}
            style={styles.sectionButton}
          >
            <Text style={[styles.section, { color: palette.fg }]}>
              {isNil(current) ? t.sections.all : sectionLabelOf(t, current)}
            </Text>
            <MaterialIcons name="expand-more" size={CHEVRON_SIZE} color={palette.fg} />
          </Pressable>
          {!session.readOnly && (
            <Pressable
              testID="new-card"
              accessibilityRole="button"
              accessibilityLabel={editorTexts.newCard}
              accessibilityState={{ disabled: !session.editing.canStart }}
              disabled={!session.editing.canStart}
              onPress={() => setChoosingTemplate(true)}
              style={[styles.newCard, !session.editing.canStart && styles.unavailable]}
            >
              <MaterialIcons name="add" size={CHEVRON_SIZE + 4} color={palette.accent} />
            </Pressable>
          )}
        </View>
        <TextField
          testID="search"
          label={t.list.search}
          value={view.query}
          onChangeText={view.setQuery}
          inputRef={search}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sorts}
        >
          {CARD_SORTS.map(sort => {
            const chosen = view.sort === sort;
            return (
              <Pressable
                key={sort}
                testID={`sort-${sort}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen }}
                onPress={() => view.setSort(sort)}
                style={[styles.chip, { borderColor: chosen ? palette.accent : palette.line }]}
              >
                <Text
                  style={{ color: chosen ? palette.fg : palette.fgDim, fontSize: TEXT_SIZE.small }}
                >
                  {t.list.sorts[sort]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {cards.length === 0 ? (
        <View testID="no-cards" style={styles.empty}>
          <Text style={{ color: palette.fgDim, fontSize: TEXT_SIZE.body }}>
            {nothingFound ? t.list.nothingFound : t.list.empty}
          </Text>
          {nothingFound && view.section !== 'archive' && (
            <Button
              variant="secondary"
              label={t.shortcuts.searchArchive}
              onPress={() => router.push(paths.section(vaultKey, 'archive'))}
            />
          )}
          {!nothingFound && session.document.cards.size === 0 && !session.readOnly && (
            <>
              <Button
                testID="empty-new-card"
                label={editorTexts.newCard}
                disabled={!session.editing.canStart}
                onPress={() => setChoosingTemplate(true)}
              />
              <Button
                testID="empty-import"
                variant="secondary"
                label={t.list.importCards}
                onPress={() => router.navigate(paths.settings(vaultKey))}
              />
            </>
          )}
        </View>
      ) : (
        <FlashList
          testID="card-list"
          accessibilityLabel={t.list.label}
          data={cards}
          keyExtractor={card => card.id}
          ListHeaderComponent={
            showStrips ? (
              <View style={styles.strips}>
                <CardStrip
                  testID="recent-strip"
                  title={t.phone.recent}
                  cards={session.recent.cards}
                  iconOf={view.siteIconOf}
                  onOpen={open}
                />
                <CardStrip
                  testID="favorites-strip"
                  title={t.phone.favorites}
                  cards={view.favorites}
                  iconOf={view.siteIconOf}
                  onOpen={open}
                />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <CardRow
              row={cardRowOf(item, view.expiryOf(item))}
              siteIcon={view.siteIconOf(item)}
              onOpen={() => open(item)}
              onActions={() => setActionsFor(item)}
            />
          )}
        />
      )}
      {choosingTemplate && (
        <NewCardDialog
          choices={view.templateChoices}
          onClose={() => setChoosingTemplate(false)}
          onCreate={templateId => {
            setChoosingTemplate(false);
            const created = session.editing.startCreating(templateId, translate);
            if (!isNil(created)) {
              router.push(paths.card(vaultKey, view.section, created));
            }
          }}
        />
      )}
      {!isNil(actionsFor) && <RowActions card={actionsFor} onClose={() => setActionsFor(null)} />}
      <SectionSheet
        view={view}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={picked => {
          setSheetOpen(false);
          router.navigate(
            picked === 'all' ? paths.vault(vaultKey) : paths.section(vaultKey, picked)
          );
        }}
      />
    </View>
  );
});

const UNAVAILABLE_OPACITY = 0.4;

const styles = StyleSheet.create({
  unavailable: { opacity: UNAVAILABLE_OPACITY },
  screen: { flex: 1 },
  top: { gap: 8, paddingHorizontal: GUTTER, paddingTop: GAP, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newCard: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionButton: {
    minHeight: TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  section: { fontSize: TEXT_SIZE.heading, fontWeight: '600' },
  sorts: { gap: 8 },
  chip: {
    minHeight: TOUCH_SIZE,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: GAP,
    justifyContent: 'center',
  },
  strips: { gap: GAP, paddingVertical: 8 },
  empty: { gap: GAP, padding: GUTTER, alignItems: 'flex-start' },
});
