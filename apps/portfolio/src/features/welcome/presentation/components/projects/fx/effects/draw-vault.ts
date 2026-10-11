import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

const PADDING_RATIO = 0.08;
const ROW_COUNT = 5;
const ROW_GAP_RATIO = 0.4;
const ICON_ALPHA = 0.35;
const DOT_ALPHA = 0.55;
const REVEALED_ALPHA = 0.7;
const DOTS_MIN = 8;
const DOTS_SPREAD = 6;
const DOT_PITCH_RATIO = 0.9;
const ROW_SECONDS = 1.6;
const REVEAL_SHARE = 0.6;
const LOCK_WIDTH_RATIO = 0.2;
const LOCK_ALPHA = 0.85;
const SHACKLE_LIFT_RATIO = 0.25;

/**
 * A vault at work: rows of masked passwords, one shown at a time — its dots
 * turning into characters while the padlock's shackle lifts — then masked
 * again as the next row opens.
 */
export function drawVault({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const padding = width * PADDING_RATIO;
  const lockWidth = width * LOCK_WIDTH_RATIO;
  const listWidth = width - padding * 3 - lockWidth;
  const rowPitch = (height - padding * 2) / ROW_COUNT;
  const rowHeight = rowPitch * (1 - ROW_GAP_RATIO);
  const step = time / ROW_SECONDS;
  const shownRow = Math.floor(step) % ROW_COUNT;
  const progress = step - Math.floor(step);
  const revealed = progress < REVEAL_SHARE ? Math.sin((progress / REVEAL_SHARE) * Math.PI) : 0;

  for (let row = 0; row < ROW_COUNT; row++) {
    const top = padding + row * rowPitch + (rowPitch - rowHeight) / 2;
    ctx.fillStyle = accent(ICON_ALPHA);
    ctx.fillRect(padding, top, rowHeight, rowHeight);
    const dots = DOTS_MIN + Math.floor(pseudoRandom(row, 3) * DOTS_SPREAD);
    const pitch = Math.min(rowHeight * DOT_PITCH_RATIO, (listWidth - rowHeight * 2) / dots);
    const show = row === shownRow ? revealed : 0;
    for (let dot = 0; dot < dots; dot++) {
      const left = padding + rowHeight * 2 + dot * pitch;
      if (show > 0) {
        const barHeight = rowHeight * (0.5 + 0.5 * pseudoRandom(row, dot)) * show;
        ctx.fillStyle = accent(REVEALED_ALPHA * show);
        ctx.fillRect(left, top + rowHeight - barHeight, pitch * 0.7, barHeight);
      }
      ctx.fillStyle = accent(DOT_ALPHA * (1 - show));
      ctx.beginPath();
      ctx.arc(left + pitch * 0.35, top + rowHeight / 2, rowHeight * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const bodyLeft = width - padding - lockWidth;
  const bodyTop = height / 2;
  const bodyHeight = lockWidth * 0.8;
  const shackleRadius = lockWidth * 0.32;
  const lift = lockWidth * SHACKLE_LIFT_RATIO * revealed;
  ctx.strokeStyle = accent(LOCK_ALPHA);
  ctx.lineWidth = devicePixelRatio * 3;
  ctx.beginPath();
  ctx.moveTo(bodyLeft + lockWidth / 2 - shackleRadius, bodyTop - lift);
  ctx.arc(bodyLeft + lockWidth / 2, bodyTop - lift, shackleRadius, Math.PI, 0);
  ctx.lineTo(bodyLeft + lockWidth / 2 + shackleRadius, bodyTop);
  ctx.stroke();
  ctx.fillStyle = accent(LOCK_ALPHA);
  ctx.fillRect(bodyLeft, bodyTop, lockWidth, bodyHeight);
}
