import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { groupBy } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo, useMemo } from 'react';

import { useScorchedStore } from '../../application/useScorchedStore';
import type { WeaponFamily, WeaponId } from '../../domain/types';
import { getWeapon } from '../../domain/weapons/catalog';
import { UNLIMITED_COUNT_LABEL } from '../constants';
import { scorchedT } from '../translations';
import { getWeaponName } from '../weapon-names';
import { ShopGlyph } from './ShopGlyph';

/**
 * [MANUAL §6] The Baby Missile is free and endless, which is the single most useful thing a new
 * player can know about the arsenal. Its count therefore gets a badge rather than a number: brand
 * pill, wider glyph, its own tooltip — so "the one you never run out of" is visible at a glance
 * in a strip where every other chip is counting down.
 */
const UNLIMITED_BADGE_CLASS =
  'rounded-full bg-brand-500/25 px-2 text-sm leading-tight text-brand-200';
const COUNT_CLASS = 'font-mono text-[0.625rem] tabular-nums text-text-muted';

const WeaponChip = memo(
  ({
    weaponId,
    count,
    isSelected,
    onSelect,
  }: {
    readonly weaponId: WeaponId;
    readonly count: number;
    readonly isSelected: boolean;
    readonly onSelect: (weaponId: WeaponId) => void;
  }) => {
    const handleClick = useFunction(() => onSelect(weaponId));

    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={isSelected}
        className={cn(
          'flex min-w-28 flex-col items-center gap-1 rounded-xl border px-3 py-2',
          'transition-colors duration-150',
          isSelected
            ? 'border-brand-500 bg-brand-500/20 text-text'
            : 'border-white/10 bg-white/5 text-text-secondary hover:bg-white/10'
        )}
      >
        <ShopGlyph glyphId={getWeapon(weaponId).family} />
        <span className="text-xs leading-tight">{getWeaponName(weaponId)}</span>
        {Number.isFinite(count) ? (
          <span className={COUNT_CLASS}>{count}</span>
        ) : (
          <span className={UNLIMITED_BADGE_CLASS} title={scorchedT.touch.unlimited}>
            {UNLIMITED_COUNT_LABEL}
          </span>
        )}
      </button>
    );
  }
);

/**
 * The weapon carousel: one horizontal strip of large targets grouped by family, opened
 * from the fire button's weapon badge (or the HUD badge on desktop) and closing on selection.
 */
export const WeaponCarousel = observer(() => {
  const store = useScorchedStore();
  const { availableWeapons } = store.aim;

  const groups = useMemo(
    () => groupBy(availableWeapons, entry => getWeapon(entry.weaponId).family),
    [availableWeapons]
  );

  const handleSelect = useFunction((weaponId: WeaponId) => {
    store.aim.selectWeapon(weaponId);
  });

  const handleClose = useFunction(() => {
    store.aim.setCarouselOpen(false);
  });

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-white/10 bg-black/85 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] uppercase tracking-widest text-text-muted">
          {scorchedT.touch.weapons}
        </span>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-md px-2 py-1 text-xs text-text-secondary transition-colors duration-150 hover:text-text"
        >
          {scorchedT.cancel}
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1">
        {Object.entries(groups).map(([family, entries]) => (
          <div key={family} className="flex shrink-0 flex-col gap-1">
            <span className="text-[0.625rem] uppercase tracking-widest text-text-muted">
              {scorchedT.weaponFamilies[family as WeaponFamily]}
            </span>
            <div className="flex gap-2">
              {entries.map(entry => (
                <WeaponChip
                  key={entry.weaponId}
                  weaponId={entry.weaponId}
                  count={entry.count}
                  isSelected={entry.weaponId === store.aim.selectedWeaponId}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
