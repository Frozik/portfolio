import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

const PADDING_RATIO = 0.06;
const ROW_COUNT = 6;
const ROW_GAP_RATIO = 0.35;
const LABEL_WIDTH_RATIO = 0.32;
const VALUE_WIDTH_MIN = 0.2;
const VALUE_WIDTH_MAX = 0.4;
const LABEL_ALPHA = 0.32;
const VALUE_ALPHA = 0.5;
const MASK_ALPHA = 0.18;
const MASK_STRIPES = 4;
const MASK_STRIPE_ALPHA = 0.1;
const MASKED_ROWS: ReadonlySet<number> = new Set([1, 3, 4]);
const CYCLE_SECONDS = 4;
const MASK_RISE_SECONDS = 0.5;
const SHUTTER_AT = 0.55;
const SHUTTER_SECONDS = 0.35;
const SHUTTER_ALPHA = 0.55;
const FRAME_ALPHA = 0.7;
const FRAME_INSET_RATIO = 0.03;
const FRAME_CORNER_RATIO = 0.08;
const FRAME_GROW = 0.04;
const BUG_RADIUS_RATIO = 0.055;
const BUG_ALPHA = 0.9;
const BUG_PULSE_SECONDS = 1.6;
const BUG_PULSE_RATIO = 0.12;

/**
 * A report in the making: a form of label/value rows, the sensitive values
 * frosted over as the capture arms, a shutter flash with the frame corners
 * snapping in, then everything clears for the next cycle — while the bug
 * button pulses in the corner.
 */
export function drawShutter({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const padding = width * PADDING_RATIO;
  const innerWidth = width - padding * 2;
  const rowPitch = (height - padding * 2) / ROW_COUNT;
  const rowHeight = rowPitch * (1 - ROW_GAP_RATIO);
  const phase = (time % CYCLE_SECONDS) / CYCLE_SECONDS;
  const masked = Math.min(1, (phase * CYCLE_SECONDS) / MASK_RISE_SECONDS);
  const sinceShutter = (phase - SHUTTER_AT) * CYCLE_SECONDS;
  const shutter =
    sinceShutter >= 0 && sinceShutter < SHUTTER_SECONDS ? 1 - sinceShutter / SHUTTER_SECONDS : 0;

  for (let row = 0; row < ROW_COUNT; row++) {
    const top = padding + row * rowPitch + (rowPitch - rowHeight) / 2;
    const labelWidth = innerWidth * LABEL_WIDTH_RATIO * (0.6 + 0.4 * pseudoRandom(row, 1));
    ctx.fillStyle = accent(LABEL_ALPHA);
    ctx.fillRect(padding, top, labelWidth, rowHeight);

    const valueWidth =
      innerWidth * (VALUE_WIDTH_MIN + (VALUE_WIDTH_MAX - VALUE_WIDTH_MIN) * pseudoRandom(row, 2));
    const valueLeft = padding + innerWidth - valueWidth;
    const isMasked = MASKED_ROWS.has(row);
    ctx.fillStyle = accent(isMasked ? VALUE_ALPHA * (1 - masked) : VALUE_ALPHA);
    ctx.fillRect(valueLeft, top, valueWidth, rowHeight);
    if (isMasked && masked > 0) {
      ctx.fillStyle = accent(MASK_ALPHA * masked);
      ctx.fillRect(
        valueLeft - padding * 0.5,
        top - rowHeight * 0.2,
        valueWidth + padding,
        rowHeight * 1.4
      );
      ctx.fillStyle = accent(MASK_STRIPE_ALPHA * masked);
      const stripe = valueWidth / (MASK_STRIPES * 2);
      for (let index = 0; index < MASK_STRIPES; index++) {
        ctx.fillRect(valueLeft + stripe * (index * 2 + 0.5), top, stripe, rowHeight);
      }
    }
  }

  if (shutter > 0) {
    ctx.fillStyle = accent(SHUTTER_ALPHA * shutter);
    ctx.fillRect(0, 0, width, height);
    const inset = width * (FRAME_INSET_RATIO + FRAME_GROW * (1 - shutter));
    const corner = width * FRAME_CORNER_RATIO;
    ctx.strokeStyle = accent(FRAME_ALPHA * shutter);
    ctx.lineWidth = devicePixelRatio * 2;
    for (const [sx, sy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      const x = sx > 0 ? inset : width - inset;
      const y = sy > 0 ? inset : height - inset;
      ctx.beginPath();
      ctx.moveTo(x, y + sy * corner);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * corner, y);
      ctx.stroke();
    }
  }

  const pulse = 1 + BUG_PULSE_RATIO * Math.sin((time / BUG_PULSE_SECONDS) * Math.PI * 2);
  const radius = width * BUG_RADIUS_RATIO * pulse;
  ctx.fillStyle = accent(BUG_ALPHA);
  ctx.beginPath();
  ctx.arc(width - padding - radius, height - padding - radius, radius, 0, Math.PI * 2);
  ctx.fill();
}
