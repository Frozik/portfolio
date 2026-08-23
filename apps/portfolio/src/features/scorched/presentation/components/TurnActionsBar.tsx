import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import {
  BatteryCharging,
  ChevronLeft,
  ChevronRight,
  Fuel,
  LifeBuoy,
  ShieldPlus,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { useScorchedStore } from '../../application/useScorchedStore';
import { MAX_TANK_HEALTH } from '../../domain/constants';
import type { ItemId } from '../../domain/types';
import { HUD_ICON_SIZE_PX } from '../constants';
import { scorchedT } from '../translations';

const NO_STOCK = 0;
const DRIVE_LEFT = -1;
const DRIVE_RIGHT = 1;

/** [MANUAL §7] Every bubble a tank can put up itself, strongest first. */
const SHIELD_ITEM_IDS: readonly ItemId[] = ['super-mag', 'heavy-shield', 'force-shield', 'shield'];

/**
 * Touch targets first: these are the only controls a player uses mid-turn other than the fire
 * button, and on a phone they sit under the same thumb.
 */
const actionClass =
  'flex min-h-11 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 ' +
  'text-xs text-text-secondary transition-colors duration-150 hover:bg-white/10 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
  'disabled:pointer-events-none disabled:opacity-35';
const activeActionClass = 'border-brand-500 bg-brand-500/20 text-text';
const countClass = 'font-mono tabular-nums text-text-muted';

/** One owned bubble tier the tank can raise on the spot. */
const ShieldButton = memo(
  ({
    itemId,
    count,
    isDisabled,
    onRaise,
  }: {
    readonly itemId: ItemId;
    readonly count: number;
    readonly isDisabled: boolean;
    readonly onRaise: (itemId: ItemId) => void;
  }) => {
    const handleClick = useFunction(() => onRaise(itemId));
    const name = scorchedT.itemNames[itemId];

    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        title={scorchedT.turn.shieldHint(name)}
        className={actionClass}
      >
        <ShieldPlus size={HUD_ICON_SIZE_PX} aria-hidden="true" />
        {name}
        <span className={countClass}>×{count}</span>
      </button>
    );
  }
);

/**
 * [§7, §8] What a tank can do with its turn other than shoot: put a battery in, raise a bubble,
 * drive out of the crater it is sitting in, and call the helicopter. The inventory ones only show
 * what the active tank actually owns; retreat is always there, because a tank with an empty locker
 * is exactly the one that needs the helicopter.
 */
export const TurnActionsBar = observer(() => {
  const store = useScorchedStore();
  const { activePlayerId, activePlayer, isFuelMoveMode } = store;

  const handleSpendBattery = useFunction(() => {
    store.spendBattery();
  });

  const handleToggleFuelMove = useFunction(() => {
    store.setFuelMoveMode(!store.isFuelMoveMode);
  });

  const handleDriveLeft = useFunction(() => {
    store.driveTank(DRIVE_LEFT);
  });

  const handleDriveRight = useFunction(() => {
    store.driveTank(DRIVE_RIGHT);
  });

  const handleRetreat = useFunction(() => {
    store.retreat();
  });

  const handleRaiseShield = useFunction((itemId: ItemId) => {
    store.raiseShield(itemId);
  });

  if (isNil(activePlayerId) || store.isAiTurn) {
    return null;
  }

  const batteryCount = store.turnItemCounts.battery ?? NO_STOCK;
  const fuelCount = store.turnItemCounts.fuel ?? NO_STOCK;
  const isWhole = (activePlayer?.health ?? MAX_TANK_HEALTH) >= MAX_TANK_HEALTH;
  // Turn actions only land during your own aiming phase; while a shot flies or the ground
  // settles, the domain would refuse them silently — grey the buttons out instead.
  const isTurnLocked = !store.isAiming;
  const ownedShields = SHIELD_ITEM_IDS.map(itemId => ({
    itemId,
    count: store.turnItemCounts[itemId] ?? NO_STOCK,
  })).filter(shield => shield.count > NO_STOCK);

  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/60 px-2 py-1.5 backdrop-blur-sm">
      {batteryCount === NO_STOCK ? null : (
        <button
          type="button"
          onClick={handleSpendBattery}
          disabled={isTurnLocked || isWhole}
          title={isWhole ? scorchedT.turn.batteryFull : scorchedT.turn.battery}
          className={actionClass}
        >
          <BatteryCharging size={HUD_ICON_SIZE_PX} aria-hidden="true" />
          {scorchedT.turn.battery}
          <span className={countClass}>×{batteryCount}</span>
        </button>
      )}

      {ownedShields.map(shield => (
        <ShieldButton
          key={shield.itemId}
          itemId={shield.itemId}
          count={shield.count}
          isDisabled={isTurnLocked}
          onRaise={handleRaiseShield}
        />
      ))}

      {fuelCount === NO_STOCK ? null : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleFuelMove}
            disabled={isTurnLocked}
            aria-pressed={isFuelMoveMode}
            title={scorchedT.turn.driveHint}
            className={cn(actionClass, isFuelMoveMode && activeActionClass)}
          >
            <Fuel size={HUD_ICON_SIZE_PX} aria-hidden="true" />
            {scorchedT.turn.drive}
            <span className={countClass}>×{fuelCount}</span>
          </button>

          {isFuelMoveMode ? (
            <>
              <button
                type="button"
                onClick={handleDriveLeft}
                aria-label={scorchedT.turn.driveLeft}
                className={cn(actionClass, 'px-2')}
              >
                <ChevronLeft size={HUD_ICON_SIZE_PX} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={handleDriveRight}
                aria-label={scorchedT.turn.driveRight}
                className={cn(actionClass, 'px-2')}
              >
                <ChevronRight size={HUD_ICON_SIZE_PX} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      )}

      <button
        type="button"
        onClick={handleRetreat}
        disabled={isTurnLocked}
        title={scorchedT.turn.retreatHint}
        className={actionClass}
      >
        <LifeBuoy size={HUD_ICON_SIZE_PX} aria-hidden="true" />
        {scorchedT.turn.retreat}
      </button>
    </div>
  );
});
