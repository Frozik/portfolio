/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import { MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';

export function drawTanks({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const cell = 16 * dpr;
  ctx.strokeStyle = accent(0.05);
  ctx.lineWidth = dpr;
  for (let gridX = cell; gridX < width; gridX += cell) {
    ctx.beginPath();
    ctx.moveTo(gridX, 0);
    ctx.lineTo(gridX, height);
    ctx.stroke();
  }
  for (let gridY = cell; gridY < height; gridY += cell) {
    ctx.beginPath();
    ctx.moveTo(0, gridY);
    ctx.lineTo(width, gridY);
    ctx.stroke();
  }

  const wallX = width * 0.78;
  const brickW = width * 0.055;
  const brickH = height * 0.11;
  const brickRows = 5;
  const brickColumns = 2;
  const wallTop = height * 0.5 - (brickRows * brickH) / 2;
  const volleyPeriod = 1.6;
  const volley = Math.floor((time * speed) / volleyPeriod);
  const volleyPhase = ((time * speed) / volleyPeriod) % 1;
  const totalBricks = brickRows * brickColumns;
  const destroyedCount = volley % (totalBricks + 4);

  for (let row = 0; row < brickRows; row++) {
    for (let column = 0; column < brickColumns; column++) {
      const brickIndex = row * brickColumns + column;
      if (brickIndex < destroyedCount) {
        continue;
      }
      const x = wallX + column * brickW;
      const y = wallTop + row * brickH;
      ctx.fillStyle = accent(0.07);
      ctx.fillRect(x, y, brickW - 2 * dpr, brickH - 2 * dpr);
      ctx.strokeStyle = accent(0.35);
      ctx.lineWidth = dpr;
      ctx.strokeRect(x, y, brickW - 2 * dpr, brickH - 2 * dpr);
      ctx.beginPath();
      ctx.moveTo(x, y + brickH / 2);
      ctx.lineTo(x + brickW - 2 * dpr, y + brickH / 2);
      ctx.stroke();
    }
  }

  const volleyStart = (volley * volleyPeriod) / speed;
  const tankY = height / 2 + Math.sin(volleyStart * speed * 0.9) * height * 0.22;
  const liveTankY = height / 2 + Math.sin(time * speed * 0.9) * height * 0.22;
  const tankX = width * 0.16;
  const bodyW = width * 0.09;
  const bodyH = bodyW * 0.78;

  ctx.strokeStyle = accent(0.9);
  ctx.lineWidth = 1.4 * dpr;
  ctx.strokeRect(tankX - bodyW / 2, liveTankY - bodyH / 2, bodyW, bodyH);
  const treadOffset = (time * speed * 26 * dpr) % (6 * dpr);
  ctx.strokeStyle = accent(0.5);
  ctx.lineWidth = dpr;
  for (const side of [-1, 1]) {
    const treadX = tankX + side * (bodyW / 2 + 2.5 * dpr);
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.lineDashOffset = -treadOffset;
    ctx.beginPath();
    ctx.moveTo(treadX, liveTankY - bodyH / 2);
    ctx.lineTo(treadX, liveTankY + bodyH / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = accent(0.9);
  ctx.lineWidth = 1.4 * dpr;
  ctx.beginPath();
  ctx.arc(tankX, liveTankY, bodyW * 0.26, 0, Math.PI * 2);
  ctx.stroke();
  const barrelLength = bodyW * 0.75;
  ctx.beginPath();
  ctx.moveTo(tankX + bodyW * 0.26, liveTankY);
  ctx.lineTo(tankX + bodyW * 0.26 + barrelLength, liveTankY);
  ctx.stroke();

  const barrelTip = tankX + bodyW * 0.26 + barrelLength;
  const flightEnd = 0.55;
  if (volleyPhase < flightEnd) {
    const bulletX = barrelTip + (wallX - barrelTip) * (volleyPhase / flightEnd);
    ctx.fillStyle = accent(0.95);
    ctx.fillRect(bulletX - 2 * dpr, tankY - 1.5 * dpr, 4 * dpr, 3 * dpr);
    ctx.strokeStyle = accent(0.25);
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(barrelTip, tankY);
    ctx.lineTo(bulletX, tankY);
    ctx.stroke();
  } else if (volleyPhase < flightEnd + 0.18) {
    const flash = 1 - (volleyPhase - flightEnd) / 0.18;
    const radius = (6 + 10 * (1 - flash)) * dpr;
    const gradient = ctx.createRadialGradient(wallX, tankY, 0, wallX, tankY, radius);
    gradient.addColorStop(0, accent(0.85 * flash));
    gradient.addColorStop(1, accent(0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(wallX, tankY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = accent(0.75);
  ctx.font = `${9 * dpr}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText('STAGE 01', 10 * dpr, height - 10 * dpr);
}
