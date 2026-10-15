import type { ICardField, ICardState, ICardTab, TFieldKind } from '@frozik/vault/model/card';
import { allFields, fieldValues } from '@frozik/vault/model/card';
import { renameCard, setColor, setIcon } from '@frozik/vault/model/card-edits';
import {
  moveField,
  removeField,
  renameField,
  rotatePasswords,
  setExcludeFromAudit,
  setFieldCardinality,
  setFieldSpec,
  setTypedFieldValue,
} from '@frozik/vault/model/field-edits';
import { validateField } from '@frozik/vault/model/field-validation';
import type { TAssetId, TTabId } from '@frozik/vault/model/ids';
import { addTab } from '@frozik/vault/model/tab-edits';
import type { IAsset } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CardDraftModel } from '@frozik/vault-app/document/application/CardDraftModel';
import {
  FIELD_KIND_CHOICES,
  LIST_BY_DEFAULT,
} from '@frozik/vault-app/document/domain/field-kind-choices';

import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { GAP, GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { TextField } from '../kit/TextField';
import { useEditorTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { AppearancePicker } from './AppearancePicker';
import { ConflictDialog } from './ConflictDialog';
import { EditorFieldRow } from './EditorFieldRow';
import { TabDialog } from './TabDialog';

type TEditorDialog =
  | { readonly kind: 'add-field' }
  | { readonly kind: 'remove-field'; readonly field: ICardField }
  | { readonly kind: 'discard' }
  | { readonly kind: 'tab'; readonly tab: ICardTab }
  | null;

/**
 * The card editor. Saving is explicit; the draft is sealed into the device
 * store as it changes and survives a lock.
 */
export const CardEditor = observer(function CardEditor({
  draft,
  random,
  assets,
  readOnly,
  siteIcon,
  onClosed,
}: {
  readonly draft: CardDraftModel;
  readonly random: IRandom;
  readonly assets: ReadonlyMap<TAssetId, IAsset>;
  /** The session turned read-only meanwhile: nothing can be saved. */
  readonly readOnly: boolean;
  /** The site's icon the automatic choice shows, when the vault has one. */
  readonly siteIcon: Uint8Array<ArrayBuffer> | null;
  readonly onClosed: (saved: boolean) => void;
}) {
  const palette = usePalette();
  const t = useEditorTexts();
  const vaultTexts = useVaultTexts();
  const { card, remote } = draft;
  const [tabId, setTabId] = useState<TTabId | null>(null);
  const [dialog, setDialog] = useState<TEditorDialog>(null);
  const currentTab = card.tabs.find(tab => tab.id === tabId) ?? card.tabs[0];
  const blocked =
    readOnly || allFields(card).some(field => validateField(field, card).kind === 'invalid');
  const tabLabelOf = (tab: ICardTab): string =>
    isNil(tab.title) || tab.title === '' ? vaultTexts.card.mainTab : tab.title;
  const close = (): void => setDialog(null);
  const save = (): void => {
    if (!blocked && draft.save()) {
      onClosed(true);
    }
  };
  const cancel = (): void => (draft.dirty ? setDialog({ kind: 'discard' }) : onClosed(false));
  const remove = (field: ICardField): void => {
    close();
    draft.change(state => removeField(state, field.id));
  };
  const requestRemove = (field: ICardField): void =>
    fieldValues(field).every(value => value.trim() === '')
      ? remove(field)
      : setDialog({ kind: 'remove-field', field });
  const addNewTab = (): void => {
    draft.change(state => addTab(state, t.tabs.newTitle, random).card);
    setTabId(draft.card.tabs[draft.card.tabs.length - 1]?.id ?? null);
  };
  const addField = (kind: TFieldKind): void => {
    close();
    if (!isNil(currentTab)) {
      draft.addField(
        currentTab.id,
        kind,
        t.kinds[kind],
        LIST_BY_DEFAULT.has(kind) ? 'list' : 'single'
      );
    }
  };
  const fieldsOf = (tab: ICardTab) =>
    tab.fields.map((field, position) => (
      <EditorFieldRow
        key={field.id}
        field={field}
        card={card}
        changed={draft.changes.fields.has(field.id)}
        first={position === 0}
        last={position === tab.fields.length - 1}
        otherTabs={card.tabs
          .filter(other => other.id !== tab.id)
          .map(other => ({ id: other.id, label: tabLabelOf(other) }))}
        random={random}
        assets={assets}
        onChange={edit =>
          draft.change(state => {
            if (!isNil(edit.value)) {
              return setTypedFieldValue(state, field.id, edit.value);
            }
            if (!isNil(edit.label)) {
              return renameField(state, field.id, edit.label);
            }
            if (!isNil(edit.spec)) {
              return setFieldSpec(state, field.id, edit.spec);
            }
            if (!isNil(edit.cardinality)) {
              return setFieldCardinality(state, field.id, edit.cardinality);
            }
            if (!isNil(edit.excludeFromAudit)) {
              return setExcludeFromAudit(state, field.id, edit.excludeFromAudit);
            }
            return edit.rotate === true ? rotatePasswords(state, field.id) : state;
          })
        }
        onRemove={() => requestRemove(field)}
        onMove={to =>
          draft.change((state: ICardState) =>
            'tabId' in to
              ? moveField(
                  state,
                  field.id,
                  to.tabId,
                  state.tabs.find(other => other.id === to.tabId)?.fields.length ?? 0
                )
              : moveField(state, field.id, tab.id, position + to.offset)
          )
        }
        onAttach={files => draft.attachFiles(field.id, files)}
        onDetach={assetId => draft.detachFile(field.id, assetId)}
      />
    ));

  return (
    <View testID="card-editor" style={styles.editor}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {remote.kind === 'changed-elsewhere' && (
          <Notice tone="caution" message={t.changedElsewhere} />
        )}
        {remote.kind === 'deleted-elsewhere' && (
          <Notice tone="caution" message={t.deletedElsewhere} />
        )}
        <TextField
          testID="editor-title"
          label={t.title}
          value={card.title}
          onChangeText={title => draft.change(state => renameCard(state, title))}
        />
        <AppearancePicker
          card={card}
          siteIcon={siteIcon}
          onIconChange={icon => draft.change(state => setIcon(state, icon))}
          onColorChange={color => draft.change(state => setColor(state, color))}
        />
        <ScrollView horizontal accessibilityRole="tablist" contentContainerStyle={styles.tabs}>
          {card.tabs.map(tab => {
            const selected = tab.id === currentTab?.id;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTabId(tab.id)}
                onLongPress={() => setDialog({ kind: 'tab', tab })}
                style={[styles.tab, { borderColor: selected ? palette.accent : palette.line }]}
              >
                <Text style={{ color: selected ? palette.fg : palette.fgDim }}>
                  {tabLabelOf(tab)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.tabs.add}
            onPress={addNewTab}
            style={[styles.tab, { borderColor: palette.line }]}
          >
            <Text style={{ color: palette.fgDim }}>+</Text>
          </Pressable>
        </ScrollView>
        {!isNil(currentTab) && card.tabs.length > 1 && (
          <Button
            variant="secondary"
            label={tabLabelOf(currentTab)}
            onPress={() => setDialog({ kind: 'tab', tab: currentTab })}
          />
        )}
        {!isNil(currentTab) && fieldsOf(currentTab)}
        <Button
          testID="add-field"
          variant="secondary"
          label={t.addField}
          onPress={() => setDialog({ kind: 'add-field' })}
        />
      </ScrollView>
      <View
        style={[styles.footer, { borderTopColor: palette.lineSoft, backgroundColor: palette.bg }]}
      >
        <View style={styles.footerButton}>
          <Button testID="editor-save" label={t.save} disabled={blocked} onPress={save} />
        </View>
        <View style={styles.footerButton}>
          <Button testID="editor-cancel" variant="secondary" label={t.cancel} onPress={cancel} />
        </View>
      </View>
      {draft.pendingConflict !== null && (
        <ConflictDialog
          draft={draft}
          conflict={draft.pendingConflict}
          onSaved={() => onClosed(true)}
        />
      )}
      {dialog?.kind === 'add-field' && (
        <Dialog testID="add-field-dialog" open title={t.addField} onClose={close}>
          {FIELD_KIND_CHOICES.map(kind => (
            <Button
              key={kind}
              testID={`add-${kind}`}
              variant="secondary"
              label={t.kinds[kind]}
              onPress={() => addField(kind)}
            />
          ))}
        </Dialog>
      )}
      {dialog?.kind === 'remove-field' && (
        <Dialog open title={t.removeFieldTitle(dialog.field.label)} onClose={close}>
          <Text style={{ color: palette.fgDim, fontSize: TEXT_SIZE.small }}>
            {t.removeFieldMessage}
          </Text>
          <Button
            testID="confirm-remove-field"
            variant="danger"
            label={t.remove}
            onPress={() => remove(dialog.field)}
          />
          <Button variant="secondary" label={t.keepField} onPress={close} />
        </Dialog>
      )}
      {dialog?.kind === 'discard' && (
        <Dialog open title={t.discardTitle} onClose={close}>
          <Text style={{ color: palette.fgDim, fontSize: TEXT_SIZE.small }}>
            {t.discardMessage}
          </Text>
          <Button
            testID="confirm-discard"
            variant="danger"
            label={t.discard}
            onPress={() => onClosed(false)}
          />
          <Button variant="secondary" label={t.keepEditing} onPress={close} />
        </Dialog>
      )}
      {dialog?.kind === 'tab' && (
        <TabDialog
          card={card}
          tab={dialog.tab}
          label={tabLabelOf(dialog.tab)}
          onChange={draft.change}
          onClose={close}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  editor: { flex: 1 },
  content: { gap: GAP, padding: GUTTER },
  tabs: { gap: 8 },
  tab: {
    minHeight: TOUCH_SIZE,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: GAP,
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', gap: GAP, padding: GUTTER, borderTopWidth: 1 },
  footerButton: { flex: 1 },
});
