/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import { DARK_SURFACE_HEX, darkSurface, MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

export function drawTicker({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const axisW = 48 * dpr;
  const gridW = width - axisW;
  const gridH = height;
  const rows = 28;
  const cellH = gridH / rows;
  const colW = Math.max(4 * dpr, gridW / 60);
  const cols = Math.ceil(gridW / colW) + 2;

  const midRaw =
    rows / 2 + Math.sin(time * speed * 0.18) * 4 + Math.sin(time * speed * 0.07 + 1.2) * 2.5;

  const midY = (column: number) => {
    const localTime = time - column * (colW / (gridW * speed * 0.5 + 1)) * 0.15;
    return (
      rows / 2 +
      Math.sin(localTime * speed * 0.18) * 4 +
      Math.sin(localTime * speed * 0.07 + 1.2) * 2.5
    );
  };

  const scroll = (time * speed * 0.8) % 1;
  const offsetX = -scroll * colW;

  ctx.fillStyle = darkSurface(0.4);
  ctx.fillRect(0, 0, gridW, gridH);

  const firstColumnIndex = Math.floor(time * speed * 0.8);
  for (let columnIndex = 0; columnIndex < cols; columnIndex++) {
    const columnAbsolute = firstColumnIndex + columnIndex;
    const x = offsetX + columnIndex * colW;
    const midAtColumn = midY(columnIndex);

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const distance = rowIndex - midAtColumn;
      const absDistance = Math.abs(distance);
      let base = Math.exp(-((absDistance / 4.2) ** 2)) * 0.6;
      const noise = pseudoRandom(columnAbsolute * 0.3, rowIndex);
      base += noise * noise * 0.5 * Math.max(0, 1 - absDistance / 12);
      const wallSeed = rowIndex + Math.floor((columnAbsolute / 35) % 999);
      if (pseudoRandom(wallSeed, rowIndex * 0.11) > 0.82) {
        base += 0.55 * Math.max(0, 1 - absDistance / 10);
      }
      if (base < 0.03) {
        continue;
      }
      const intensity = Math.min(1, base);
      const isBid = rowIndex > midAtColumn;
      const y = rowIndex * cellH;
      ctx.fillStyle = isBid ? accent(intensity * 0.9) : accent(intensity * 0.45);
      ctx.fillRect(x, y, colW + 0.5, cellH + 0.5);
    }
  }

  const midLineY = midRaw * cellH + cellH / 2;
  ctx.strokeStyle = accent(0.9);
  ctx.lineWidth = 1.4 * dpr;
  ctx.setLineDash([4 * dpr, 3 * dpr]);
  ctx.beginPath();
  const samples = 40;
  ctx.moveTo(0, midY(cols - 1) * cellH + cellH / 2);
  for (let sampleIndex = 1; sampleIndex <= samples; sampleIndex++) {
    const progress = sampleIndex / samples;
    const column = (cols - 1) * (1 - progress);
    const x = progress * gridW;
    const y = midY(column) * cellH + cellH / 2;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `${9 * dpr}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = accent(0.35);
  ctx.textAlign = 'left';
  const basePrice = 67892.5;
  const step = 2.5;
  for (let rowIndex = 2; rowIndex < rows; rowIndex += 4) {
    const y = rowIndex * cellH + cellH / 2;
    const price = basePrice + (rows / 2 - rowIndex) * step;
    ctx.fillText(price.toFixed(1), gridW + 4 * dpr, y + 3 * dpr);
  }

  const price = (basePrice + (rows / 2 - midRaw) * step).toFixed(2);
  const priceWidth = ctx.measureText(price).width + 10 * dpr;
  ctx.fillStyle = accent(1);
  ctx.fillRect(gridW + 2 * dpr, midLineY - 8 * dpr, priceWidth, 16 * dpr);
  ctx.fillStyle = DARK_SURFACE_HEX;
  ctx.fillText(price, gridW + 7 * dpr, midLineY + 3.5 * dpr);

  ctx.fillStyle = accent(0.6);
  ctx.fillText('BTC/USDT · DEPTH', 8 * dpr, 14 * dpr);
  if (Math.floor(time * 3) % 2 === 0) {
    ctx.fillStyle = accent(0.95);
    ctx.beginPath();
    ctx.arc(10 * dpr, height - 10 * dpr, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = accent(0.65);
  ctx.fillText('LIVE · WSS', 18 * dpr, height - 7 * dpr);
}
