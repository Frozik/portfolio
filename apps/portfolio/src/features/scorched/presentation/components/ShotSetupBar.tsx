import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';

import { useScorchedStore } from '../../application/useScorchedStore';
import { PLASMA_MAX_BATTERIES, PLASMA_MIN_BATTERIES } from '../../domain/constants';
import { canFitGuidance } from '../../domain/items/behaviors';
import type { GuidanceKind, ItemId } from '../../domain/types';
import { getWeapon } from '../../domain/weapons/catalog';
import { scorchedT } from '../translations';

const GUIDANCE_ITEMS: readonly GuidanceKind[] = [
  'heat-guidance',
  'ballistic-guidance',
  'horizontal-guidance',
  'vertical-guidance',
  'lazy-boy',
];

const GUIDANCE_NONE_VALUE = '';

const controlClass =
  'rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-text ' +
  'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-brand-500 disabled:opacity-40';

function isGuidanceKind(value: string): value is GuidanceKind {
  return GUIDANCE_ITEMS.some(candidate => candidate === value);
}

/**
 * The per-shot arming strip: the installed guidance device, the contact trigger and —
 * only when a plasma blast is selected — how many batteries to burn on it. The selection resets
 * after every shot; the guidance device itself stays installed for the match.
 */
export const ShotSetupBar = observer(() => {
  const store = useScorchedStore();
  const { activePlayerId } = store.world;
  const { selectedWeaponId, shotSetup } = store.aim;
  const weapon = getWeapon(selectedWeaponId);
  const isGuidanceAllowed = canFitGuidance(weapon);
  const isPlasma = weapon.family === 'plasma';

  const countOf = (itemId: ItemId): number =>
    activePlayerId === undefined ? 0 : store.world.getItemCount(activePlayerId, itemId);

  const triggerCount = countOf('contact-trigger');

  const handleGuidanceChange = useFunction((event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;

    store.aim.setGuidance(isGuidanceKind(value) ? value : undefined);
  });

  const handleTriggerChange = useFunction((event: ChangeEvent<HTMLInputElement>) => {
    store.aim.setContactTriggerArmed(event.target.checked);
  });

  const handleBatteriesChange = useFunction((event: ChangeEvent<HTMLSelectElement>) => {
    store.aim.setPlasmaBatteries(Number(event.target.value));
  });

  const availableGuidance = GUIDANCE_ITEMS.filter(guidance => countOf(guidance) > 0);
  const batteryCount = countOf('battery');

  if (availableGuidance.length === 0 && triggerCount === 0 && !isPlasma) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute top-3 left-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-sm">
      <span className="text-[0.625rem] uppercase tracking-widest text-text-muted">
        {scorchedT.shot.title}
      </span>

      {availableGuidance.length === 0 ? null : (
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          {scorchedT.shot.guidance}
          <select
            value={shotSetup.guidance ?? GUIDANCE_NONE_VALUE}
            onChange={handleGuidanceChange}
            disabled={!isGuidanceAllowed}
            title={isGuidanceAllowed ? undefined : scorchedT.shot.incompatible}
            className={controlClass}
          >
            <option value={GUIDANCE_NONE_VALUE}>{scorchedT.shot.guidanceNone}</option>
            {availableGuidance.map(guidance => (
              <option key={guidance} value={guidance}>
                {scorchedT.itemNames[guidance]}
              </option>
            ))}
          </select>
        </label>
      )}

      {triggerCount === 0 ? null : (
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={shotSetup.hasContactTrigger}
            onChange={handleTriggerChange}
            className="size-3.5 accent-brand-500"
          />
          {scorchedT.shot.contactTrigger}
          <span className="font-mono text-text-muted">×{triggerCount}</span>
        </label>
      )}

      {isPlasma ? (
        <label className={cn('flex items-center gap-1.5 text-xs text-text-secondary')}>
          {scorchedT.shot.plasmaBatteries}
          <select
            value={shotSetup.plasmaBatteries}
            onChange={handleBatteriesChange}
            className={controlClass}
          >
            {Array.from(
              { length: PLASMA_MAX_BATTERIES - PLASMA_MIN_BATTERIES + 1 },
              (_unused, index) => PLASMA_MIN_BATTERIES + index
            )
              .filter(count => count <= Math.max(PLASMA_MIN_BATTERIES, batteryCount))
              .map(count => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
          </select>
        </label>
      ) : null}
    </div>
  );
});
