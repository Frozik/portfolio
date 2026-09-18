import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import type { SpaceGolfStore } from '../../application/SpaceGolfStore';
import { spaceGolfT } from '../translations';

/**
 * A measure of the course as long as it is on the screen now: what the
 * compass's metres are read against, and shown only with them — with the
 * cup on screen there is no distance to read. One metre at the one scale,
 * a rounder measure as the view zooms out.
 */
export const ScaleBar = observer(({ store }: { readonly store: SpaceGolfStore }) => {
  const { compass, scaleBar } = store.view;
  if (isNil(compass) || compass.cupOnScreen) {
    return null;
  }
  const { meters, pixels } = scaleBar;
  return (
    <div
      className="flex flex-col items-center gap-0.5 font-mono text-xs tabular-nums text-neutral-200"
      role="img"
      aria-label={spaceGolfT.hud.scale(meters)}
    >
      <span
        className="h-1.5 border-x border-b border-neutral-200"
        style={{ width: `${pixels}px` }}
      />
      <span>{spaceGolfT.hud.meters(meters)}</span>
    </div>
  );
});
