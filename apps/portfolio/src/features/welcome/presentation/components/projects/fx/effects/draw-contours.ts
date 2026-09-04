import type { IFxDrawContext } from '../types';

const DRIFT_SPEED = 0.35;
const CONTOUR_COUNT = 9;
const MIN_STEP_PX = 3;
const STEP_DIVISOR = 64;
const PLOT_LEFT_RATIO = 0.08;
const PLOT_RIGHT_RATIO = 0.92;
const PLOT_TOP_RATIO = 0.1;
const PLOT_BOTTOM_RATIO = 0.9;
const CONTOUR_LINE_WIDTH_PX = 1.1;
const CONTOUR_TOP_INSET = 0.06;
const CONTOUR_SPAN = 0.88;
const AMPLITUDE_BASE_RATIO = 0.05;
const AMPLITUDE_VARIATION_RATIO = 0.025;
const AMPLITUDE_FREQUENCY = 1.27;
const RIDGE_MIN_ALPHA = 0.16;
const RIDGE_ALPHA_RANGE = 0.5;
const RIDGE_CENTER = 0.5;
const WAVE_FREQUENCY = 1.6;
const WAVE_CONTOUR_PHASE = 0.42;
const RIPPLE_RATIO = 0.4;
const RIPPLE_FREQUENCY = 2.7;
const RIPPLE_DRIFT_RATIO = 0.7;
const RIPPLE_CONTOUR_PHASE = 0.9;
const BORDER_ALPHA = 0.45;
const BORDER_LINE_WIDTH_PX = 1.3;
const BORDER_DASH_PX = [6, 5] as const;
const MARK_COUNT = 3;
const MARK_X_START = 0.22;
const MARK_X_STEP = 0.28;
const MARK_Y_START = 0.68;
const MARK_Y_STEP = 0.2;
const MARK_PULSE_BASE = 0.45;
const MARK_PULSE_RANGE = 0.4;
const MARK_PULSE_SPEED = 2;
const MARK_PULSE_PHASE = 1.6;
const MARK_ARM_PX = 4;
const MARK_DOT_RADIUS_PX = 1.6;
const NORTH_INSET_X_PX = 14;
const NORTH_INSET_Y_PX = 16;
const NEEDLE_LENGTH_PX = 10;
const NEEDLE_RING_RATIO = 0.85;
const NEEDLE_RING_ALPHA = 0.35;
const NEEDLE_ALPHA = 0.9;
const NEEDLE_HALF_WIDTH_PX = 3.2;
const NEEDLE_BASE_PX = 2;

/** Contour lines of a slowly breathing terrain inside a dashed plot border, with survey marks. */
export function drawContours({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const drift = time * DRIFT_SPEED;
  const stepX = Math.max(MIN_STEP_PX * devicePixelRatio, width / STEP_DIVISOR);
  const plotLeft = width * PLOT_LEFT_RATIO;
  const plotRight = width * PLOT_RIGHT_RATIO;
  const plotTop = height * PLOT_TOP_RATIO;
  const plotBottom = height * PLOT_BOTTOM_RATIO;

  ctx.lineWidth = CONTOUR_LINE_WIDTH_PX * devicePixelRatio;
  for (let contourIndex = 0; contourIndex < CONTOUR_COUNT; contourIndex++) {
    const level = contourIndex / (CONTOUR_COUNT - 1);
    const baseY = plotTop + (plotBottom - plotTop) * (CONTOUR_TOP_INSET + CONTOUR_SPAN * level);
    const amplitude =
      height *
      (AMPLITUDE_BASE_RATIO +
        AMPLITUDE_VARIATION_RATIO * Math.sin(contourIndex * AMPLITUDE_FREQUENCY));

    // The middle contours read as the ridge of the slope, so they carry the ink.
    ctx.strokeStyle = accent(
      RIDGE_MIN_ALPHA + RIDGE_ALPHA_RANGE * (1 - Math.abs(level - RIDGE_CENTER) * 2)
    );
    ctx.beginPath();
    for (let x = 0; x <= width; x += stepX) {
      const phase = (x / width) * Math.PI * 2;
      const y =
        baseY +
        amplitude * Math.sin(phase * WAVE_FREQUENCY + drift + contourIndex * WAVE_CONTOUR_PHASE) +
        amplitude *
          RIPPLE_RATIO *
          Math.sin(
            phase * RIPPLE_FREQUENCY -
              drift * RIPPLE_DRIFT_RATIO +
              contourIndex * RIPPLE_CONTOUR_PHASE
          );
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  ctx.strokeStyle = accent(BORDER_ALPHA);
  ctx.lineWidth = BORDER_LINE_WIDTH_PX * devicePixelRatio;
  ctx.setLineDash(BORDER_DASH_PX.map(dash => dash * devicePixelRatio));
  ctx.strokeRect(plotLeft, plotTop, plotRight - plotLeft, plotBottom - plotTop);
  ctx.setLineDash([]);

  const markArm = MARK_ARM_PX * devicePixelRatio;
  for (let markIndex = 0; markIndex < MARK_COUNT; markIndex++) {
    const markX = plotLeft + (plotRight - plotLeft) * (MARK_X_START + MARK_X_STEP * markIndex);
    const markY = plotTop + (plotBottom - plotTop) * (MARK_Y_START - MARK_Y_STEP * markIndex);
    const pulse =
      MARK_PULSE_BASE +
      MARK_PULSE_RANGE *
        (RIDGE_CENTER +
          RIDGE_CENTER * Math.sin(drift * MARK_PULSE_SPEED + markIndex * MARK_PULSE_PHASE));

    ctx.strokeStyle = accent(pulse);
    ctx.lineWidth = devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(markX - markArm, markY);
    ctx.lineTo(markX + markArm, markY);
    ctx.moveTo(markX, markY - markArm);
    ctx.lineTo(markX, markY + markArm);
    ctx.stroke();
    ctx.fillStyle = accent(pulse);
    ctx.beginPath();
    ctx.arc(markX, markY, MARK_DOT_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }

  const northX = plotRight - NORTH_INSET_X_PX * devicePixelRatio;
  const northY = plotTop + NORTH_INSET_Y_PX * devicePixelRatio;
  const needleLength = NEEDLE_LENGTH_PX * devicePixelRatio;

  ctx.strokeStyle = accent(NEEDLE_RING_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.beginPath();
  ctx.arc(northX, northY, needleLength * NEEDLE_RING_RATIO, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = accent(NEEDLE_ALPHA);
  ctx.beginPath();
  ctx.moveTo(northX, northY - needleLength);
  ctx.lineTo(
    northX + NEEDLE_HALF_WIDTH_PX * devicePixelRatio,
    northY + NEEDLE_BASE_PX * devicePixelRatio
  );
  ctx.lineTo(
    northX - NEEDLE_HALF_WIDTH_PX * devicePixelRatio,
    northY + NEEDLE_BASE_PX * devicePixelRatio
  );
  ctx.closePath();
  ctx.fill();
}
