import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { TriangleAlert } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingWarning } from '../../domain/model/building-warnings';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const GLYPH_SIZE_PX = 12;

function describeWarning(warning: BuildingWarning): string {
  const labels = sitePlannerT.warnings;
  const { meterUnit } = sitePlannerT.plan;

  switch (warning.kind) {
    case 'furniture-over-stairwell':
      return labels.furnitureOverStairwell;
    case 'wall-over-stairwell':
      return labels.wallOverStairwell;
    case 'stair-uncomfortable':
      return labels.stairUncomfortable;
    case 'cantilever-unsupported':
      return warning.needsEngineering
        ? labels.cantileverEngineered(
            formatMeters(warning.overhangMeters, meterUnit, METER_DECIMALS)
          )
        : labels.cantileverUnsupported(
            formatMeters(warning.overhangMeters, meterUnit, METER_DECIMALS)
          );
    case 'storey-too-low':
      return labels.storeyTooLow(formatMeters(warning.heightMeters, meterUnit, METER_DECIMALS));
    case 'roof-too-flat':
      return labels.roofTooFlat(warning.pitchDegrees);
    case 'room-without-exhaust':
      return labels.roomWithoutExhaust(sitePlannerT.rooms.types[warning.roomTypeId]);
    case 'duct-outside-roof':
      return labels.ductOutsideRoof;
    case 'sauna-without-stove':
      return labels.saunaWithoutStove;
    default:
      return assertNever(warning);
  }
}

/**
 * One finding as a place to go to, not a complaint to read: the row names the
 * rule and takes the view to what it is about.
 */
const WarningRow = memo(
  ({ store, warning }: { readonly store: SitePlannerStore; readonly warning: BuildingWarning }) => {
    const handleClick = useFunction(() => store.revealWarning(warning));

    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'flex w-full items-start gap-1.5 rounded-md border border-amber-500/30 p-1.5 text-left',
          'transition-colors duration-150 hover:bg-amber-500/10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
        )}
      >
        <TriangleAlert
          size={GLYPH_SIZE_PX}
          className="mt-0.5 shrink-0 text-amber-500"
          aria-hidden
        />
        <span className="min-w-0 flex-1 text-[11px] leading-snug text-text">
          {describeWarning(warning)}
        </span>
      </button>
    );
  }
);

/**
 * Every advisory the open building earns, in one list. Norm findings named and
 * walkable is the part of this editor the consumer planners have no answer to;
 * hiding them in amber highlights on the canvas would waste that.
 */
export const WarningsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const warnings = store.scene.buildingWarnings;

  return (
    <PlannerPanel title={sitePlannerT.warnings.panelTitle}>
      {warnings.map((warning, index) => (
        <WarningRow
          // A finding has no identity of its own: it IS its place in the pass.
          // oxlint-disable-next-line react/no-array-index-key -- derived findings are positional
          key={index}
          store={store}
          warning={warning}
        />
      ))}
      {warnings.length === 0 ? <PanelHint>{sitePlannerT.warnings.empty}</PanelHint> : undefined}
    </PlannerPanel>
  );
});
