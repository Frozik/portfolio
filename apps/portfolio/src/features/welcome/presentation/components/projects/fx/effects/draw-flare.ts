import type { IFxDrawContext } from '../types';

const RADIUS_RATIO = 0.42;
const RAY_COUNT = 36;
const RAY_ROTATION_SPEED = 0.15;
const RAY_LENGTH_BASE = 0.95;
const RAY_LENGTH_FLICKER = 0.1;
const RAY_FLICKER_SPEED = 2;
const RAY_OUTER_RATIO = 1.15;
const RAY_ALPHA = 0.5;
const RAY_LINE_WIDTH_PX = 1.2;
const SWEEP_SPEED = 0.6;
const SWEEP_RADIUS_RATIO = 1.02;
const SWEEP_ARC_RADIANS = 0.8;
const SWEEP_ALPHA = 0.7;
const SWEEP_LINE_WIDTH_PX = 1.5;
const HALO_RADIUS_RATIO = 1.08;
const HALO_ALPHA = 0.25;
const HALO_DASH_PX = [4, 6] as const;

/** A sun with flickering rays, a sweeping arc and a dashed halo. */
export function drawFlare({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * RADIUS_RATIO;

  for (let rayIndex = 0; rayIndex < RAY_COUNT; rayIndex++) {
    const angle = (rayIndex / RAY_COUNT) * Math.PI * 2 + time * RAY_ROTATION_SPEED;
    const length =
      radius *
      (RAY_LENGTH_BASE + RAY_LENGTH_FLICKER * Math.sin(time * RAY_FLICKER_SPEED + rayIndex));
    const innerX = centerX + Math.cos(angle) * radius * RAY_LENGTH_BASE;
    const innerY = centerY + Math.sin(angle) * radius * RAY_LENGTH_BASE;
    const outerX = centerX + Math.cos(angle) * length * RAY_OUTER_RATIO;
    const outerY = centerY + Math.sin(angle) * length * RAY_OUTER_RATIO;
    const gradient = ctx.createLinearGradient(innerX, innerY, outerX, outerY);
    gradient.addColorStop(0, accent(RAY_ALPHA));
    gradient.addColorStop(1, accent(0));
    ctx.strokeStyle = gradient;
    ctx.lineWidth = RAY_LINE_WIDTH_PX * devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(innerX, innerY);
    ctx.lineTo(outerX, outerY);
    ctx.stroke();
  }

  const sweep = (time * SWEEP_SPEED) % (Math.PI * 2);
  ctx.strokeStyle = accent(SWEEP_ALPHA);
  ctx.lineWidth = SWEEP_LINE_WIDTH_PX * devicePixelRatio;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * SWEEP_RADIUS_RATIO, sweep, sweep + SWEEP_ARC_RADIANS);
  ctx.stroke();

  ctx.strokeStyle = accent(HALO_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.setLineDash(HALO_DASH_PX.map(dash => dash * devicePixelRatio));
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * HALO_RADIUS_RATIO, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}
