import { cn } from '@frozik/components/components/cn';
import { isNil } from 'lodash-es';
import { Check, Copy, Eye, EyeOff, Maximize2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback, useTimeout } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import type {
  IValueReading,
  TFieldReading,
} from '@frozik/vault-app/document/application/card-reading';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { AssetPreview } from '@frozik/vault-react/files/AssetPreview';
import { LargeTypeView } from '@frozik/vault-react/large-type/LargeTypeView';
import { SENSITIVE_CLASS } from '@frozik/vault-react/sensitive-class';
import { LANGUAGE } from '@frozik/vault-react/texts/language';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { TotpCode } from '@frozik/vault-react/totp/TotpCode';

const ICON_SIZE = 18;
/** The copy icon turns into a check for a moment: the copy happened here. */
const COPIED_MARK_MS = 1500;

/** A copy at the point of action: the icon confirms, the snackbar says what and for how long. */
const CopyButton = ({ onCopy }: { readonly onCopy: () => Promise<boolean> }) => {
  const [copied, setCopied] = useState(false);
  useTimeout(() => setCopied(false), copied ? COPIED_MARK_MS : null);
  const copy = useEventCallback(() => void onCopy().then(setCopied));
  return (
    <Button
      type="button"
      variant="ghost"
      className="size-11 p-0"
      aria-label={vaultT.card.copy}
      data-state={copied ? 'copied' : 'idle'}
      onClick={copy}
    >
      {copied ? <Check size={ICON_SIZE} aria-hidden /> : <Copy size={ICON_SIZE} aria-hidden />}
    </Button>
  );
};

const ValueRow = observer(
  ({
    field,
    value,
    session,
    onCopied,
    onLarge,
  }: {
    readonly field: Extract<TFieldReading, { readonly kind: 'values' }>;
    readonly value: IValueReading;
    readonly session: VaultSession;
    readonly onCopied: (label: string) => void;
    readonly onLarge: (value: string) => void;
  }) => {
    const masked = field.sensitive && !session.reveal.isRevealed(field.id, value.index);
    const copy = useEventCallback(async () => {
      const written = await session.clipboard.copy(value.copyText);
      if (written) {
        onCopied(field.label);
      }
      return written;
    });
    return (
      <div className="flex items-center gap-1" data-state={value.turn ?? undefined}>
        <span
          className={cn(
            'min-w-0 flex-1 font-mono text-[15px] break-all whitespace-pre-wrap text-fg',
            field.sensitive && SENSITIVE_CLASS
          )}
          aria-label={masked ? `${field.label}, ${vaultT.card.hidden}` : undefined}
        >
          {masked ? vaultT.card.hidden : value.text}
        </span>
        {field.sensitive && field.copyable && (
          <Button
            type="button"
            variant="ghost"
            className="size-11 p-0"
            aria-label={masked ? vaultT.card.show : vaultT.card.hide}
            aria-pressed={!masked}
            onClick={() => session.reveal.toggle(field.id, value.index)}
          >
            {masked ? (
              <Eye size={ICON_SIZE} aria-hidden />
            ) : (
              <EyeOff size={ICON_SIZE} aria-hidden />
            )}
          </Button>
        )}
        {field.largeType && (
          <Button
            type="button"
            variant="ghost"
            className="size-11 p-0"
            aria-label={vaultT.cardExtras.large}
            onClick={() => onLarge(value.text)}
          >
            <Maximize2 size={ICON_SIZE} aria-hidden />
          </Button>
        )}
        {field.copyable && <CopyButton onCopy={copy} />}
      </div>
    );
  }
);

/** A field as read: a full-width row with its actions on the right. */
export const FieldView = observer(
  ({
    field,
    session,
    onCopied,
  }: {
    readonly field: TFieldReading;
    readonly session: VaultSession;
    readonly onCopied: (label: string) => void;
  }) => {
    const [large, setLarge] = useState<string | null>(null);
    const copyCode = useEventCallback((code: string) => {
      void session.clipboard.copy(code).then(written => written && onCopied(field.label));
    });
    return (
      <div className="flex flex-col gap-1 border-b border-line-soft py-3" data-testid="card-field">
        <span className="text-[13px] text-fg-faint">{field.label}</span>
        {field.kind === 'one-time-code' && (
          <TotpCode uri={field.uri} now={session.now} locale={LANGUAGE} onCopy={copyCode} />
        )}
        {field.kind === 'files' &&
          (field.assetIds.length === 0 ? (
            <span className="text-[14px] text-fg-dim">{vaultT.card.hidden}</span>
          ) : (
            field.assetIds.map(assetId => (
              <AssetPreview
                key={assetId}
                asset={session.document.assets.get(assetId)}
                file={session.files.fileOf(assetId)}
                onLoad={session.files.request}
                sensitive={field.sensitive}
              />
            ))
          ))}
        {field.kind === 'values' &&
          field.values.map(value => (
            <div key={value.index} className="flex flex-col">
              {!isNil(value.turn) && (
                <span className="text-[12px] text-fg-faint">
                  {value.turn === 'current'
                    ? vaultT.card.currentPassword
                    : vaultT.card.previousPassword}
                </span>
              )}
              <ValueRow
                field={field}
                value={value}
                session={session}
                onCopied={onCopied}
                onLarge={setLarge}
              />
            </div>
          ))}
        {!isNil(large) && (
          <DialogShell open onClose={() => setLarge(null)} title={field.label}>
            <LargeTypeView value={large} aria-label={field.label} />
          </DialogShell>
        )}
      </div>
    );
  }
);
