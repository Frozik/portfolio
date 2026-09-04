import { MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

const GROUND_Y_RATIO = 0.82;
const TERRAIN_COLUMNS = 46;
const TERRAIN_BASE_RATIO = 0.1;
const TERRAIN_WAVE_RATIO = 0.16;
const TERRAIN_WAVE_FREQUENCY = 0.34;
const TERRAIN_RIPPLE_RATIO = 0.07;
const TERRAIN_RIPPLE_FREQUENCY = 0.93;
const TERRAIN_RIPPLE_PHASE = 1.7;
const TERRAIN_NOISE_RATIO = 0.04;
const TERRAIN_NOISE_SEED = 5;
const TERRAIN_ALPHA = 0.55;
const TERRAIN_LINE_WIDTH_PX = 1.3;
const HATCH_ALPHA = 0.12;
const HATCH_EVERY_COLUMNS = 3;
const SHOOTER_COLUMN = 6;
const TARGET_COLUMN = 37;
const SHOT_PERIOD_SEC = 2.4;
const FLIGHT_END_PHASE = 0.7;
const APEX_HEIGHT_RATIO = 0.62;
const APEX_PARABOLA_SCALE = 4;
const APEX_HALF = 0.5;
const BARREL_ANGLE = -Math.PI / 4;
const BARREL_LENGTH_RATIO = 0.075;
const BARREL_ALPHA = 0.95;
const BARREL_LINE_WIDTH_PX = 1.6;
const PIECE_LIFT_PX = 3;
const SHOOTER_RADIUS_PX = 3.4;
const TARGET_RADIUS_PX = 2.6;
const TARGET_ALPHA = 0.7;
const TRAIL_DOTS = 26;
const TRAIL_MIN_ALPHA = 0.18;
const TRAIL_ALPHA_RANGE = 0.5;
const TRAIL_DOT_RADIUS_PX = 1.5;
const TRAIL_PROGRESS_EPSILON = 0.001;
const SHELL_RADIUS_PX = 2.6;
const BLAST_MIN_RADIUS_PX = 7;
const BLAST_RADIUS_RANGE_PX = 22;
const BLAST_CORE_ALPHA = 0.8;
const BLAST_RING_ALPHA = 0.5;
const BLAST_RING_RADIUS_RATIO = 0.85;
const BLAST_RING_LINE_WIDTH_PX = 1.2;
const WIND_DASHES = 5;
const WIND_SPEED_PX = 28;
const WIND_WRAP_PX = 30;
const WIND_ALPHA = 0.3;
const WIND_TOP_RATIO = 0.13;
const WIND_ROW_SPACING_RATIO = 0.055;
const WIND_START_X_RATIO = 0.12;
const WIND_SPAN_X_RATIO = 0.7;
const WIND_DASH_STAGGER_PX = 18;
const WIND_DASH_LENGTH_PX = 16;
const WIND_ARROW_BACK_PX = 11;
const WIND_ARROW_SPREAD_PX = 3;
const TAG_ALPHA = 0.75;
const TAG_FONT_PX = 9;
const TAG_MARGIN_PX = 10;

/** Two artillery pieces on a rolling terrain trading shots under a wind readout. */
export function drawArtillery({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const groundY = height * GROUND_Y_RATIO;
  const columnWidth = width / TERRAIN_COLUMNS;
  const terrainHeight = (columnIndex: number): number =>
    groundY -
    height *
      (TERRAIN_BASE_RATIO +
        TERRAIN_WAVE_RATIO * Math.sin(columnIndex * TERRAIN_WAVE_FREQUENCY) +
        TERRAIN_RIPPLE_RATIO *
          Math.sin(columnIndex * TERRAIN_RIPPLE_FREQUENCY + TERRAIN_RIPPLE_PHASE) +
        TERRAIN_NOISE_RATIO * pseudoRandom(columnIndex, TERRAIN_NOISE_SEED));

  ctx.strokeStyle = accent(TERRAIN_ALPHA);
  ctx.lineWidth = TERRAIN_LINE_WIDTH_PX * devicePixelRatio;
  ctx.beginPath();
  for (let columnIndex = 0; columnIndex <= TERRAIN_COLUMNS; columnIndex++) {
    const x = columnIndex * columnWidth;
    const y = terrainHeight(columnIndex);
    if (columnIndex === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = accent(HATCH_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  for (let columnIndex = 1; columnIndex < TERRAIN_COLUMNS; columnIndex += HATCH_EVERY_COLUMNS) {
    const x = columnIndex * columnWidth;
    ctx.beginPath();
    ctx.moveTo(x, terrainHeight(columnIndex));
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  const shooterX = SHOOTER_COLUMN * columnWidth;
  const shooterY = terrainHeight(SHOOTER_COLUMN);
  const targetX = TARGET_COLUMN * columnWidth;
  const targetY = terrainHeight(TARGET_COLUMN);
  const pieceLift = PIECE_LIFT_PX * devicePixelRatio;

  const shotPhase = (time / SHOT_PERIOD_SEC) % 1;
  const apexHeight = height * APEX_HEIGHT_RATIO;
  const arcAt = (progress: number): { readonly x: number; readonly y: number } => ({
    x: shooterX + (targetX - shooterX) * progress,
    y:
      shooterY +
      (targetY - shooterY) * progress -
      apexHeight * APEX_PARABOLA_SCALE * progress * (1 - progress) * APEX_HALF,
  });

  const barrelLength = width * BARREL_LENGTH_RATIO;
  ctx.strokeStyle = accent(BARREL_ALPHA);
  ctx.lineWidth = BARREL_LINE_WIDTH_PX * devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(shooterX, shooterY - pieceLift);
  ctx.lineTo(
    shooterX + Math.cos(BARREL_ANGLE) * barrelLength,
    shooterY - pieceLift + Math.sin(BARREL_ANGLE) * barrelLength
  );
  ctx.stroke();
  ctx.fillStyle = accent(1);
  ctx.beginPath();
  ctx.arc(shooterX, shooterY - pieceLift, SHOOTER_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent(TARGET_ALPHA);
  ctx.beginPath();
  ctx.arc(targetX, targetY - pieceLift, TARGET_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();

  const flightProgress = Math.min(1, shotPhase / FLIGHT_END_PHASE);
  for (let dotIndex = 0; dotIndex <= TRAIL_DOTS; dotIndex++) {
    const progress = (dotIndex / TRAIL_DOTS) * flightProgress;
    if (progress <= 0) {
      continue;
    }
    const point = arcAt(progress);
    ctx.fillStyle = accent(
      TRAIL_MIN_ALPHA +
        TRAIL_ALPHA_RANGE * (progress / Math.max(flightProgress, TRAIL_PROGRESS_EPSILON))
    );
    ctx.beginPath();
    ctx.arc(point.x, point.y, TRAIL_DOT_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }

  if (shotPhase < FLIGHT_END_PHASE) {
    const shell = arcAt(flightProgress);
    ctx.fillStyle = accent(1);
    ctx.beginPath();
    ctx.arc(shell.x, shell.y, SHELL_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const blast = 1 - (shotPhase - FLIGHT_END_PHASE) / (1 - FLIGHT_END_PHASE);
    const radius = (BLAST_MIN_RADIUS_PX + BLAST_RADIUS_RANGE_PX * (1 - blast)) * devicePixelRatio;
    const gradient = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, radius);
    gradient.addColorStop(0, accent(BLAST_CORE_ALPHA * blast));
    gradient.addColorStop(1, accent(0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(targetX, targetY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent(BLAST_RING_ALPHA * blast);
    ctx.lineWidth = BLAST_RING_LINE_WIDTH_PX * devicePixelRatio;
    ctx.beginPath();
    ctx.arc(targetX, targetY, radius * BLAST_RING_RADIUS_RATIO, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  const windDrift = (time * WIND_SPEED_PX * devicePixelRatio) % (WIND_WRAP_PX * devicePixelRatio);
  ctx.strokeStyle = accent(WIND_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  for (let dashIndex = 0; dashIndex < WIND_DASHES; dashIndex++) {
    const y = height * (WIND_TOP_RATIO + dashIndex * WIND_ROW_SPACING_RATIO);
    const x =
      (width * WIND_START_X_RATIO +
        windDrift +
        dashIndex * WIND_DASH_STAGGER_PX * devicePixelRatio) %
      (width * WIND_SPAN_X_RATIO);
    const tipX = x + WIND_DASH_LENGTH_PX * devicePixelRatio;
    const backX = x + WIND_ARROW_BACK_PX * devicePixelRatio;
    const spread = WIND_ARROW_SPREAD_PX * devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tipX, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tipX, y);
    ctx.lineTo(backX, y - spread);
    ctx.moveTo(tipX, y);
    ctx.lineTo(backX, y + spread);
    ctx.stroke();
  }

  ctx.fillStyle = accent(TAG_ALPHA);
  ctx.font = `${TAG_FONT_PX * devicePixelRatio}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText(
    'WIND →42',
    TAG_MARGIN_PX * devicePixelRatio,
    height - TAG_MARGIN_PX * devicePixelRatio
  );
}
