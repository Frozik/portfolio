import { observer } from 'mobx-react-lite';

import type { SpaceGolfStore } from '../../application/SpaceGolfStore';
import { spaceGolfT } from '../translations';

const ICON_SIZE_PX = 13;

/**
 * What is left of the grip bonus: its logo — a splat of gum with the ball
 * stuck in its middle — in the bonus's own pink, and the touches that will still
 * stick. Gone with the last of them.
 */
export const GripStatus = observer(({ store }: { readonly store: SpaceGolfStore }) => {
  if (store.grip === 0) {
    return null;
  }
  return (
    <span
      className="flex h-7 items-center gap-1 rounded-md bg-black/50 px-1.5 font-mono text-xs tabular-nums text-pink-300"
      role="img"
      aria-label={spaceGolfT.hud.grip(store.grip)}
      title={spaceGolfT.hud.grip(store.grip)}
    >
      <svg width={ICON_SIZE_PX} height={ICON_SIZE_PX} viewBox="0 0 14 14" aria-hidden="true">
        <g fill="currentColor">
          <circle cx="7" cy="7" r="3.2" />
          <circle cx="7.00" cy="2.97" r="1.10" />
          <circle cx="4.19" cy="5.38" r="0.78" />
          <circle cx="3.51" cy="9.02" r="1.10" />
          <circle cx="7.00" cy="10.25" r="0.78" />
          <circle cx="10.49" cy="9.02" r="1.10" />
          <circle cx="9.81" cy="5.38" r="0.78" />
        </g>
        <circle cx="7" cy="7" r="1.9" fill="white" />
      </svg>
      {store.grip}
    </span>
  );
});
