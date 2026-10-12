import { cn } from '@frozik/components/components/cn';
import { fileAssetIdsOf } from '@frozik/vault/model/asset-edits';
import type { ICardField } from '@frozik/vault/model/card';
import { passwordRotationOf } from '@frozik/vault/model/card';
import { FIELD_KINDS } from '@frozik/vault/model/field-kinds/registry';
import { LargeTypeView } from '@frozik/vault/react/large-type/LargeTypeView';
import { SENSITIVE_CLASS } from '@frozik/vault/react/sensitive-class';
import { TotpCode } from '@frozik/vault/react/totp/TotpCode';
import { isNil } from 'lodash-es';
import { Copy, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import type { VaultSession } from '../../application/VaultSession';
import { AssetPreview } from '../files/AssetPreview';
import { vaultT } from '../translations';

const ICON_SIZE = 14;

function valuesOf(field: ICardField): readonly string[] {
  return field.value.cardinality === 'single' ? [field.value.value] : field.value.values;
}

/**
 * A field as read: a secret stays masked until shown (and
 * hides itself again), a protected card keeps it masked, copying goes through
 * the clipboard guard. A one-time code shows its live code, and copies that.
 */
export const FieldRow = observer(
  ({
    field,
    session,
    locked,
  }: {
    readonly field: ICardField;
    readonly session: VaultSession;
    readonly locked: boolean;
  }) => {
    const t = vaultT.card;
    const [shownLarge, setShownLarge] = useState<string | null>(null);
    const values = valuesOf(field).filter(value => value !== '');
    if (values.length === 0 || field.spec.kind === 'unknown') {
      return null;
    }
    const kind = FIELD_KINDS[field.spec.kind];
    if (field.spec.kind === 'file') {
      return (
        <div className="flex flex-col gap-2 border-b border-landing-border-soft py-3">
          <span className="text-[12px] text-landing-fg-faint">{field.label}</span>
          {locked ? (
            <span className="text-[12px] text-landing-fg-faint">{t.hidden}</span>
          ) : (
            fileAssetIdsOf(field).map(assetId => (
              <AssetPreview
                key={assetId}
                asset={session.document.assets.get(assetId)}
                file={session.files.fileOf(assetId)}
                onLoad={session.files.request}
                sensitive={field.sensitive}
              />
            ))
          )}
        </div>
      );
    }
    if (field.spec.kind === 'otp' && !locked && field.value.cardinality === 'single') {
      return (
        <div className="flex flex-col gap-1 border-b border-landing-border-soft py-3">
          <span className="text-[12px] text-landing-fg-faint">{field.label}</span>
          <TotpCode
            uri={field.value.value}
            now={session.now}
            locale={getCurrentLanguage()}
            onCopy={code => void session.clipboard.copy(code)}
          />
        </div>
      );
    }
    const copyable = !locked && field.spec.kind !== 'otp';
    const large =
      field.sensitive && !locked && field.spec.kind !== 'otp' && field.spec.kind !== 'multiline';
    const rotation = passwordRotationOf(field);
    const shown = isNil(rotation)
      ? values.map((value, index) => ({ value, index, caption: null, turn: undefined }))
      : [
          { value: rotation.current, index: 0, caption: t.currentPassword, turn: 'current' },
          ...(isNil(rotation.previous)
            ? []
            : [
                {
                  value: rotation.previous,
                  index: 1,
                  caption: t.previousPassword,
                  turn: 'previous',
                },
              ]),
        ];
    return (
      <div className="flex flex-col gap-1 border-b border-landing-border-soft py-3">
        <span className="text-[12px] text-landing-fg-faint">{field.label}</span>
        {shown.map(({ value, index, caption, turn }) => {
          const masked = field.sensitive && (locked || !session.reveal.isRevealed(field.id, index));
          return (
            <div
              key={index}
              className="flex flex-wrap items-center gap-1"
              data-testid={isNil(turn) ? undefined : 'password-in-turn'}
              data-state={turn}
            >
              {!isNil(caption) && (
                <span className="w-full text-[11px] text-landing-fg-faint">{caption}</span>
              )}
              <span
                className={cn(
                  'min-w-0 flex-1 font-mono text-[14px] break-all whitespace-pre-wrap text-landing-fg',
                  field.sensitive && SENSITIVE_CLASS
                )}
              >
                {masked ? t.hidden : kind.format(value, field.spec)}
              </span>
              {field.sensitive && !locked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={masked ? t.show : t.hide}
                  title={masked ? t.show : t.hide}
                  aria-pressed={!masked}
                  onClick={() => session.reveal.toggle(field.id, index)}
                >
                  {masked ? <Eye size={ICON_SIZE} /> : <EyeOff size={ICON_SIZE} />}
                </Button>
              )}
              {large && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={vaultT.cardExtras.large}
                  title={vaultT.cardExtras.large}
                  onClick={() => setShownLarge(value)}
                >
                  <Maximize2 size={ICON_SIZE} />
                </Button>
              )}
              {copyable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t.copy}
                  title={t.copy}
                  onClick={() => void session.clipboard.copy(kind.copyValue(value))}
                >
                  <Copy size={ICON_SIZE} />
                </Button>
              )}
            </div>
          );
        })}
        {!isNil(shownLarge) && (
          <DialogShell open onClose={() => setShownLarge(null)} title={field.label}>
            <LargeTypeView value={shownLarge} aria-label={field.label} />
          </DialogShell>
        )}
      </div>
    );
  }
);
