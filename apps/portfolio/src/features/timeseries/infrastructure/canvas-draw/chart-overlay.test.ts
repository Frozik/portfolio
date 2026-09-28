import { describe, expect, it, vi } from 'vitest';

import type { ICrosshair } from '../../domain/crosshair';
import type { IChartFrameLayout } from '../../domain/frame-layout';
import type { ITextMeasurer } from '../../domain/text-measurer';
import type { ILoadingRegion } from '../../domain/types';
import type { IChartOverlayFrame } from './chart-overlay';
import { ChartOverlay } from './chart-overlay';

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 220;

function createLayout(timeStart: number): IChartFrameLayout {
  return {
    timeStart,
    timeEnd: timeStart + 100,
    valueMin: 0,
    valueMax: 50,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    dpr: 1,
    plotLeft: 10,
    plotTop: 10,
    plotWidth: 400,
    plotHeight: 200,
    plotRight: 410,
    plotBottom: 210,
    xTicks: [{ position: timeStart + 50, label: 'Jul' }],
    yTicks: [{ position: 25, label: '25.0' }],
  };
}

function createOverlay() {
  const context = {
    clearRect: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  const textMeasurer: ITextMeasurer = {
    measureWidth: () => 20,
    getGlyphMetrics: () => ({ ascent: 8, descent: 0, centerOffset: 4 }),
  };
  return {
    overlay: new ChartOverlay(context as unknown as CanvasRenderingContext2D, textMeasurer),
    context,
  };
}

function createFrame(overrides: Partial<IChartOverlayFrame>): IChartOverlayFrame {
  return {
    layout: undefined,
    crosshair: undefined,
    loadingRegions: [],
    timeStart: 0,
    timeEnd: 100,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    devicePixelRatio: 1,
    canvasCleared: false,
    ...overrides,
  };
}

function createCrosshair(lineLeft: number, lineTop: number): ICrosshair {
  return {
    lineLeft,
    lineTop,
    thickness: 1,
    centerThickness: 3,
    centerArmLength: 10,
    dashLength: 4,
    timeLabel: '6 Jul 00:07',
    valueLabel: '110.0',
  };
}

const LOADING_REGION: ILoadingRegion = { timeStart: 20, timeEnd: 60, progress: 0 };

describe('ChartOverlay', () => {
  it('paints the axis labels of the first layout it is given', () => {
    const { overlay, context } = createOverlay();

    overlay.paint(createFrame({ layout: createLayout(0) }));

    expect(context.fillText.mock.calls.map(([label]) => label)).toEqual(['Jul', '25.0']);
  });

  it('keeps what it painted while the layout stays the same', () => {
    const { overlay, context } = createOverlay();
    const layout = createLayout(0);

    overlay.paint(createFrame({ layout }));
    overlay.paint(createFrame({ layout }));
    overlay.paint(createFrame({ layout }));

    expect(context.clearRect).toHaveBeenCalledOnce();
  });

  it('repaints from a clean canvas when the layout changes', () => {
    const { overlay, context } = createOverlay();

    overlay.paint(createFrame({ layout: createLayout(0) }));
    overlay.paint(createFrame({ layout: createLayout(10) }));

    expect(context.clearRect).toHaveBeenCalledTimes(2);
    expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  });

  it('repaints an unchanged layout after a resize cleared the canvas', () => {
    const { overlay, context } = createOverlay();
    const layout = createLayout(0);

    overlay.paint(createFrame({ layout }));
    overlay.paint(createFrame({ layout, canvasCleared: true }));

    expect(context.fillText).toHaveBeenCalledTimes(4);
  });

  it('repaints every frame while a loading bar is animating', () => {
    const { overlay, context } = createOverlay();
    const layout = createLayout(0);

    overlay.paint(createFrame({ layout, loadingRegions: [LOADING_REGION] }));
    overlay.paint(createFrame({ layout, loadingRegions: [LOADING_REGION] }));

    expect(context.clearRect).toHaveBeenCalledTimes(2);
    expect(context.fillRect).toHaveBeenCalledTimes(2);
  });

  it('erases the loading bar once loading has finished, then goes quiet', () => {
    const { overlay, context } = createOverlay();
    const layout = createLayout(0);

    overlay.paint(createFrame({ layout, loadingRegions: [LOADING_REGION] }));
    overlay.paint(createFrame({ layout }));
    overlay.paint(createFrame({ layout }));

    expect(context.clearRect).toHaveBeenCalledTimes(2);
    expect(context.fillRect).toHaveBeenCalledOnce();
  });

  it('writes the time and the value the crosshair points at above the tick labels', () => {
    const { overlay, context } = createOverlay();

    overlay.paint(createFrame({ layout: createLayout(0), crosshair: createCrosshair(200, 100) }));

    expect(context.fillText.mock.calls.map(([label]) => label)).toEqual([
      'Jul',
      '25.0',
      '6 Jul 00:07',
      '110.0',
    ]);
  });

  it('keeps what it painted while the crosshair rests', () => {
    const { overlay, context } = createOverlay();
    const layout = createLayout(0);

    overlay.paint(createFrame({ layout, crosshair: createCrosshair(200, 100) }));
    overlay.paint(createFrame({ layout, crosshair: createCrosshair(200, 100) }));

    expect(context.clearRect).toHaveBeenCalledOnce();
  });

  it('repaints when the crosshair moves', () => {
    const { overlay, context } = createOverlay();
    const layout = createLayout(0);

    overlay.paint(createFrame({ layout, crosshair: createCrosshair(200, 100) }));
    overlay.paint(createFrame({ layout, crosshair: createCrosshair(201, 100) }));

    expect(context.clearRect).toHaveBeenCalledTimes(2);
  });

  it('erases the crosshair once the pointer has left', () => {
    const { overlay, context } = createOverlay();
    const layout = createLayout(0);

    overlay.paint(createFrame({ layout, crosshair: createCrosshair(200, 100) }));
    overlay.paint(createFrame({ layout }));

    expect(context.clearRect).toHaveBeenCalledTimes(2);
    expect(context.fillText.mock.calls.slice(-2).map(([label]) => label)).toEqual(['Jul', '25.0']);
  });
});
