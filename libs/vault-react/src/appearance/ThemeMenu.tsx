import { cn } from '@frozik/components/components/cn';
import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { AppearanceModel } from '@frozik/vault-app/device/application/AppearanceModel';
import type { TThemePreference } from '@frozik/vault-app/device/domain/theme';
import type { TVaultTexts } from '@frozik/vault-app/texts/vault/vault-texts';

const PREFERENCES: readonly TThemePreference[] = ['system', 'light', 'dark'];
const ICONS: Readonly<Record<TThemePreference, LucideIcon>> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};
const ICON_SIZE = 18;

/**
 * The device's theme as one icon; hovering, focusing or tapping it lays out all three, the chosen
 * one staying at the end so it does not move under the pointer.
 */
export const ThemeMenu = observer(
  ({
    appearance,
    texts,
    className,
  }: {
    readonly appearance: AppearanceModel;
    readonly texts: TVaultTexts['appearance'];
    readonly className?: string;
  }) => {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!open) {
        return;
      }
      const controller = new AbortController();
      document.addEventListener(
        'pointerdown',
        event => {
          if (!(event.target instanceof Node && root.current?.contains(event.target))) {
            setOpen(false);
          }
        },
        { signal: controller.signal }
      );
      return () => controller.abort();
    }, [open]);

    const press = useEventCallback(
      (preference: TThemePreference, event: MouseEvent<HTMLButtonElement>) => {
        if (preference === appearance.preference) {
          setOpen(current => !current);
          return;
        }
        appearance.choose(preference);
        setOpen(false);
        if (event.detail > 0) {
          event.currentTarget.blur();
        }
      }
    );

    return (
      <div
        ref={root}
        role="radiogroup"
        tabIndex={-1}
        aria-label={texts.label}
        title={appearance.notRemembered ? texts.notRemembered : undefined}
        data-testid="appearance"
        data-state={appearance.scheme}
        data-open={open}
        onMouseLeave={() => setOpen(false)}
        className={cn(
          'group flex items-center gap-0.5 rounded-full border border-border bg-surface-elevated p-0.5 shadow-sm',
          className
        )}
      >
        {PREFERENCES.map(preference => {
          const Icon = ICONS[preference];
          const chosen = preference === appearance.preference;
          return (
            <button
              key={preference}
              type="button"
              role="radio"
              aria-checked={chosen}
              aria-label={texts[preference]}
              title={texts[preference]}
              data-value={preference}
              onClick={event => press(preference, event)}
              onKeyDown={event => event.key === 'Escape' && setOpen(false)}
              className={cn(
                'size-9 items-center justify-center rounded-full text-text-secondary transition-colors',
                'hover:bg-surface-overlay hover:text-text focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none',
                chosen
                  ? 'order-last flex text-text'
                  : 'hidden group-focus-within:flex group-hover:flex group-data-[open=true]:flex'
              )}
            >
              <Icon size={ICON_SIZE} aria-hidden />
            </button>
          );
        })}
      </div>
    );
  }
);
