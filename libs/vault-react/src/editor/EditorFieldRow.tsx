import { cn } from '@frozik/components/components/cn';
import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { Select } from '@frozik/components/components/select/Select';
import { passwordRulesOfCard } from '@frozik/vault/generator/site-password-rules';
import type { ICardField, ICardState, TFieldSpec, TFieldValue } from '@frozik/vault/model/card';
import { fieldValues, isPasswordRotation } from '@frozik/vault/model/card';
import { validateField } from '@frozik/vault/model/field-validation';
import type { TAssetId, TFieldId, TTabId } from '@frozik/vault/model/ids';
import { ROTATION_PERIODS_DAYS } from '@frozik/vault/model/password-age';
import type { IAsset } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';
import { FolderInput, Pencil, RotateCw, Wand2, X } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { FieldValueEditor } from '../field-editors/FieldValueEditor';
import { PasswordGenerator } from '../generator/PasswordGenerator';

import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import { Dropdown, DropdownItem } from '@frozik/components/ui/Dropdown';
import type { INewFile, TAttachRefusal } from '@frozik/vault-app/document/domain/new-file';
import { REVEAL_FOR_MS } from '@frozik/vault-app/exposure/application/RevealModel';
import { CHANGED_MARK_CLASS } from '../changed-mark';
import { FileFieldEditor } from '../files/FileFieldEditor';
import { editorT } from '../texts/editor';
import { LANGUAGE } from '../texts/language';
import { FieldLabelEditor } from './FieldLabelEditor';
import { OtpQrScan } from './OtpQrScan';

const ICON_SIZE = 14;
const NO_PERIOD = 'never';

/** The offered periods, and a period an import brought that is not among them. */
function periodOptions(current: number | null) {
  const periods = new Set<number>(ROTATION_PERIODS_DAYS);
  if (!isNil(current)) {
    periods.add(current);
  }
  const t = editorT;
  return [
    { value: NO_PERIOD, label: t.rotateNever },
    ...[...periods]
      .sort((first, second) => first - second)
      .map(days => ({ value: String(days), label: t.rotateDays(days) })),
  ];
}
/** The kinds the audit looks at. */
const AUDITED_KINDS: ReadonlySet<TFieldSpec['kind']> = new Set(['password', 'url']);

/** One field in the editor: its label, its kind's control, what is wrong with it, and removal. */
export const EditorFieldRow = observer(
  ({
    field,
    card,
    onValueChange,
    onRemove,
    changed,
    onRename,
    onCardinalityChange,
    onRotate,
    dragHandle,
    otherTabs,
    onMoveToTab,
    onExcludeFromAudit,
    onSpecChange,
    onScanOtp,
    random,
    assets,
    onAttach,
    onDetach,
  }: {
    readonly field: ICardField;
    readonly card: ICardState;
    readonly onValueChange: (value: TFieldValue) => void;
    readonly onRemove: () => void;
    /** Added or changed since the saved version: marked until the card is saved. */
    readonly changed: boolean;
    readonly onRename: (label: string) => void;
    /** A password field becomes a rotation of several, or back to its one in use. */
    readonly onCardinalityChange: (cardinality: TFieldValue['cardinality']) => void;
    /** A password rotation moves on: the oldest comes back on top. */
    readonly onRotate: () => void;
    /** The handle that moves the field within its tab. */
    readonly dragHandle: ReactNode;
    /** The card's other tabs, where the field may go; none for a card of one tab. */
    readonly otherTabs: readonly { readonly id: TTabId; readonly label: string }[];
    readonly onMoveToTab: (tabId: TTabId) => void;
    /** A value the user knows about (a shared test account) need not be reported. */
    readonly onExcludeFromAudit: (exclude: boolean) => void;
    /** The parameters of the field's kind: a password's period. */
    readonly onSpecChange: (spec: TFieldSpec) => void;
    readonly onScanOtp: ComponentProps<typeof OtpQrScan>['onScan'];
    readonly random: IRandom;
    readonly assets: ReadonlyMap<TAssetId, IAsset>;
    readonly onAttach: (
      fieldId: TFieldId,
      files: readonly INewFile[]
    ) => Promise<readonly TAttachRefusal[]>;
    readonly onDetach: (fieldId: TFieldId, assetId: TAssetId) => void;
  }) => {
    const t = editorT;
    const [generating, setGenerating] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const generatable = field.spec.kind === 'password' && field.value.cardinality === 'single';
    const verdict = validateField(field, card);
    return (
      <div
        data-testid="editor-field"
        data-state={changed ? 'changed' : 'saved'}
        className={cn(
          'flex flex-col gap-1.5 border-b border-landing-border-soft py-3',
          changed && CHANGED_MARK_CLASS
        )}
      >
        <div className="flex items-center gap-2">
          {renaming ? (
            <FieldLabelEditor
              label={field.label}
              onRename={onRename}
              onDone={() => setRenaming(false)}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-[12px] text-landing-fg-faint">
              {field.label}
              {changed && <span className="sr-only"> ({t.changed})</span>}
            </span>
          )}
          {generatable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t.generate}
              title={t.generate}
              onClick={() => setGenerating(true)}
            >
              <Wand2 size={ICON_SIZE} />
            </Button>
          )}
          <span className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t.renameField(field.label)}
              aria-pressed={renaming}
              onClick={() => setRenaming(true)}
            >
              <Pencil size={ICON_SIZE} />
            </Button>
            {otherTabs.length > 0 && (
              <Dropdown
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t.moveToTab(field.label)}
                  >
                    <FolderInput size={ICON_SIZE} />
                  </Button>
                }
              >
                {otherTabs.map(other => (
                  <DropdownItem key={other.id} onSelect={() => onMoveToTab(other.id)}>
                    {other.label}
                  </DropdownItem>
                ))}
              </Dropdown>
            )}
            {dragHandle}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t.removeField(field.label)}
              onClick={onRemove}
            >
              <X size={ICON_SIZE} />
            </Button>
          </span>
        </div>
        {field.spec.kind === 'file' ? (
          <FileFieldEditor
            field={field}
            assets={assets}
            onAttach={files => onAttach(field.id, files)}
            onDetach={assetId => onDetach(field.id, assetId)}
          />
        ) : (
          <FieldValueEditor
            field={field}
            onValueChange={onValueChange}
            locale={LANGUAGE}
            revealTimeoutMs={REVEAL_FOR_MS}
          />
        )}
        {generating && (
          <DialogShell open onClose={() => setGenerating(false)} title={t.generate}>
            <PasswordGenerator
              random={random}
              site={passwordRulesOfCard(card)}
              locale={LANGUAGE}
              onUse={value => {
                onValueChange({ cardinality: 'single', value });
                setGenerating(false);
              }}
            />
          </DialogShell>
        )}
        {field.spec.kind === 'otp' && field.value.cardinality === 'single' && (
          <OtpQrScan
            onScan={onScanOtp}
            onCode={uri => onValueChange({ cardinality: 'single', value: uri })}
          />
        )}
        {field.spec.kind === 'password' && (
          <label className="flex items-center gap-2 text-[12px] text-landing-fg-faint">
            {t.rotateEvery}
            <Select
              aria-label={t.rotateEvery}
              options={periodOptions(field.spec.rotateEveryDays)}
              value={String(field.spec.rotateEveryDays ?? NO_PERIOD)}
              onValueChange={value =>
                onSpecChange({
                  kind: 'password',
                  rotateEveryDays: value === NO_PERIOD ? null : Number(value),
                })
              }
              locale={LANGUAGE}
            />
          </label>
        )}
        {field.spec.kind === 'password' && (
          <div className="flex items-center gap-1">
            <Checkbox
              checked={field.value.cardinality === 'list'}
              onCheckedChange={rotation => onCardinalityChange(rotation ? 'list' : 'single')}
            >
              {t.passwordRotation}
            </Checkbox>
            {isPasswordRotation(field) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t.nextPassword}
                title={t.nextPassword}
                disabled={fieldValues(field).length < 2}
                onClick={onRotate}
              >
                <RotateCw size={ICON_SIZE} />
              </Button>
            )}
          </div>
        )}
        {AUDITED_KINDS.has(field.spec.kind) && (
          <Checkbox checked={field.excludeFromAudit} onCheckedChange={onExcludeFromAudit}>
            {t.excludeFromAudit}
          </Checkbox>
        )}
        {verdict.kind !== 'valid' && (
          <span
            className={
              verdict.kind === 'invalid' ? 'text-[12px] text-error' : 'text-[12px] text-warning'
            }
            data-testid="field-verdict"
            data-state={verdict.code}
          >
            {t.validation[verdict.code]}
          </span>
        )}
      </div>
    );
  }
);
