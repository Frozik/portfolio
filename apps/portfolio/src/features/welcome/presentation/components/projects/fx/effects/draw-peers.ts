/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import { DARK_SURFACE_HEX, MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';

export function drawPeers({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const peerCount = 5;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.32;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < peerCount; i++) {
    const angle = (i / peerCount) * Math.PI * 2 + time * speed * 0.1;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }

  ctx.strokeStyle = accent(0.15);
  ctx.lineWidth = dpr;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      ctx.beginPath();
      ctx.moveTo(points[i][0], points[i][1]);
      ctx.lineTo(points[j][0], points[j][1]);
      ctx.stroke();
      const phase = (time * speed * 0.6 + (i * 0.2 + j * 0.13)) % 1;
      const px = points[i][0] + (points[j][0] - points[i][0]) * phase;
      const py = points[i][1] + (points[j][1] - points[i][1]) * phase;
      ctx.fillStyle = accent(0.9);
      ctx.beginPath();
      ctx.arc(px, py, 2 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    ctx.fillStyle = accent(0.2);
    ctx.beginPath();
    ctx.arc(x, y, 12 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent(1);
    ctx.beginPath();
    ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = DARK_SURFACE_HEX;
    ctx.font = `${8 * dpr}px ${MONO_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${i + 1}`, x, y);
  }
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
