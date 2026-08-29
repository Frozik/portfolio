/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import type { IFxDrawContext } from '../types';

export function drawFlare({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.42;
  const rayCount = 36;

  for (let rayIndex = 0; rayIndex < rayCount; rayIndex++) {
    const angle = (rayIndex / rayCount) * Math.PI * 2 + time * speed * 0.15;
    const length = radius * (0.95 + 0.1 * Math.sin(time * speed * 2 + rayIndex));
    const x1 = cx + Math.cos(angle) * radius * 0.95;
    const y1 = cy + Math.sin(angle) * radius * 0.95;
    const x2 = cx + Math.cos(angle) * length * 1.15;
    const y2 = cy + Math.sin(angle) * length * 1.15;
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, accent(0.5));
    gradient.addColorStop(1, accent(0));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const sweep = (time * speed * 0.6) % (Math.PI * 2);
  ctx.strokeStyle = accent(0.7);
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.02, sweep, sweep + 0.8);
  ctx.stroke();

  ctx.strokeStyle = accent(0.25);
  ctx.lineWidth = dpr;
  ctx.setLineDash([4 * dpr, 6 * dpr]);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}
