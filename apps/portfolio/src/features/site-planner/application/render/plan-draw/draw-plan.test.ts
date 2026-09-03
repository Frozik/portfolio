import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElevationMark, createTree } from '../../../domain/model/site-plan';
import type { PlanLayerKind } from '../../../domain/view/plan-layers';
import { PLAN_LAYER_KINDS } from '../../../domain/view/plan-layers';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import type { PlanContent, PlanLabels } from './draw-plan';
import { drawPlan } from './draw-plan';
import {
  callsOf,
  createRecordingContext,
  stubRecordingPath2D,
  valuesSet,
} from './recording-context.test-helpers';
import { PLAN_COLORS } from './shared';

const VIEWPORT: PlanViewport = {
  centerMeters: { x: 0, y: 0 },
  pixelsPerMeter: 10,
  widthPx: 400,
  heightPx: 300,
};

const ENTRY_LETTERS: PlanLabels['entryLetters'] = {
  power: 'Э',
  network: 'И',
  water: 'В',
  sewer: 'К',
  heating: 'Т',
  ventilation: 'вент',
  gas: 'Г',
};

const ROOM_TYPE_NAMES: PlanLabels['roomTypeNames'] = {
  living: 'living',
  bedroom: 'bedroom',
  kitchen: 'kitchen',
  bathroom: 'bathroom',
  sauna: 'sauna',
  hall: 'hall',
  garage: 'garage',
  boiler: 'boiler',
};

const LABELS: PlanLabels = {
  meterUnit: 'м',
  northLabel: 'С',
  padLabelPrefix: '▲',
  entryLetters: ENTRY_LETTERS,
  roomTypeNames: ROOM_TYPE_NAMES,
  squareMeterUnit: 'м²',
  stairUp: 'ВВЕРХ',
};

function contentWith(overrides: Partial<PlanContent> = {}): PlanContent {
  return {
    boundaryPolygons: [],
    buildings: [],
    setbackRings: [],
    contours: [],
    analysisRaster: undefined,
    flowField: undefined,
    elevationMarks: [],
    trees: [],
    cars: [],
    pathRibbons: [],
    utilityRoutes: [],
    gridStepMeters: 1,
    northOffsetDegrees: 0,
    visibleLayers: new Set<PlanLayerKind>(PLAN_LAYER_KINDS),
    ...overrides,
  };
}

function layersWithout(hidden: PlanLayerKind): ReadonlySet<PlanLayerKind> {
  return new Set(PLAN_LAYER_KINDS.filter(kind => kind !== hidden));
}

function paint(content: PlanContent): ReturnType<typeof createRecordingContext>['calls'] {
  const { ctx, calls } = createRecordingContext();

  stubRecordingPath2D(calls);
  drawPlan(ctx, VIEWPORT, { content, images: { overlayImage: undefined }, labels: LABELS });

  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('drawPlan', () => {
  it('grounds the sheet first: the backdrop precedes everything else', () => {
    const calls = paint(contentWith());

    expect(calls[0]).toMatchObject({ method: 'set:fillStyle', args: [PLAN_COLORS.background] });
    expect(calls[1]).toMatchObject({
      method: 'fillRect',
      args: [0, 0, VIEWPORT.widthPx, VIEWPORT.heightPx],
    });
  });

  it('always closes with the corner chrome: compass and scale bar', () => {
    const calls = paint(contentWith({ visibleLayers: new Set<PlanLayerKind>() }));
    const texts = callsOf(calls, 'fillText').map(call => call.args[0]);

    expect(texts).toContain(LABELS.northLabel);
    expect(texts.some(text => typeof text === 'string' && text.endsWith(LABELS.meterUnit))).toBe(
      true
    );
  });

  it('rules the grid only while its layer is visible', () => {
    const withGrid = paint(contentWith());
    const without = paint(contentWith({ visibleLayers: layersWithout('grid') }));

    expect(valuesSet(withGrid, 'strokeStyle')).toContain(PLAN_COLORS.gridMinor);
    expect(valuesSet(without, 'strokeStyle')).not.toContain(PLAN_COLORS.gridMinor);
  });

  it('plots elevation marks only while their layer is visible', () => {
    const mark = createElevationMark({ position: { x: 0, y: 0 }, elevation: 12 });
    const withMarks = paint(contentWith({ elevationMarks: [mark] }));
    const without = paint(
      contentWith({ elevationMarks: [mark], visibleLayers: layersWithout('marks') })
    );

    expect(valuesSet(withMarks, 'fillStyle')).toContain(PLAN_COLORS.markFill);
    expect(valuesSet(without, 'fillStyle')).not.toContain(PLAN_COLORS.markFill);
  });

  it('plants trees only while their layer is visible', () => {
    const tree = createTree({
      species: 'pine',
      position: { x: 2, y: 2 },
      crownRadius: 2,
      height: 6,
    });
    const withTrees = paint(contentWith({ trees: [tree] }));
    const without = paint(contentWith({ trees: [tree], visibleLayers: layersWithout('trees') }));

    expect(valuesSet(withTrees, 'strokeStyle')).toContain(PLAN_COLORS.treeStroke);
    expect(valuesSet(without, 'strokeStyle')).not.toContain(PLAN_COLORS.treeStroke);
  });

  it('outlines the plot boundary whenever the plot has one', () => {
    const boundary = [
      {
        outer: [
          { x: -5, y: -5 },
          { x: 5, y: -5 },
          { x: 5, y: 5 },
          { x: -5, y: 5 },
        ],
        holes: [],
      },
    ];
    const withPlot = paint(contentWith({ boundaryPolygons: boundary }));
    const bare = paint(contentWith());

    expect(valuesSet(withPlot, 'strokeStyle')).toContain(PLAN_COLORS.boundaryStroke);
    expect(valuesSet(bare, 'strokeStyle')).not.toContain(PLAN_COLORS.boundaryStroke);
  });

  it('leaves the sheet clean of editor chrome while none is handed in', () => {
    const calls = paint(contentWith());

    expect(valuesSet(calls, 'strokeStyle')).not.toContain(PLAN_COLORS.selectionStroke);
    expect(valuesSet(calls, 'strokeStyle')).not.toContain(PLAN_COLORS.snapIndicatorStroke);
  });
});
