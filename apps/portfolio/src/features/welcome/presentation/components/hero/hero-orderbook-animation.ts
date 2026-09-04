import { assert } from '@frozik/utils/assert/assert';
import { isNil, random } from 'lodash-es';

import type {
  IAmbientCanvasAnimation,
  IAmbientCanvasFrame,
  IAmbientCanvasResize,
} from '../../../../../shared/hooks/useAmbientCanvas';
import type { IOrderbookLayout, IOrderbookPalette } from './hero-orderbook-paint';
import { paintOrderbook, readOrderbookPalette } from './hero-orderbook-paint';
import type { IOrderbookSimulation } from './hero-orderbook-simulation';
import {
  advanceOrderbook,
  createOrderbookSimulation,
  DEPTH_COLUMNS,
  DEPTH_LEVELS,
} from './hero-orderbook-simulation';

const TAPE_WIDTH_MAX_PX = 260;
const TAPE_WIDTH_RATIO = 0.22;
const TAPE_PADDING_PX = 20;
const TAPE_HEADER_OFFSET_PX = 14;

function computeLayout(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  devicePixelRatio: number
): IOrderbookLayout {
  const { width, height } = canvas;
  const tapeWidth = Math.min(TAPE_WIDTH_MAX_PX, cssWidth * TAPE_WIDTH_RATIO) * devicePixelRatio;
  const bookWidth = width - tapeWidth - TAPE_PADDING_PX * devicePixelRatio;
  return {
    width,
    height,
    devicePixelRatio,
    bookWidth,
    cellWidth: bookWidth / DEPTH_COLUMNS,
    cellHeight: height / DEPTH_LEVELS,
    tapeWidth,
    tapePaddingPx: TAPE_PADDING_PX * devicePixelRatio,
    tapeOriginX: width - tapeWidth + TAPE_HEADER_OFFSET_PX * devicePixelRatio,
  };
}

/** Scrolling BTC/USDT depth heatmap with a live trade tape; draws in backing-store pixels. */
export function createHeroOrderbookAnimation(
  randomUnit: () => number = () => random(0, 1, true)
): IAmbientCanvasAnimation {
  let simulation: IOrderbookSimulation | undefined;
  let palette: IOrderbookPalette = readOrderbookPalette();
  let cssWidth = 0;

  return {
    onResize({ cssWidth: nextCssWidth }: IAmbientCanvasResize): void {
      palette = readOrderbookPalette();
      cssWidth = nextCssWidth;
      simulation ??= createOrderbookSimulation(randomUnit);
    },

    draw(frame: IAmbientCanvasFrame): void {
      assert(!isNil(simulation), 'HeroOrderbook: onResize runs before the first draw');
      simulation = advanceOrderbook(simulation, frame.deltaMs, randomUnit);
      paintOrderbook(
        frame.ctx,
        simulation,
        computeLayout(frame.ctx.canvas, cssWidth, frame.dpr),
        palette
      );
    },
  };
}
