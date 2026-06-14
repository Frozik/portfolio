import { useFunction } from '@frozik/components/hooks/useFunction';
import { EyeOff, Glasses } from 'lucide-react';
import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import type { TGlassesStyle } from '../../domain/glasses-style';
import { GLASSES_STYLES } from '../../domain/glasses-style';
import roundGlassesUrl from '../../infrastructure/assets/glasses.svg?url';
import hippieGlassesUrl from '../../infrastructure/assets/hippie-glasses.svg?url';
import teacherGlassesUrl from '../../infrastructure/assets/teacher-glasses.svg?url';
import { confT } from '../translations';

const TRIGGER_ICON_SIZE = 18;

const triggerBaseClass =
  'flex h-10 w-10 items-center justify-center rounded-full border border-border ' +
  'text-text transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-brand-500';

/**
 * SVG asset URL per non-`'none'` style. Reused by the trigger button
 * (when a style is active) and by each menu item's preview thumbnail.
 */
const GLASSES_PREVIEW_URL: Record<Exclude<TGlassesStyle, 'none'>, string> = {
  round: roundGlassesUrl,
  hippie: hippieGlassesUrl,
  teacher: teacherGlassesUrl,
};

const GLASSES_LABEL: Record<TGlassesStyle, string> = {
  none: confT.room.glassesStyleNone,
  round: confT.room.glassesStyleRound,
  hippie: confT.room.glassesStyleHippie,
  teacher: confT.room.glassesStyleTeacher,
};

/**
 * Inline preview element used inside dropdown items. The SVG assets are
 * 240×80 (3:1) — rendering at `h-6 w-auto` gives ~72×24 px, which keeps
 * the lens shapes recognisable at menu scale.
 */
const GlassesIcon = memo(({ style }: { readonly style: TGlassesStyle }) => {
  if (style === 'none') {
    return <EyeOff className="h-6 w-6" aria-hidden="true" />;
  }
  return <img src={GLASSES_PREVIEW_URL[style]} alt="" aria-hidden="true" className="h-6 w-auto" />;
});

const GlassesPickerItem = memo(
  ({
    style,
    isSelected,
    onSelect,
  }: {
    readonly style: TGlassesStyle;
    readonly isSelected: boolean;
    readonly onSelect: (style: TGlassesStyle) => void;
  }) => {
    const handleSelect = useFunction(() => {
      onSelect(style);
    });
    return (
      <DropdownItem
        onSelect={handleSelect}
        className={cn('gap-3', isSelected && 'bg-brand-500/15 text-brand-200')}
      >
        <span className="flex h-6 w-20 shrink-0 items-center justify-center">
          <GlassesIcon style={style} />
        </span>
        <span>{GLASSES_LABEL[style]}</span>
      </DropdownItem>
    );
  }
);

/**
 * Replaces the binary AR-on / AR-off button with a 4-way picker:
 *  - "No glasses" disables the AR pipeline (zero-latency passthrough)
 *  - "Round" / "Hippie star" / "Teacher" each pick a different SVG
 *    overlay drawn into the outgoing video track.
 *
 * The trigger keeps the same 40×40 round shape as the surrounding
 * mute / share / leave controls. Active state (any style other than
 * 'none') paints the trigger with the brand accent so the user can
 * tell at a glance whether AR is on without opening the menu.
 */
const GlassesPickerButtonComponent = ({
  selectedStyle,
  onSelectStyle,
}: {
  readonly selectedStyle: TGlassesStyle;
  readonly onSelectStyle: (style: TGlassesStyle) => void;
}) => {
  const isActive = selectedStyle !== 'none';
  return (
    <Tooltip title={confT.room.glassesPickerLabel} placement="top">
      <Dropdown
        trigger={
          <button
            type="button"
            aria-label={confT.room.glassesPickerLabel}
            className={cn(
              triggerBaseClass,
              isActive
                ? 'bg-brand-500/20 text-brand-200 hover:bg-brand-500/30'
                : 'bg-surface-elevated hover:bg-surface-overlay'
            )}
          >
            {isActive ? (
              <Glasses size={TRIGGER_ICON_SIZE} aria-hidden="true" />
            ) : (
              <EyeOff size={TRIGGER_ICON_SIZE} aria-hidden="true" />
            )}
          </button>
        }
      >
        {GLASSES_STYLES.map(style => (
          <GlassesPickerItem
            key={style}
            style={style}
            isSelected={style === selectedStyle}
            onSelect={onSelectStyle}
          />
        ))}
      </Dropdown>
    </Tooltip>
  );
};

export const GlassesPickerButton = memo(GlassesPickerButtonComponent);
