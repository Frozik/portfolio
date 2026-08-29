/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import { MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

export function drawArtillery({
  ctx,
  width,
  height,
  time,
  speed,
  accent,
  dpr,
}: IFxDrawContext): void {
  const groundY = height * 0.82;
  const columns = 46;
  const columnWidth = width / columns;
  const terrainHeight = (columnIndex: number) =>
    groundY -
    height *
      (0.1 +
        0.16 * Math.sin(columnIndex * 0.34) +
        0.07 * Math.sin(columnIndex * 0.93 + 1.7) +
        0.04 * pseudoRandom(columnIndex, 5));

  ctx.strokeStyle = accent(0.55);
  ctx.lineWidth = 1.3 * dpr;
  ctx.beginPath();
  for (let columnIndex = 0; columnIndex <= columns; columnIndex++) {
    const x = columnIndex * columnWidth;
    const y = terrainHeight(columnIndex);
    if (columnIndex === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = accent(0.12);
  ctx.lineWidth = dpr;
  for (let columnIndex = 1; columnIndex < columns; columnIndex += 3) {
    const x = columnIndex * columnWidth;
    ctx.beginPath();
    ctx.moveTo(x, terrainHeight(columnIndex));
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  const shooterColumn = 6;
  const targetColumn = 37;
  const shooterX = shooterColumn * columnWidth;
  const shooterY = terrainHeight(shooterColumn);
  const targetX = targetColumn * columnWidth;
  const targetY = terrainHeight(targetColumn);

  const shotPeriod = 2.4;
  const shotPhase = ((time * speed) / shotPeriod) % 1;
  const flightEnd = 0.7;
  const apexHeight = height * 0.62;
  const arcAt = (progress: number) => ({
    x: shooterX + (targetX - shooterX) * progress,
    y:
      shooterY + (targetY - shooterY) * progress - apexHeight * 4 * progress * (1 - progress) * 0.5,
  });

  const barrelAngle = -Math.PI / 4;
  const barrelLength = width * 0.075;
  ctx.strokeStyle = accent(0.95);
  ctx.lineWidth = 1.6 * dpr;
  ctx.beginPath();
  ctx.moveTo(shooterX, shooterY - 3 * dpr);
  ctx.lineTo(
    shooterX + Math.cos(barrelAngle) * barrelLength,
    shooterY - 3 * dpr + Math.sin(barrelAngle) * barrelLength
  );
  ctx.stroke();
  ctx.fillStyle = accent(1);
  ctx.beginPath();
  ctx.arc(shooterX, shooterY - 3 * dpr, 3.4 * dpr, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent(0.7);
  ctx.beginPath();
  ctx.arc(targetX, targetY - 3 * dpr, 2.6 * dpr, 0, Math.PI * 2);
  ctx.fill();

  const flightProgress = Math.min(1, shotPhase / flightEnd);
  const dotCount = 26;
  for (let dotIndex = 0; dotIndex <= dotCount; dotIndex++) {
    const progress = (dotIndex / dotCount) * flightProgress;
    if (progress <= 0) {
      continue;
    }
    const point = arcAt(progress);
    ctx.fillStyle = accent(0.18 + 0.5 * (progress / Math.max(flightProgress, 0.001)));
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  if (shotPhase < flightEnd) {
    const shell = arcAt(flightProgress);
    ctx.fillStyle = accent(1);
    ctx.beginPath();
    ctx.arc(shell.x, shell.y, 2.6 * dpr, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const blast = 1 - (shotPhase - flightEnd) / (1 - flightEnd);
    const radius = (7 + 22 * (1 - blast)) * dpr;
    const gradient = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, radius);
    gradient.addColorStop(0, accent(0.8 * blast));
    gradient.addColorStop(1, accent(0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(targetX, targetY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent(0.5 * blast);
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.arc(targetX, targetY, radius * 0.85, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  const windDashCount = 5;
  const windDrift = (time * speed * 28 * dpr) % (30 * dpr);
  ctx.strokeStyle = accent(0.3);
  ctx.lineWidth = dpr;
  for (let dashIndex = 0; dashIndex < windDashCount; dashIndex++) {
    const y = height * (0.13 + dashIndex * 0.055);
    const x = (width * 0.12 + windDrift + dashIndex * 18 * dpr) % (width * 0.7);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16 * dpr, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 16 * dpr, y);
    ctx.lineTo(x + 11 * dpr, y - 3 * dpr);
    ctx.moveTo(x + 16 * dpr, y);
    ctx.lineTo(x + 11 * dpr, y + 3 * dpr);
    ctx.stroke();
  }

  ctx.fillStyle = accent(0.75);
  ctx.font = `${9 * dpr}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText('WIND \u219242', 10 * dpr, height - 10 * dpr);
}
