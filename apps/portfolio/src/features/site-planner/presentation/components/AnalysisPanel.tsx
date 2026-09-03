import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';
import { formatCubicMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { RampColor } from '../../domain/terrain/analysis-raster';
import { CUT_FILL_RAMP, SLOPE_RAMP, toCssColor } from '../../domain/terrain/analysis-raster';
import { GENTLE_SLOPE_PERCENT, STEEP_SLOPE_PERCENT } from '../../domain/terrain/slope';
import type { OverlayMode } from '../../domain/view/overlay-mode';
import { sitePlannerT } from '../translations';

/** What the legend calls itself: the analysis it is explaining. */
const OVERLAY_TITLES: Record<Exclude<OverlayMode, 'none'>, string> = {
  slope: sitePlannerT.analysis.slope,
  'cut-fill': sitePlannerT.analysis.cutFill,
};

/**
 * One entry of the legend. The swatch wears its colour inline: the ramp lives in
 * `domain/terrain/analysis-raster.ts` and nowhere else, and a Tailwind class
 * would be a second copy of it — the very drift this overlay is built to avoid.
 */
const LegendRow = memo(
  ({
    color,
    caption,
    value,
  }: {
    readonly color: RampColor;
    readonly caption: string;
    readonly value?: string;
  }) => (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-sm"
        style={{ backgroundColor: toCssColor(color) }}
      />
      <span className="flex-1 text-[11px] text-text-secondary">{caption}</span>
      {isNil(value) ? undefined : <span className="font-mono text-[11px] text-text">{value}</span>}
    </div>
  )
);

/** The three steps of the slope ramp, captioned with the thresholds they stand for. */
const SlopeLegend = memo(() => (
  <>
    <LegendRow
      color={SLOPE_RAMP.gentle}
      caption={sitePlannerT.analysis.slopeSteps.gentle}
      value={`< ${GENTLE_SLOPE_PERCENT} %`}
    />
    <LegendRow
      color={SLOPE_RAMP.moderate}
      caption={sitePlannerT.analysis.slopeSteps.moderate}
      value={`${GENTLE_SLOPE_PERCENT}–${STEEP_SLOPE_PERCENT} %`}
    />
    <LegendRow
      color={SLOPE_RAMP.steep}
      caption={sitePlannerT.analysis.slopeSteps.steep}
      value={`> ${STEEP_SLOPE_PERCENT} %`}
    />
  </>
));

/**
 * The two directions the soil moves, each with the volume the report already
 * worked out. The figures are the store's own `totalCutFill` — every
 * building's report added up — so the legend reports the earthworks rather
 * than computing a second opinion of them.
 */
const CutFillLegend = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const report = store.scene.totalCutFill;

  if (isNil(report)) {
    return <span className="text-[11px] text-text-secondary">{sitePlannerT.analysis.noHouse}</span>;
  }

  const { cubicMeterUnit } = sitePlannerT.house;

  return (
    <>
      <LegendRow
        color={CUT_FILL_RAMP.cut}
        caption={sitePlannerT.house.cut}
        value={formatCubicMeters(report.cutVolumeCubicMeters, cubicMeterUnit)}
      />
      <LegendRow
        color={CUT_FILL_RAMP.fill}
        caption={sitePlannerT.house.fill}
        value={formatCubicMeters(report.fillVolumeCubicMeters, cubicMeterUnit)}
      />
    </>
  );
});

const OverlayLegend = observer(({ store }: { readonly store: SitePlannerStore }) => {
  switch (store.overlayMode) {
    case 'none':
      return undefined;
    case 'slope':
      return <SlopeLegend />;
    case 'cut-fill':
      return <CutFillLegend store={store} />;
    default:
      return assertNever(store.overlayMode);
  }
});

/**
 * What the colours over the ground mean, floating in the corner of whichever
 * canvas is on screen. It reads the same in the plan and in 3D because both are
 * painted from one raster, and it appears only while that raster does.
 */
export const AnalysisPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { overlayMode } = store;

  if (overlayMode === 'none') {
    return undefined;
  }

  return (
    <section
      aria-label={sitePlannerT.analysis.legendTitle}
      className="pointer-events-none absolute top-3 left-3 flex w-64 flex-col gap-1.5 rounded-xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-sm"
    >
      <h2 className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary">
        {OVERLAY_TITLES[overlayMode]}
      </h2>
      <OverlayLegend store={store} />
    </section>
  );
});
