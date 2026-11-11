import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { IVaultCard } from '@frozik/vault/model/card';
import { CARD_SORTS } from '@frozik/vault/model/card-sort';
import type { TCardId } from '@frozik/vault/model/ids';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { cardRowOf } from '@frozik/vault-app/document/application/card-row';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { Button } from '../kit/Button';
import { IconToggle } from '../kit/IconToggle';
import { GAP, GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import type { TLabelEditing } from '../labels/LabelEditor';
import { LabelEditor } from '../labels/LabelEditor';
import { settingsTopicPath } from '../settings/settings-topics';
import { useEditorTexts, useTemplateTranslator, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';
import { VaultBarTools } from '../vault/vault-bar';
import { CardRow } from './CardRow';
import { CardStrip } from './CardStrip';
import { CardSwipe } from './CardSwipe';
import { NewCardDialog } from './NewCardDialog';
import { sectionLabelOf } from './section-label';
import { SectionSheet } from './SectionSheet';

/** Rows drawn beyond each edge, in dp: a fast fling finds them ready instead of blank. */
const DRAW_AHEAD = 1000;
const paths = createVaultPaths('');
const ADD_ICON_SIZE = 24;
/** Below this width the search and the sort share one button, so the section's name keeps room. */
const ROOM_FOR_SEPARATE_TOOLS = 400;

/** A section of the vault: its name (the sections sheet behind it, and behind the Sections tab) and tools in the vault's top row, the search, the sort, the strips, the cards. */
export const CardListScreen = observer(function CardListScreen({
  section,
}: {
  readonly section: TVaultSection;
}) {
  const session = useSession();
  const router = useRouter();
  const palette = usePalette();
  const t = useVaultTexts();
  const [sheetOpen, setSheetOpen] = useState(false);
  const search = useRef<TextInput>(null);
  const [actionsOpenFor, setActionsOpenFor] = useState<TCardId | null>(null);
  const toggleActions = (cardId: TCardId): void =>
    setActionsOpenFor(current => (current === cardId ? null : cardId));
  const [choosingTemplate, setChoosingTemplate] = useState(false);
  const [editingLabel, setEditingLabel] = useState<TLabelEditing | null>(null);
  const translate = useTemplateTranslator();
  const editorTexts = useEditorTexts();
  const { view, vaultKey } = session;
  const narrow = useWindowDimensions().width < ROOM_FOR_SEPARATE_TOOLS;
  useEffect(() => {
    view.show(section);
  }, [view, section]);
  const [searchShown, setSearchShown] = useState(view.query !== '');
  const [sortShown, setSortShown] = useState(false);
  const { sections } = useLocalSearchParams<{ sections?: string }>();
  useEffect(() => {
    if (sections === '1') {
      setSheetOpen(true);
      router.setParams({ sections: undefined });
    }
  }, [sections, router]);
  useEffect(() => {
    if (searchShown) {
      search.current?.focus();
    }
  }, [searchShown]);
  const showSearch = (shown: boolean): void => {
    setSearchShown(shown);
    if (!shown) {
      view.setQuery('');
    }
  };
  const current = view.sections.find(entry => entry.section === view.section);
  const open = (card: IVaultCard): void => router.push(paths.card(vaultKey, view.section, card.id));
  const cards = view.visibleCards;
  const { showRecent, showFavorites } = session.deviceSettings.settings;
  const showStrips = view.section === 'all' && view.query === '' && (showRecent || showFavorites);
  const nothingFound = view.query !== '';

  return (
    <View testID="card-list-screen" style={styles.screen}>
      <VaultBarTools>
        <Pressable
          testID="open-sections"
          accessibilityRole="button"
          onPress={() => setSheetOpen(true)}
          style={styles.sectionButton}
        >
          <Text numberOfLines={1} style={[styles.section, { color: palette.fg }]}>
            {isNil(current) ? t.sections.all : sectionLabelOf(t, current)}
          </Text>
        </Pressable>
        {narrow ? (
          <IconToggle
            testID="toggle-tools"
            icon="tune"
            label={t.list.searchAndSort}
            value={searchShown || sortShown}
            onChange={shown => {
              showSearch(shown);
              setSortShown(shown);
            }}
          />
        ) : (
          <>
            <IconToggle
              testID="toggle-search"
              icon="filter-alt"
              label={t.list.search}
              value={searchShown}
              onChange={showSearch}
            />
            <IconToggle
              testID="toggle-sort"
              icon="sort"
              label={t.list.sort}
              value={sortShown}
              onChange={setSortShown}
            />
          </>
        )}
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
            <MaterialIcons name="add" size={ADD_ICON_SIZE} color={palette.accent} />
          </Pressable>
        )}
      </VaultBarTools>
      {(searchShown || sortShown) && (
        <View style={styles.top}>
          {searchShown && (
            <TextField
              testID="search"
              label={t.list.search}
              labelInside
              value={view.query}
              onChangeText={view.setQuery}
              inputRef={search}
            />
          )}
          {sortShown && (
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
                      style={{
                        color: chosen ? palette.fg : palette.fgDim,
                        fontSize: TEXT_SIZE.small,
                      }}
                    >
                      {t.list.sorts[sort]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
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
                onPress={() => router.navigate(settingsTopicPath(vaultKey, 'data'))}
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
          drawDistance={DRAW_AHEAD}
          extraData={actionsOpenFor}
          ListHeaderComponent={
            showStrips ? (
              <View style={styles.strips}>
                {showRecent && (
                  <CardStrip
                    testID="recent-strip"
                    title={t.phone.recent}
                    cards={session.recent.cards}
                    iconOf={view.siteIconOf}
                    onOpen={open}
                  />
                )}
                {showFavorites && (
                  <CardStrip
                    testID="favorites-strip"
                    title={t.phone.favorites}
                    cards={view.favorites}
                    iconOf={view.siteIconOf}
                    onOpen={open}
                  />
                )}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <CardSwipe card={item} still={actionsOpenFor === item.id}>
              <CardRow
                row={cardRowOf(item, view.expiryOf(item))}
                siteIcon={view.siteIconOf(item)}
                onOpen={() => open(item)}
                actionsOpen={actionsOpenFor === item.id}
                onActions={() => toggleActions(item.id)}
              />
            </CardSwipe>
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
      {!isNil(editingLabel) && (
        <LabelEditor editing={editingLabel} onClose={() => setEditingLabel(null)} />
      )}
      <SectionSheet
        view={view}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onEditLabel={
          session.readOnly
            ? undefined
            : groupId => {
                setSheetOpen(false);
                setEditingLabel({ kind: 'label', groupId });
              }
        }
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
  newCard: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionButton: {
    minHeight: TOUCH_SIZE,
    justifyContent: 'center',
    flexShrink: 1,
    marginRight: 'auto',
  },
  section: { flexShrink: 1, fontSize: TEXT_SIZE.heading, fontWeight: '600' },
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
