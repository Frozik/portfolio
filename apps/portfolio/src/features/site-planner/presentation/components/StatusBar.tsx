import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { formatMeters } from '../../domain/plan-draw/shared';
import { sitePlannerT } from '../translations';
import { StatusBarShell } from './StatusBarShell';
import { toolHint } from './toolHints';

const AXIS_X_PREFIX = 'x:';
const AXIS_Y_PREFIX = 'y:';
const PERCENT_SUFFIX = '%';

/**
 * Cursor position, grid step, zoom and the hint for the tool in hand. The cursor
 * readout is written by the input layer once per animation frame, so this row
 * re-renders no more often than the canvas repaints.
 *
 * A narrow screen keeps the two readouts that change as the user works and drops
 * the rest: a phone has no room for a sentence of instructions under the plan.
 */
export const StatusBar = observer(
  ({
    store,
    isCompact = false,
  }: {
    readonly store: SitePlannerStore;
    readonly isCompact?: boolean;
  }) => {
    const { meterUnit } = sitePlannerT.plan;
    const { cursorPlanPoint } = store;

    return (
      <StatusBarShell>
        <span className="font-mono">
          {AXIS_X_PREFIX} {formatAxis(cursorPlanPoint, 'x', meterUnit)}
        </span>
        <span className="font-mono">
          {AXIS_Y_PREFIX} {formatAxis(cursorPlanPoint, 'y', meterUnit)}
        </span>
        {isCompact ? undefined : (
          <span className="font-mono">
            {sitePlannerT.status.grid} {formatMeters(store.settings.gridStepMeters, meterUnit)}
          </span>
        )}
        <span className="font-mono">
          {sitePlannerT.status.zoom} {store.zoomPercent}
          {PERCENT_SUFFIX}
        </span>
        {isCompact ? undefined : <span className="truncate">{toolHint(store.activeTool)}</span>}
      </StatusBarShell>
    );
  }
);

function formatAxis(
  cursorPlanPoint: Vector2 | undefined,
  axis: keyof Vector2,
  meterUnit: string
): string {
  return isNil(cursorPlanPoint)
    ? sitePlannerT.status.unknownValue
    : formatMeters(cursorPlanPoint[axis], meterUnit);
}
