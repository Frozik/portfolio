import { Tabs } from '@frozik/components/components/RichEditor/Tabs';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { Select } from '@frozik/components/components/select/Select';
import type { ICardField, ICardTab, TFieldKind } from '@frozik/vault/model/card';
import { allFields, fieldValues } from '@frozik/vault/model/card';
import { renameCard, setColor, setIcon } from '@frozik/vault/model/card-edits';
import {
  moveField,
  removeField,
  renameField,
  rotatePasswords,
  setFieldCardinality,
  setExcludeFromAudit,
  setFieldSpec,
  setTypedFieldValue,
} from '@frozik/vault/model/field-edits';
import { validateField } from '@frozik/vault/model/field-validation';
import type { TAssetId, TTabId } from '@frozik/vault/model/ids';
import { addTab } from '@frozik/vault/model/tab-edits';
import type { IAsset } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import { CardAppearancePicker } from '@frozik/vault/react/card-icon/CardAppearancePicker';
import { isNil } from 'lodash-es';
import { Plus } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import { ConfirmDialog } from '../../../../shared/ui/ConfirmDialog';
import type { CardDraftModel } from '../../application/CardDraftModel';
import { VaultField } from '../components/VaultField';
import { FIELD_KIND_CHOICES, LIST_BY_DEFAULT } from '../field-kind-choices';
import { useObjectUrl } from '../files/useObjectUrl';
import { vaultT } from '../translations';
import { editorT } from '../translations/editor';
import { ConflictDialog } from './ConflictDialog';
import { EditorFieldRow } from './EditorFieldRow';
import { SortableFieldList } from './SortableFieldList';
import { tabLabelOf } from './tab-label';
import { TabControls } from './TabControls';

const SAVE_KEY = 's';
const ICON_SIZE = 14;
/** The "add a field" menu, most used first; files arrive with plan task 17. */

/**
 * The card editor. Not a `<form>`: the
 * browser must neither offer to save a card's password as a site login nor
 * fill a saved one in. Saving is explicit (button or Ctrl+S); the draft is
 * sealed into the device store as it changes and survives a lock.
 */
export const CardEditor = observer(
  ({
    draft,
    random,
    assets,
    siteIcon,
    readOnly,
    onScanOtp,
    onClosed,
  }: {
    readonly draft: CardDraftModel;
    readonly random: IRandom;
    readonly assets: ReadonlyMap<TAssetId, IAsset>;
    readonly siteIcon: Uint8Array<ArrayBuffer> | null;
    /** The session turned read-only meanwhile (a newer version wrote the vault): nothing can be saved. */
    readonly readOnly: boolean;
    readonly onScanOtp: ComponentProps<typeof EditorFieldRow>['onScanOtp'];
    readonly onClosed: (saved: boolean) => void;
  }) => {
    const t = editorT;
    const { card, remote } = draft;
    const [firstTab] = card.tabs;
    const [tabId, setTabId] = useState<TTabId>(firstTab.id);
    const [confirmingDiscard, setConfirmingDiscard] = useState(false);
    const [removing, setRemoving] = useState<ICardField | null>(null);
    const sitePicture = useObjectUrl(isNil(siteIcon) ? undefined : siteIcon, 'image/png');
    const currentTab = card.tabs.find(tab => tab.id === tabId) ?? firstTab;
    const blocked =
      readOnly || allFields(card).some(field => validateField(field, card).kind === 'invalid');

    const save = useEventCallback(() => {
      if (!blocked && draft.save()) {
        onClosed(true);
      }
    });
    const remove = useEventCallback((field: ICardField) => {
      setRemoving(null);
      draft.change(state => removeField(state, field.id));
    });
    const requestRemove = useEventCallback((field: ICardField) => {
      if (fieldValues(field).every(value => value.trim() === '')) {
        remove(field);
      } else {
        setRemoving(field);
      }
    });
    const addNewTab = useEventCallback(() => {
      draft.change(state => addTab(state, t.tabs.newTitle, random).card);
      setTabId(draft.card.tabs[draft.card.tabs.length - 1].id);
    });
    const cancel = useEventCallback(() => {
      if (draft.dirty) {
        setConfirmingDiscard(true);
      } else {
        onClosed(false);
      }
    });

    useEffect(() => {
      const controller = new AbortController();
      window.addEventListener(
        'keydown',
        event => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === SAVE_KEY) {
            event.preventDefault();
            save();
          }
        },
        { signal: controller.signal }
      );
      return () => controller.abort();
    }, [save]);

    const fieldsOf = (tab: ICardTab) => (
      <SortableFieldList
        fields={tab.fields}
        onMove={(fieldId, index) => draft.change(state => moveField(state, fieldId, tab.id, index))}
      >
        {(field, handle) => (
          <EditorFieldRow
            field={field}
            dragHandle={handle}
            changed={draft.changes.fields.has(field.id)}
            otherTabs={card.tabs
              .filter(other => other.id !== tab.id)
              .map(other => ({ id: other.id, label: tabLabelOf(other) }))}
            onMoveToTab={toTabId =>
              draft.change(state =>
                moveField(
                  state,
                  field.id,
                  toTabId,
                  state.tabs.find(other => other.id === toTabId)?.fields.length ?? 0
                )
              )
            }
            card={card}
            onValueChange={value =>
              draft.change(state => setTypedFieldValue(state, field.id, value))
            }
            onRemove={() => requestRemove(field)}
            onRename={label => draft.change(state => renameField(state, field.id, label))}
            onRotate={() => draft.change(state => rotatePasswords(state, field.id))}
            onCardinalityChange={cardinality =>
              draft.change(state => setFieldCardinality(state, field.id, cardinality))
            }
            onScanOtp={onScanOtp}
            onExcludeFromAudit={exclude =>
              draft.change(state => setExcludeFromAudit(state, field.id, exclude))
            }
            onSpecChange={spec => draft.change(state => setFieldSpec(state, field.id, spec))}
            random={random}
            assets={assets}
            onAttach={draft.attachFiles}
            onDetach={draft.detachFile}
          />
        )}
      </SortableFieldList>
    );

    return (
      <article className="flex flex-col gap-4">
        {remote.kind === 'changed-elsewhere' && (
          <Alert type="warning" message={t.changedElsewhere} />
        )}
        {remote.kind === 'deleted-elsewhere' && (
          <Alert type="warning" message={t.deletedElsewhere} />
        )}
        <VaultField label={t.title} changed={draft.changes.title}>
          {describedBy => (
            <TextEditor
              aria-label={t.title}
              aria-describedby={describedBy}
              value={card.title}
              onValueChange={title => draft.change(state => renameCard(state, title))}
            />
          )}
        </VaultField>
        <VaultField label={t.appearance}>
          {() => (
            <CardAppearancePicker
              color={card.color}
              icon={card.icon}
              locale={getCurrentLanguage()}
              autoPicture={sitePicture}
              onColorChange={color => draft.change(state => setColor(state, color))}
              onIconChange={icon => draft.change(state => setIcon(state, icon))}
            />
          )}
        </VaultField>
        <Tabs<TTabId>
          aria-label={vaultT.card.tabs}
          value={currentTab.id}
          onValueChange={setTabId}
          actions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t.tabs.add}
              title={t.tabs.add}
              onClick={addNewTab}
            >
              <Plus size={ICON_SIZE} />
            </Button>
          }
          tabs={card.tabs.map(tab => ({
            id: tab.id,
            label: tabLabelOf(tab),
            content: (
              <>
                {card.tabs.length > 1 && (
                  <TabControls card={card} tab={tab} onChange={draft.change} />
                )}
                {fieldsOf(tab)}
              </>
            ),
          }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[180px] flex-1">
            <Select<TFieldKind>
              aria-label={t.addField}
              placeholder={t.addField}
              options={FIELD_KIND_CHOICES.map(kind => ({ value: kind, label: t.kinds[kind] }))}
              value={undefined}
              onValueChange={kind =>
                draft.addField(
                  currentTab.id,
                  kind,
                  t.kinds[kind],
                  LIST_BY_DEFAULT.has(kind) ? 'list' : 'single'
                )
              }
              locale={getCurrentLanguage()}
            />
          </div>
        </div>
        <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-landing-border-soft bg-landing-bg py-3">
          <Button type="button" disabled={blocked} onClick={save} title={t.saveShortcut}>
            {t.save}
          </Button>
          <Button type="button" variant="ghost" onClick={cancel}>
            {t.cancel}
          </Button>
        </footer>
        {draft.pendingConflict !== null && (
          <ConflictDialog
            draft={draft}
            conflict={draft.pendingConflict}
            onSaved={() => onClosed(true)}
          />
        )}
        <ConfirmDialog
          open={!isNil(removing)}
          title={t.removeFieldTitle(removing?.label ?? '')}
          description={t.removeFieldMessage}
          confirmLabel={t.remove}
          cancelLabel={t.keepField}
          tone="danger"
          onConfirm={() => !isNil(removing) && remove(removing)}
          onCancel={() => setRemoving(null)}
        />
        <ConfirmDialog
          open={confirmingDiscard}
          title={t.discardTitle}
          description={t.discardMessage}
          confirmLabel={t.discard}
          cancelLabel={t.keepEditing}
          tone="danger"
          onConfirm={() => onClosed(false)}
          onCancel={() => setConfirmingDiscard(false)}
        />
      </article>
    );
  }
);
