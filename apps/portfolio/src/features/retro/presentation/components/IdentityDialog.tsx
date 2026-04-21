import { useFunction } from '@frozik/components';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check } from 'lucide-react';
import { memo, useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { retroEnTranslations as t } from '../translations/en';

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

interface IdentityDialogProps {
  open: boolean;
  initialName: string;
  initialColor: string;
  onSubmit: (params: { name: string; color: string }) => void;
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
      className={
        'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ' +
        (selected
          ? 'border-text ring-2 ring-brand-500 ring-offset-2 ring-offset-surface-elevated'
          : 'border-transparent hover:scale-110')
      }
      // Color swatch palette requires a dynamic runtime color; no Tailwind utility can express this.
      style={{ backgroundColor: color }}
    >
      {selected && <Check size={14} className="text-white" />}
    </button>
  );
});

const IdentityDialogComponent = ({
  open,
  initialName,
  initialColor,
  onSubmit,
}: IdentityDialogProps) => {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

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

  const preventClose = useFunction((event: Event) => {
    event.preventDefault();
  });

  const isSubmitDisabled = name.trim().length === 0;

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm ' +
            'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'
          }
        />
        <DialogPrimitive.Content
          onPointerDownOutside={preventClose}
          onEscapeKeyDown={preventClose}
          onInteractOutside={preventClose}
          className={
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 ' +
            'rounded-xl border border-border bg-surface-elevated p-6 shadow-2xl ' +
            'data-[state=open]:animate-in data-[state=closed]:animate-out ' +
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 ' +
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95'
          }
        >
          <DialogPrimitive.Title className="text-lg font-semibold text-text">
            {t.identity.dialogTitle}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-text-secondary">
            {t.identity.dialogDescription}
          </DialogPrimitive.Description>

          <form className="mt-4 flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text" htmlFor="identity-name-input">
                {t.identity.nameLabel}
              </label>
              <input
                id="identity-name-input"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder={t.identity.namePlaceholder}
                required
                className={
                  'h-9 rounded-md border border-border bg-surface px-3 text-sm text-text ' +
                  'placeholder:text-text-secondary ' +
                  'focus:outline-none focus:ring-2 focus:ring-brand-500'
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text">{t.identity.colorLabel}</span>
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

            <div className="mt-2 flex justify-end">
              <Button type="submit" variant="primary" disabled={isSubmitDisabled}>
                {t.identity.submit}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export const IdentityDialog = memo(IdentityDialogComponent);

export type { IdentityDialogProps };
