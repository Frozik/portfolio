import { isNil } from 'lodash-es';

import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

const MIN_CANDLE_WIDTH_PX = 5;
const CANDLE_WIDTH_DIVISOR = 32;
const CANDLE_GAP_RATIO = 0.25;
const EXTRA_VISIBLE_CANDLES = 4;
const SCROLL_SPEED = 0.6;
const WARMUP_CANDLES = 50;
const VERTICAL_PADDING_PX = 18;
const START_PRICE = 100;
const DRIFT_RANGE = 6;
const WICK_RANGE = 3;
const RANDOM_CENTER = 0.5;
const SEED_DRIFT = 1;
const SEED_HIGH = 2;
const SEED_LOW = 3;
const VALUE_PADDING_RATIO = 0.08;
const GRID_ROWS = 5;
const GRID_ALPHA = 0.06;
const BULLISH_ALPHA = 0.85;
const BEARISH_ALPHA = 0.35;
const BEARISH_FILL_ALPHA = 0.12;
const CRISP_INSET_PX = 0.5;
const LAST_PRICE_ALPHA = 0.5;
const LAST_PRICE_DASH_PX = [2, 3] as const;
const CROSSHAIR_X_BASE = 0.35;
const CROSSHAIR_X_RANGE = 0.3;
const CROSSHAIR_X_SPEED = 0.6;
const CROSSHAIR_Y_BASE = 0.38;
const CROSSHAIR_Y_RANGE = 0.22;
const CROSSHAIR_Y_SPEED = 0.9;
const CROSSHAIR_Y_PHASE = 1;
const CROSSHAIR_ALPHA = 0.55;
const CROSSHAIR_DASH_PX = [3, 4] as const;
const CROSSHAIR_DOT_RADIUS_PX = 3;
const CROSSHAIR_RING_RADIUS_PX = 8;
const CROSSHAIR_RING_ALPHA = 0.4;

interface ICandle {
  readonly open: number;
  readonly close: number;
  readonly high: number;
  readonly low: number;
}

function generateCandles(firstIndex: number, count: number): readonly ICandle[] {
  const candles: ICandle[] = [];
  let price = START_PRICE;
  // Earlier candles are walked so the visible ones start at a settled price.
  for (
    let candleIndex = firstIndex - WARMUP_CANDLES;
    candleIndex <= firstIndex + count;
    candleIndex++
  ) {
    const drift = (pseudoRandom(candleIndex, SEED_DRIFT) - RANDOM_CENTER) * DRIFT_RANGE;
    const open = price;
    const close = price + drift;
    if (candleIndex >= firstIndex) {
      candles.push({
        open,
        close,
        high: Math.max(open, close) + pseudoRandom(candleIndex, SEED_HIGH) * WICK_RANGE,
        low: Math.min(open, close) - pseudoRandom(candleIndex, SEED_LOW) * WICK_RANGE,
      });
    }
    price = close;
  }
  return candles;
}

/** A scrolling candlestick chart with a wandering crosshair. */
export function drawCrosshair({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const candleWidth = Math.max(
    MIN_CANDLE_WIDTH_PX * devicePixelRatio,
    width / CANDLE_WIDTH_DIVISOR
  );
  const pitch = candleWidth + Math.max(devicePixelRatio, candleWidth * CANDLE_GAP_RATIO);
  const visibleCandleCount = Math.ceil(width / pitch) + EXTRA_VISIBLE_CANDLES;
  const scrollPosition = time * SCROLL_SPEED;
  const offsetX = -(scrollPosition % 1) * pitch;
  const chartTop = VERTICAL_PADDING_PX * devicePixelRatio;
  const chartBottom = height - chartTop;
  const chartHeight = chartBottom - chartTop;

  const candles = generateCandles(Math.floor(scrollPosition), visibleCandleCount);
  const lowest = Math.min(...candles.map(candle => candle.low));
  const highest = Math.max(...candles.map(candle => candle.high));
  const valuePadding = (highest - lowest) * VALUE_PADDING_RATIO;
  const valueMin = lowest - valuePadding;
  const valueMax = highest + valuePadding;
  const priceToY = (priceValue: number): number =>
    chartBottom - ((priceValue - valueMin) / (valueMax - valueMin)) * chartHeight;

  ctx.strokeStyle = accent(GRID_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  for (let gridLineIndex = 1; gridLineIndex < GRID_ROWS; gridLineIndex++) {
    const y = chartTop + (chartHeight * gridLineIndex) / GRID_ROWS;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  candles.forEach((candle, candleIndex) => {
    const x = offsetX + candleIndex * pitch;
    const middleX = x + candleWidth / 2;
    const bullish = candle.close >= candle.open;
    const bodyTop = priceToY(Math.max(candle.open, candle.close));
    const bodyHeight = Math.max(
      devicePixelRatio,
      priceToY(Math.min(candle.open, candle.close)) - bodyTop
    );
    const color = bullish ? accent(BULLISH_ALPHA) : accent(BEARISH_ALPHA);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, devicePixelRatio);
    ctx.beginPath();
    ctx.moveTo(middleX, priceToY(candle.high));
    ctx.lineTo(middleX, priceToY(candle.low));
    ctx.stroke();
    if (bullish) {
      ctx.fillStyle = color;
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
    } else {
      ctx.fillStyle = accent(BEARISH_FILL_ALPHA);
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
      ctx.strokeStyle = color;
      ctx.strokeRect(
        x + CRISP_INSET_PX,
        bodyTop + CRISP_INSET_PX,
        candleWidth - CRISP_INSET_PX * 2,
        bodyHeight - CRISP_INSET_PX * 2
      );
    }
  });

  const lastCandle = candles.at(-1);
  if (!isNil(lastCandle)) {
    const lastPriceY = priceToY(lastCandle.close);
    ctx.strokeStyle = accent(LAST_PRICE_ALPHA);
    ctx.lineWidth = devicePixelRatio;
    ctx.setLineDash(LAST_PRICE_DASH_PX.map(dash => dash * devicePixelRatio));
    ctx.beginPath();
    ctx.moveTo(0, lastPriceY);
    ctx.lineTo(width, lastPriceY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const crosshairX =
    width *
    (CROSSHAIR_X_BASE +
      CROSSHAIR_X_RANGE * (RANDOM_CENTER + RANDOM_CENTER * Math.sin(time * CROSSHAIR_X_SPEED)));
  const crosshairY =
    height *
    (CROSSHAIR_Y_BASE +
      CROSSHAIR_Y_RANGE *
        (RANDOM_CENTER + RANDOM_CENTER * Math.sin(time * CROSSHAIR_Y_SPEED + CROSSHAIR_Y_PHASE)));

  ctx.strokeStyle = accent(CROSSHAIR_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.setLineDash(CROSSHAIR_DASH_PX.map(dash => dash * devicePixelRatio));
  ctx.beginPath();
  ctx.moveTo(crosshairX, 0);
  ctx.lineTo(crosshairX, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, crosshairY);
  ctx.lineTo(width, crosshairY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = accent(1);
  ctx.beginPath();
  ctx.arc(crosshairX, crosshairY, CROSSHAIR_DOT_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent(CROSSHAIR_RING_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.beginPath();
  ctx.arc(crosshairX, crosshairY, CROSSHAIR_RING_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
  ctx.stroke();
}
