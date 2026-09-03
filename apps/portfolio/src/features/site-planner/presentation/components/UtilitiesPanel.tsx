import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { Trash2, TriangleAlert } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { UTILITY_SYSTEM_COLORS } from '../../application/render/plan-draw/draw-house';
import { formatCubicMeters, formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { RouteWarning } from '../../domain/model/route-warnings';
import type { UtilityRoute } from '../../domain/model/routing';
import { routeLengthMeters } from '../../domain/model/routing';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const GLYPH_SIZE_PX = 12;
const WARNING_DEPTH_DECIMALS = 1;
const ROUTE_LENGTH_DECIMALS = 1;

/** One trench's row: its system's colour and name, its length, removable. */
const RouteRow = observer(
  ({ store, route }: { readonly store: SitePlannerStore; readonly route: UtilityRoute }) => {
    const labels = sitePlannerT.utilities;
    const isSelected = store.selectedUtilityRoute?.id === route.id;

    const handleSelect = useFunction(() => {
      store.setSelection({ kind: 'utilityRoute', routeId: route.id });
    });
    const handleRemove = useFunction(() => {
      store.removeUtilityRoute(route.id);
    });

    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md border p-1.5',
          isSelected ? 'border-brand-500' : 'border-white/10'
        )}
      >
        <span
          className="inline-block size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: UTILITY_SYSTEM_COLORS[route.system] }}
        />
        <button
          type="button"
          onClick={handleSelect}
          className={cn(
            'min-w-0 flex-1 truncate text-left text-[11px] text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
          )}
        >
          {labels.systems[route.system]}
        </button>
        <span className="shrink-0 font-mono text-[10px] text-text-secondary">
          {formatMeters(
            routeLengthMeters(route.points),
            sitePlannerT.plan.meterUnit,
            ROUTE_LENGTH_DECIMALS
          )}
        </span>
        <button
          type="button"
          aria-label={labels.remove}
          title={labels.remove}
          onClick={handleRemove}
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md',
            'text-text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
          )}
        >
          <Trash2 size={GLYPH_SIZE_PX} aria-hidden />
        </button>
      </div>
    );
  }
);

/** «Water — rises above its code burial: 0.9 m (norm 1.5 m)». */
function describeWarning(warning: RouteWarning, routes: readonly UtilityRoute[]): string {
  const labels = sitePlannerT.utilities;
  const system = routes.find(route => route.id === warning.routeId)?.system;
  const systemName = isNil(system) ? '' : labels.systems[system];
  const figures = `${warning.actualMeters.toFixed(WARNING_DEPTH_DECIMALS)} ${sitePlannerT.plan.meterUnit} (${labels.normPrefix} ${warning.requiredMeters.toFixed(WARNING_DEPTH_DECIMALS)} ${sitePlannerT.plan.meterUnit})`;

  switch (warning.kind) {
    case 'shallow-depth':
      return `${systemName} — ${labels.warnings.shallowDepth}: ${figures}`;
    case 'driveable-cover':
      return `${systemName} — ${labels.warnings.driveableCover}: ${figures}`;
    case 'parallel-separation': {
      const other = routes.find(route => route.id === warning.otherRouteId)?.system;
      const otherName = isNil(other) ? '' : ` (${labels.systems[other]})`;

      return `${systemName} — ${labels.warnings.parallelSeparation}${otherName}: ${figures}`;
    }
    default:
      return assertNever(warning);
  }
}

/**
 * The site's utilities (`building-editor.md` §8): every drawn trench with its
 * derived length, the advisory findings of the norm pass, what the digging
 * displaces — and the СП 62 disclaimer whenever gas is on the plan.
 */
export const UtilitiesPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const labels = sitePlannerT.utilities;
  const routes = store.utilityRoutes;
  const warnings = store.routeWarnings;
  const hasGas = routes.some(route => route.system === 'gas');

  return (
    <PlannerPanel title={labels.title}>
      {routes.map(route => (
        <RouteRow key={route.id} store={store} route={route} />
      ))}
      {warnings.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-text-secondary uppercase">{labels.warningsTitle}</span>
          {warnings.map(warning => (
            <span
              key={`${warning.kind}:${warning.routeId}`}
              className="flex items-start gap-1 text-[11px] text-amber-400"
            >
              <TriangleAlert size={GLYPH_SIZE_PX} className="mt-0.5 shrink-0" aria-hidden />
              {describeWarning(warning, routes)}
            </span>
          ))}
        </div>
      ) : undefined}
      {routes.length > 0 ? (
        <span className="font-mono text-[10px] text-text-secondary">
          {`${labels.trenchVolume}: ${formatCubicMeters(
            store.totalTrenchVolumeCubicMeters,
            sitePlannerT.house.cubicMeterUnit
          )}`}
        </span>
      ) : undefined}
      {hasGas ? <PanelHint>{labels.gasDisclaimer}</PanelHint> : undefined}
      {routes.length === 0 ? <PanelHint>{labels.empty}</PanelHint> : undefined}
    </PlannerPanel>
  );
});
