import { useFunction } from '@frozik/components/hooks/useFunction';
import { Check } from 'lucide-react';
import { memo, useState } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import { retroT as t } from '../translations';

const COLOR_PALETTE: readonly string[] = [
  '#f97316',
  '#ec4899',
  '#8b5cf6',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#eab308',
  '#ef4444',
];

const CHECK_ICON_SIZE_PX = 12;

interface IdentityDialogProps {
  open: boolean;
  initialName: string;
  initialColor: string;
  onSubmit: (params: { name: string; color: string }) => void;
  /**
   * Optional close handler. When provided, the dialog renders a Cancel
   * button and lets the user dismiss via Esc / outside click — used from
   * the in-room identity edit flow where the profile already exists.
   * When omitted (first-visit mandatory setup) the dialog is sticky.
   */
  onClose?: () => void;
}

interface ColorSwatchProps {
  color: string;
  selected: boolean;
  onSelect: (color: string) => void;
}

const ColorSwatch = memo(({ color, selected, onSelect }: ColorSwatchProps) => {
  const handleClick = useFunction(() => {
    onSelect(color);
  });

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={color}
      aria-pressed={selected}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full transition-all',
        selected
          ? 'ring-2 ring-landing-fg ring-offset-2 ring-offset-landing-bg-card'
          : 'hover:scale-110'
      )}
      // Color swatch palette requires a dynamic runtime color; no Tailwind utility can express this.
      style={{ backgroundColor: color }}
    >
      {selected && <Check size={CHECK_ICON_SIZE_PX} strokeWidth={3} className="text-white" />}
    </button>
  );
});

const IdentityDialogComponent = ({
  open,
  initialName,
  initialColor,
  onSubmit,
  onClose,
}: IdentityDialogProps) => {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const cancellable = onClose !== undefined;

  const handleNameChange = useFunction((event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  });

  const handleColorSelect = useFunction((nextColor: string) => {
    setColor(nextColor);
  });

  const handleSubmit = useFunction((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      return;
    }

    onSubmit({ name: trimmedName, color });
  });

  const handleCancel = useFunction(() => {
    setName(initialName);
    setColor(initialColor);
    onClose?.();
  });

  const handleShellClose = useFunction(() => {
    if (cancellable) {
      handleCancel();
    }
  });

  const isSubmitDisabled = name.trim().length === 0;

  const footer = (
    <>
      {cancellable && (
        <button
          type="button"
          onClick={handleCancel}
          className={cn(
            'px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
            'text-landing-fg-dim hover:text-landing-fg'
          )}
        >
          {t.create.cancel}
        </button>
      )}
      <button
        type="submit"
        form="retro-identity-form"
        disabled={isSubmitDisabled}
        className={cn(
          'inline-flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
          'border-0 bg-landing-accent text-landing-bg hover:bg-landing-accent/90',
          'disabled:cursor-not-allowed disabled:bg-landing-border disabled:text-landing-fg-faint'
        )}
      >
        {t.identity.submit}
      </button>
    </>
  );

  return (
    <DialogShell
      open={open}
      onClose={handleShellClose}
      kicker={t.identity.kicker}
      title={t.identity.dialogTitle}
      description={t.identity.dialogDescription}
      closeLabel={t.create.cancel}
      dismissible={cancellable}
      footer={footer}
    >
      <form id="retro-identity-form" className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <label className="block" htmlFor="identity-name-input">
            <MonoKicker tone="faint">{t.identity.nameLabel}</MonoKicker>
          </label>
          <input
            id="identity-name-input"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder={t.identity.namePlaceholder}
            required
            className={cn(
              'w-full border-0 border-b border-dashed border-landing-border-soft bg-transparent',
              'px-0 py-1 text-[14px] leading-[1.5] text-landing-fg',
              'placeholder:text-landing-fg-faint',
              'focus:border-landing-accent focus:outline-none'
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <MonoKicker tone="faint">{t.identity.colorLabel}</MonoKicker>
          <div className="flex flex-wrap gap-3">
            {COLOR_PALETTE.map(paletteColor => (
              <ColorSwatch
                key={paletteColor}
                color={paletteColor}
                selected={paletteColor === color}
                onSelect={handleColorSelect}
              />
            ))}
          </div>
        </div>
      </form>
    </DialogShell>
  );
};

export const IdentityDialog = memo(IdentityDialogComponent);

export type { IdentityDialogProps };
