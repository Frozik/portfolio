import { passwordRulesOfCard } from '@frozik/vault/generator/site-password-rules';
import type { ICardField, ICardState, TFieldSpec, TFieldValue } from '@frozik/vault/model/card';
import { fieldValues, isPasswordRotation } from '@frozik/vault/model/card';
import { validateField } from '@frozik/vault/model/field-validation';
import type { TAssetId, TTabId } from '@frozik/vault/model/ids';
import { ROTATION_PERIODS_DAYS } from '@frozik/vault/model/password-age';
import type { IAsset } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { INewFile, TAttachRefusal } from '@frozik/vault-app/document/domain/new-file';

import { Button } from '../kit/Button';
import { Checkbox } from '../kit/Checkbox';
import { Dialog } from '../kit/Dialog';
import { TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { OptionList } from '../kit/OptionList';
import { RowSlide } from '../kit/RowSlide';
import { TextField } from '../kit/TextField';
import { useEditorTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { FieldAction } from './FieldActions';
import { FieldValueEditor } from './FieldValueEditor';
import { FileFieldEditor } from './FileFieldEditor';
import { OtpQrScan } from './OtpQrScan';
import { PasswordGenerator } from './PasswordGenerator';

const NO_PERIOD = 'never';
/** Rename, up, down and remove: always offered. */
const INLINE_ACTIONS = 4;
const AUDITED_KINDS: ReadonlySet<TFieldSpec['kind']> = new Set(['password', 'url']);

type TFieldDialog = 'rename' | 'generate' | 'move' | 'period' | null;

/** One field in the editor: its label and actions, its kind's control, what is wrong with it. */
export const EditorFieldRow = observer(function EditorFieldRow({
  field,
  card,
  changed,
  first,
  last,
  otherTabs,
  random,
  assets,
  onChange,
  onRemove,
  onMove,
  onAttach,
  onDetach,
  onScanOtp,
}: {
  readonly field: ICardField;
  readonly card: ICardState;
  readonly changed: boolean;
  readonly first: boolean;
  readonly last: boolean;
  readonly otherTabs: readonly { readonly id: TTabId; readonly label: string }[];
  readonly random: IRandom;
  readonly assets: ReadonlyMap<TAssetId, IAsset>;
  readonly onChange: (edit: {
    readonly value?: TFieldValue;
    readonly label?: string;
    readonly spec?: TFieldSpec;
    readonly cardinality?: TFieldValue['cardinality'];
    readonly excludeFromAudit?: boolean;
    readonly rotate?: true;
  }) => void;
  readonly onRemove: () => void;
  readonly onMove: (to: { readonly offset: -1 | 1 } | { readonly tabId: TTabId }) => void;
  readonly onAttach: (files: readonly INewFile[]) => Promise<readonly TAttachRefusal[]>;
  readonly onDetach: (assetId: TAssetId) => void;
  readonly onScanOtp: ComponentProps<typeof OtpQrScan>['onScan'];
}) {
  const palette = usePalette();
  const t = useEditorTexts();
  const [dialog, setDialog] = useState<TFieldDialog>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [label, setLabel] = useState(field.label);
  const verdict = validateField(field, card);
  const generatable = field.spec.kind === 'password' && field.value.cardinality === 'single';
  const close = (): void => setDialog(null);
  const caption = changed ? `${field.label} · ${t.changed}` : field.label;
  const [headWidth, setHeadWidth] = useState<number | null>(null);
  const [captionWidth, setCaptionWidth] = useState<number | null>(null);
  const actionCount = INLINE_ACTIONS + (otherTabs.length > 0 ? 1 : 0) + (generatable ? 1 : 0);
  /** The actions stand in a row while the whole name still fits beside them; else they wait behind ⋯. */
  const inline =
    !isNil(headWidth) &&
    !isNil(captionWidth) &&
    captionWidth + actionCount * TOUCH_SIZE <= headWidth;
  /** An action taken from behind the slid head brings the head back. */
  const act = (action: () => void) => (): void => {
    setActionsOpen(false);
    action();
  };
  const actions = (
    <>
      <FieldAction
        testID="field-rename"
        icon="edit"
        label={t.renameField(field.label)}
        onPress={act(() => setDialog('rename'))}
      />
      <FieldAction
        testID="field-move-up"
        icon="arrow-upward"
        label={t.moveUp(field.label)}
        disabled={first}
        onPress={act(() => onMove({ offset: -1 }))}
      />
      <FieldAction
        testID="field-move-down"
        icon="arrow-downward"
        label={t.moveDown(field.label)}
        disabled={last}
        onPress={act(() => onMove({ offset: 1 }))}
      />
      {otherTabs.length > 0 && (
        <FieldAction
          testID="field-move-tab"
          icon="drive-file-move-outline"
          label={t.moveToTab(field.label)}
          onPress={act(() => setDialog('move'))}
        />
      )}
      <FieldAction
        testID="remove-field"
        icon="delete-outline"
        label={t.removeField(field.label)}
        onPress={act(onRemove)}
      />
    </>
  );
  return (
    <View
      testID="editor-field"
      style={[
        styles.row,
        { borderBottomColor: palette.lineSoft },
        changed && { borderLeftColor: palette.accent, borderLeftWidth: 3, paddingLeft: 8 },
      ]}
    >
      <RowSlide
        open={actionsOpen && !inline}
        behind={actions}
        onClose={{ label: t.fieldActions(field.label), press: () => setActionsOpen(false) }}
      >
        <View
          testID="field-head"
          style={styles.head}
          onLayout={event => setHeadWidth(event.nativeEvent.layout.width)}
        >
          <Text numberOfLines={1} style={[styles.title, { color: palette.fgDim }]}>
            {caption}
          </Text>
          <Text
            testID="field-name-measure"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            numberOfLines={1}
            onLayout={event => setCaptionWidth(event.nativeEvent.layout.width)}
            style={[styles.title, styles.measure]}
          >
            {caption}
          </Text>
          {generatable && (
            <FieldAction
              testID="generate"
              icon="auto-fix-high"
              label={t.generate}
              onPress={() => setDialog('generate')}
            />
          )}
          {inline ? (
            actions
          ) : (
            <FieldAction
              testID="field-actions"
              icon="more-vert"
              label={t.fieldActions(field.label)}
              onPress={() => setActionsOpen(open => !open)}
            />
          )}
        </View>
      </RowSlide>
      {field.spec.kind === 'file' ? (
        <FileFieldEditor field={field} assets={assets} onAttach={onAttach} onDetach={onDetach} />
      ) : (
        <FieldValueEditor field={field} onChange={value => onChange({ value })} />
      )}
      {field.spec.kind === 'otp' && field.value.cardinality === 'single' && (
        <OtpQrScan
          onScan={onScanOtp}
          onCode={uri => onChange({ value: { cardinality: 'single', value: uri } })}
        />
      )}
      {field.spec.kind === 'password' && (
        <>
          <Button
            variant="secondary"
            label={`${t.rotateEvery}: ${isNil(field.spec.rotateEveryDays) ? t.rotateNever : t.rotateDays(field.spec.rotateEveryDays)}`}
            onPress={() => setDialog('period')}
          />
          <Checkbox
            label={t.passwordRotation}
            checked={field.value.cardinality === 'list'}
            onChange={rotation => onChange({ cardinality: rotation ? 'list' : 'single' })}
          />
          {isPasswordRotation(field) && (
            <Button
              variant="secondary"
              label={t.nextPassword}
              disabled={fieldValues(field).length < 2}
              onPress={() => onChange({ rotate: true })}
            />
          )}
        </>
      )}
      {AUDITED_KINDS.has(field.spec.kind) && (
        <Checkbox
          label={t.excludeFromAudit}
          checked={field.excludeFromAudit}
          onChange={exclude => onChange({ excludeFromAudit: exclude })}
        />
      )}
      {verdict.kind !== 'valid' && (
        <Text
          testID="field-verdict"
          style={[
            styles.label,
            { color: verdict.kind === 'invalid' ? palette.danger : palette.caution },
          ]}
        >
          {t.validation[verdict.code]}
        </Text>
      )}
      {dialog === 'rename' && (
        <Dialog open title={t.renameField(field.label)} onClose={close}>
          <TextField
            testID="field-name"
            label={t.fieldName}
            value={label}
            onChangeText={setLabel}
          />
          <Button
            testID="field-name-save"
            label={t.save}
            disabled={label.trim() === ''}
            onPress={() => {
              onChange({ label: label.trim() });
              close();
            }}
          />
        </Dialog>
      )}
      {dialog === 'generate' && (
        <Dialog open title={t.generate} onClose={close}>
          <PasswordGenerator
            random={random}
            site={passwordRulesOfCard(card)}
            onUse={value => {
              onChange({ value: { cardinality: 'single', value } });
              close();
            }}
          />
        </Dialog>
      )}
      {dialog === 'move' && (
        <Dialog open title={t.moveToTab(field.label)} onClose={close}>
          {otherTabs.map(tab => (
            <Button
              key={tab.id}
              variant="secondary"
              label={tab.label}
              onPress={() => {
                onMove({ tabId: tab.id });
                close();
              }}
            />
          ))}
        </Dialog>
      )}
      {dialog === 'period' && field.spec.kind === 'password' && (
        <Dialog open title={t.rotateEvery} onClose={close}>
          <OptionList
            label={t.rotateEvery}
            value={String(field.spec.rotateEveryDays ?? NO_PERIOD)}
            options={[
              { value: NO_PERIOD, label: t.rotateNever },
              ...[
                ...new Set([
                  ...ROTATION_PERIODS_DAYS,
                  ...(isNil(field.spec.rotateEveryDays) ? [] : [field.spec.rotateEveryDays]),
                ]),
              ]
                .sort((first, second) => first - second)
                .map(days => ({ value: String(days), label: t.rotateDays(days) })),
            ]}
            onChange={value => {
              onChange({
                spec: {
                  kind: 'password',
                  rotateEveryDays: value === NO_PERIOD ? null : Number(value),
                },
              });
              close();
            }}
          />
        </Dialog>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 10, borderBottomWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontSize: TEXT_SIZE.small },
  measure: { position: 'absolute', flex: 0, opacity: 0, left: 0, top: 0 },
  label: { flex: 1, fontSize: TEXT_SIZE.caption },
});
