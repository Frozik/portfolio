/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import { MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';

export function drawAR({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const cx = width / 2;
  const cy = height * 0.54;
  const faceW = Math.min(width, height) * 0.44;
  const faceH = faceW * 1.3;

  const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.7);
  baseGrad.addColorStop(0, accent(0.06));
  baseGrad.addColorStop(1, accent(0));
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = accent(0.18);
  ctx.lineWidth = dpr;
  ctx.setLineDash([3 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.ellipse(cx, cy + faceH * 0.02, faceW / 2, faceH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const bx = cx - faceW / 2 - 10 * dpr;
  const by = cy - faceH / 2 - 10 * dpr;
  const bw = faceW + 20 * dpr;
  const bhh = faceH + 20 * dpr;
  const cornerLen = 18 * dpr;
  const cornerPulse = 0.55 + 0.45 * Math.sin(time * speed * 2);

  ctx.strokeStyle = accent(0.55);
  ctx.lineWidth = 1.5 * dpr;
  ctx.globalAlpha = 0.55 + cornerPulse * 0.45;
  const corners: Array<[number, number, number, number]> = [
    [bx, by, 1, 1],
    [bx + bw, by, -1, 1],
    [bx, by + bhh, 1, -1],
    [bx + bw, by + bhh, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLen * sy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLen * sx, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const eyeY = cy - faceH * 0.12;
  const eyeDx = faceW * 0.2;
  const leftEye = { x: cx - eyeDx, y: eyeY };
  const rightEye = { x: cx + eyeDx, y: eyeY };

  const lensW = faceW * 0.3;
  const lensH = faceH * 0.14;

  for (const eye of [leftEye, rightEye]) {
    const grad = ctx.createRadialGradient(eye.x, eye.y, 0, eye.x, eye.y, lensW * 0.9);
    grad.addColorStop(0, accent(0.32));
    grad.addColorStop(1, accent(0));
    ctx.fillStyle = grad;
    ctx.fillRect(eye.x - lensW, eye.y - lensH, lensW * 2, lensH * 2);
  }

  ctx.strokeStyle = accent(0.98);
  ctx.lineWidth = 1.8 * dpr;
  for (const eye of [leftEye, rightEye]) {
    ctx.strokeRect(eye.x - lensW / 2, eye.y - lensH / 2, lensW, lensH);
  }

  ctx.beginPath();
  ctx.moveTo(leftEye.x + lensW / 2, eyeY);
  ctx.lineTo(rightEye.x - lensW / 2, eyeY);
  ctx.moveTo(leftEye.x - lensW / 2, eyeY);
  ctx.lineTo(leftEye.x - lensW / 2 - faceW * 0.18, eyeY - lensH * 0.2);
  ctx.moveTo(rightEye.x + lensW / 2, eyeY);
  ctx.lineTo(rightEye.x + lensW / 2 + faceW * 0.18, eyeY - lensH * 0.2);
  ctx.stroke();

  const scanLineY = by + ((time * speed * 45) % (bhh + 20));
  if (scanLineY < by + bhh) {
    const scanGrad = ctx.createLinearGradient(bx, scanLineY, bx + bw, scanLineY);
    scanGrad.addColorStop(0, accent(0));
    scanGrad.addColorStop(0.5, accent(0.8));
    scanGrad.addColorStop(1, accent(0));
    ctx.fillStyle = scanGrad;
    ctx.fillRect(bx, scanLineY - dpr, bw, 2 * dpr);
  }

  ctx.fillStyle = accent(0.75);
  ctx.font = `${9 * dpr}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText('AR · LIVE', 10 * dpr, height - 10 * dpr);
}
