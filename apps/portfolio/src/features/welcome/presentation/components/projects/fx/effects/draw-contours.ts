/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import type { IFxDrawContext } from '../types';

/** Contour lines of a slowly breathing terrain, inside the dashed plot border. */
export function drawContours({
  ctx,
  width,
  height,
  time,
  speed,
  accent,
  dpr,
}: IFxDrawContext): void {
  const drift = time * speed * 0.35;
  const contourCount = 9;
  const stepX = Math.max(3 * dpr, width / 64);
  const plotLeft = width * 0.08;
  const plotRight = width * 0.92;
  const plotTop = height * 0.1;
  const plotBottom = height * 0.9;

  ctx.lineWidth = 1.1 * dpr;
  for (let contourIndex = 0; contourIndex < contourCount; contourIndex++) {
    const level = contourIndex / (contourCount - 1);
    const baseY = plotTop + (plotBottom - plotTop) * (0.06 + 0.88 * level);
    const amplitude = height * (0.05 + 0.025 * Math.sin(contourIndex * 1.27));

    // The middle contours read as the ridge of the slope, so they carry the ink.
    ctx.strokeStyle = accent(0.16 + 0.5 * (1 - Math.abs(level - 0.5) * 2));
    ctx.beginPath();
    for (let x = 0; x <= width; x += stepX) {
      const phase = (x / width) * Math.PI * 2;
      const y =
        baseY +
        amplitude * Math.sin(phase * 1.6 + drift + contourIndex * 0.42) +
        amplitude * 0.4 * Math.sin(phase * 2.7 - drift * 0.7 + contourIndex * 0.9);
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  ctx.strokeStyle = accent(0.45);
  ctx.lineWidth = 1.3 * dpr;
  ctx.setLineDash([6 * dpr, 5 * dpr]);
  ctx.strokeRect(plotLeft, plotTop, plotRight - plotLeft, plotBottom - plotTop);
  ctx.setLineDash([]);

  const markCount = 3;
  for (let markIndex = 0; markIndex < markCount; markIndex++) {
    const markX = plotLeft + (plotRight - plotLeft) * (0.22 + 0.28 * markIndex);
    const markY = plotTop + (plotBottom - plotTop) * (0.68 - 0.2 * markIndex);
    const pulse = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(drift * 2 + markIndex * 1.6));

    ctx.strokeStyle = accent(pulse);
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(markX - 4 * dpr, markY);
    ctx.lineTo(markX + 4 * dpr, markY);
    ctx.moveTo(markX, markY - 4 * dpr);
    ctx.lineTo(markX, markY + 4 * dpr);
    ctx.stroke();
    ctx.fillStyle = accent(pulse);
    ctx.beginPath();
    ctx.arc(markX, markY, 1.6 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  const northX = plotRight - 14 * dpr;
  const northY = plotTop + 16 * dpr;
  const needleLength = 10 * dpr;

  ctx.strokeStyle = accent(0.35);
  ctx.lineWidth = dpr;
  ctx.beginPath();
  ctx.arc(northX, northY, needleLength * 0.85, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = accent(0.9);
  ctx.beginPath();
  ctx.moveTo(northX, northY - needleLength);
  ctx.lineTo(northX + 3.2 * dpr, northY + 2 * dpr);
  ctx.lineTo(northX - 3.2 * dpr, northY + 2 * dpr);
  ctx.closePath();
  ctx.fill();
}
