/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

export function drawCrosshair({
  ctx,
  width,
  height,
  time,
  speed,
  accent,
  dpr,
}: IFxDrawContext): void {
  const candleW = Math.max(5 * dpr, width / 32);
  const gap = Math.max(dpr, candleW * 0.25);
  const pitch = candleW + gap;
  const visibleCandleCount = Math.ceil(width / pitch) + 4;
  const scroll = (time * speed * 0.6) % 1;
  const offsetX = -scroll * pitch;
  const startIdx = Math.floor(time * speed * 0.6);
  const vertPad = 18 * dpr;
  const chartTop = vertPad;
  const chartBottom = height - vertPad;
  const chartH = chartBottom - chartTop;

  const series: Array<{ open: number; close: number; high: number; low: number; index: number }> =
    [];
  let price = 100;
  for (
    let candleIndex = startIdx - 50;
    candleIndex <= startIdx + visibleCandleCount;
    candleIndex++
  ) {
    const drift = (pseudoRandom(candleIndex, 1) - 0.5) * 6;
    const open = price;
    const close = price + drift;
    const high = Math.max(open, close) + pseudoRandom(candleIndex, 2) * 3;
    const low = Math.min(open, close) - pseudoRandom(candleIndex, 3) * 3;
    if (candleIndex >= startIdx) {
      series.push({ open, close, high, low, index: candleIndex });
    }
    price = close;
  }

  let valueMin = Number.POSITIVE_INFINITY;
  let valueMax = Number.NEGATIVE_INFINITY;
  for (const candle of series) {
    if (candle.low < valueMin) {
      valueMin = candle.low;
    }
    if (candle.high > valueMax) {
      valueMax = candle.high;
    }
  }
  const valuePadding = (valueMax - valueMin) * 0.08;
  valueMin -= valuePadding;
  valueMax += valuePadding;
  const priceToY = (priceValue: number) =>
    chartBottom - ((priceValue - valueMin) / (valueMax - valueMin)) * chartH;

  ctx.strokeStyle = accent(0.06);
  ctx.lineWidth = dpr;
  for (let gridLineIndex = 1; gridLineIndex < 5; gridLineIndex++) {
    const y = chartTop + (chartH * gridLineIndex) / 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let candleIndex = 0; candleIndex < series.length; candleIndex++) {
    const candle = series[candleIndex];
    const x = offsetX + candleIndex * pitch;
    const xMid = x + candleW / 2;
    const bullish = candle.close >= candle.open;
    const bodyTop = priceToY(Math.max(candle.open, candle.close));
    const bodyBot = priceToY(Math.min(candle.open, candle.close));
    const yHi = priceToY(candle.high);
    const yLo = priceToY(candle.low);
    const color = bullish ? accent(0.85) : accent(0.35);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    ctx.moveTo(xMid, yHi);
    ctx.lineTo(xMid, yLo);
    ctx.stroke();
    if (bullish) {
      ctx.fillStyle = color;
      ctx.fillRect(x, bodyTop, candleW, Math.max(dpr, bodyBot - bodyTop));
    } else {
      ctx.fillStyle = accent(0.12);
      ctx.fillRect(x, bodyTop, candleW, Math.max(dpr, bodyBot - bodyTop));
      ctx.strokeStyle = color;
      ctx.strokeRect(x + 0.5, bodyTop + 0.5, candleW - 1, Math.max(dpr, bodyBot - bodyTop) - 1);
    }
  }

  const last = series[series.length - 1];
  if (last) {
    const py = priceToY(last.close);
    ctx.strokeStyle = accent(0.5);
    ctx.lineWidth = dpr;
    ctx.setLineDash([2 * dpr, 3 * dpr]);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(width, py);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const cx = width * (0.35 + 0.3 * (0.5 + 0.5 * Math.sin(time * speed * 0.6)));
  const cy = height * (0.38 + 0.22 * (0.5 + 0.5 * Math.sin(time * speed * 0.9 + 1)));

  ctx.strokeStyle = accent(0.55);
  ctx.lineWidth = dpr;
  ctx.setLineDash([3 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(width, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = accent(1);
  ctx.beginPath();
  ctx.arc(cx, cy, 3 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = accent(0.4);
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, 8 * dpr, 0, Math.PI * 2);
  ctx.stroke();
}
