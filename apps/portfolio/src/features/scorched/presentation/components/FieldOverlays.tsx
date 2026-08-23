import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { useScorchedStore } from '../../application/useScorchedStore';
import {
  DAMAGE_POPUP_SECONDS,
  FIELD_HEIGHT_WU,
  TANK_HEIGHT_WU,
  TAUNT_VISIBLE_SECONDS,
} from '../../domain/constants';
import { getPlayerColor } from '../../infrastructure/player-colors';
import type { ScorchedViewTransform } from '../../infrastructure/view-transform';
import { toScreenPosition } from '../../infrastructure/view-transform';
import { scorchedT } from '../translations';

/** How far above a tank its speech bubble floats, in world units. */
const TAUNT_OFFSET_WU = 26;
/** A damage number drifts this far up over its lifetime, in CSS pixels. */
const POPUP_DRIFT_PX = 28;
/** A repair is green and reads "+"; a wound keeps the player's own colour and reads "−". */
const REPAIR_COLOR = 'var(--color-emerald-400)';

/**
 * [§13] The two contextual overlays drawn over the field in React rather than on the GPU: damage
 * numbers floating away from the point of impact and taunt bubbles above the tanks. Both are text,
 * both are short-lived, and both are far cheaper as DOM than as a glyph atlas in a shape batch.
 */
export const FieldOverlays = observer(
  ({ transform }: { readonly transform: ScorchedViewTransform }) => {
    const store = useScorchedStore();

    if (transform.scale <= 0) {
      return null;
    }

    return (
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {store.damagePopups.map(popup => {
          const screen = toScreenPosition(
            transform,
            popup.position.x,
            popup.position.y,
            FIELD_HEIGHT_WU
          );
          const remainingFraction = popup.remainingSeconds / DAMAGE_POPUP_SECONDS;

          return (
            <span
              key={popup.id}
              className="absolute -translate-x-1/2 font-mono text-sm font-semibold tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              style={{
                left: `${screen.x}px`,
                top: `${screen.y - POPUP_DRIFT_PX * (1 - remainingFraction)}px`,
                color: popup.kind === 'repair' ? REPAIR_COLOR : getPlayerColor(popup.playerId).hex,
                opacity: Math.min(1, remainingFraction * 2),
              }}
            >
              {popup.kind === 'repair' ? '+' : '−'}
              {popup.amount}
            </span>
          );
        })}

        {store.taunts.map(taunt => {
          const tank = store.roundRef.current.getTank(taunt.playerId);

          if (isNil(tank)) {
            return null;
          }

          const screen = toScreenPosition(
            transform,
            tank.columnIndex + 0.5,
            tank.positionY + TANK_HEIGHT_WU + TAUNT_OFFSET_WU,
            FIELD_HEIGHT_WU
          );

          return (
            <span
              key={`${taunt.playerId}:${taunt.kind}:${taunt.lineIndex}`}
              className="absolute max-w-48 -translate-x-1/2 rounded-xl border border-white/15 bg-black/75 px-2.5 py-1 text-center text-xs leading-snug text-text backdrop-blur-sm transition-opacity duration-200"
              style={{
                left: `${screen.x}px`,
                top: `${screen.y}px`,
                opacity: Math.min(1, (taunt.remainingSeconds / TAUNT_VISIBLE_SECONDS) * 3),
              }}
            >
              {scorchedT.taunts[taunt.kind][taunt.lineIndex]}
            </span>
          );
        })}
      </div>
    );
  }
);
