import { MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';

const GRID_CELL_PX = 16;
const GRID_ALPHA = 0.05;
const WALL_X_RATIO = 0.78;
const BRICK_WIDTH_RATIO = 0.055;
const BRICK_HEIGHT_RATIO = 0.11;
const BRICK_ROWS = 5;
const BRICK_COLUMNS = 2;
const BRICK_GAP_PX = 2;
const BRICK_FILL_ALPHA = 0.07;
const BRICK_STROKE_ALPHA = 0.35;
const VOLLEY_PERIOD_SEC = 1.6;
const VOLLEYS_BEFORE_REBUILD = 4;
const TANK_SWAY_SPEED = 0.9;
const TANK_SWAY_RATIO = 0.22;
const TANK_X_RATIO = 0.16;
const BODY_WIDTH_RATIO = 0.09;
const BODY_ASPECT = 0.78;
const BODY_ALPHA = 0.9;
const BODY_LINE_WIDTH_PX = 1.4;
const TREAD_SPEED_PX = 26;
const TREAD_DASH_PX = 3;
const TREAD_WRAP_PX = 6;
const TREAD_ALPHA = 0.5;
const TREAD_OFFSET_PX = 2.5;
const TURRET_RADIUS_RATIO = 0.26;
const BARREL_LENGTH_RATIO = 0.75;
const FLIGHT_END_PHASE = 0.55;
const FLASH_DURATION_PHASE = 0.18;
const BULLET_ALPHA = 0.95;
const BULLET_HALF_WIDTH_PX = 2;
const BULLET_HALF_HEIGHT_PX = 1.5;
const BULLET_WIDTH_PX = 4;
const BULLET_HEIGHT_PX = 3;
const TRACER_ALPHA = 0.25;
const FLASH_MIN_RADIUS_PX = 6;
const FLASH_RADIUS_RANGE_PX = 10;
const FLASH_ALPHA = 0.85;
const TAG_ALPHA = 0.75;
const TAG_FONT_PX = 9;
const TAG_MARGIN_PX = 10;

/** A tank on a grid firing volleys at a brick wall that crumbles and rebuilds. */
export function drawTanks({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const cell = GRID_CELL_PX * devicePixelRatio;
  ctx.strokeStyle = accent(GRID_ALPHA);
  ctx.lineWidth = devicePixelRatio;
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

  const wallX = width * WALL_X_RATIO;
  const brickWidth = width * BRICK_WIDTH_RATIO;
  const brickHeight = height * BRICK_HEIGHT_RATIO;
  const brickGap = BRICK_GAP_PX * devicePixelRatio;
  const wallTop = height / 2 - (BRICK_ROWS * brickHeight) / 2;
  const volleyTime = time / VOLLEY_PERIOD_SEC;
  const volley = Math.floor(volleyTime);
  const volleyPhase = volleyTime % 1;
  const destroyedCount = volley % (BRICK_ROWS * BRICK_COLUMNS + VOLLEYS_BEFORE_REBUILD);

  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let column = 0; column < BRICK_COLUMNS; column++) {
      if (row * BRICK_COLUMNS + column < destroyedCount) {
        continue;
      }
      const x = wallX + column * brickWidth;
      const y = wallTop + row * brickHeight;
      ctx.fillStyle = accent(BRICK_FILL_ALPHA);
      ctx.fillRect(x, y, brickWidth - brickGap, brickHeight - brickGap);
      ctx.strokeStyle = accent(BRICK_STROKE_ALPHA);
      ctx.lineWidth = devicePixelRatio;
      ctx.strokeRect(x, y, brickWidth - brickGap, brickHeight - brickGap);
      ctx.beginPath();
      ctx.moveTo(x, y + brickHeight / 2);
      ctx.lineTo(x + brickWidth - brickGap, y + brickHeight / 2);
      ctx.stroke();
    }
  }

  const swayAt = (seconds: number): number =>
    height / 2 + Math.sin(seconds * TANK_SWAY_SPEED) * height * TANK_SWAY_RATIO;
  const shotY = swayAt(volley * VOLLEY_PERIOD_SEC);
  const tankY = swayAt(time);
  const tankX = width * TANK_X_RATIO;
  const bodyWidth = width * BODY_WIDTH_RATIO;
  const bodyHeight = bodyWidth * BODY_ASPECT;

  ctx.strokeStyle = accent(BODY_ALPHA);
  ctx.lineWidth = BODY_LINE_WIDTH_PX * devicePixelRatio;
  ctx.strokeRect(tankX - bodyWidth / 2, tankY - bodyHeight / 2, bodyWidth, bodyHeight);
  const treadOffset =
    (time * TREAD_SPEED_PX * devicePixelRatio) % (TREAD_WRAP_PX * devicePixelRatio);
  ctx.strokeStyle = accent(TREAD_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  for (const side of [-1, 1]) {
    const treadX = tankX + side * (bodyWidth / 2 + TREAD_OFFSET_PX * devicePixelRatio);
    ctx.setLineDash([TREAD_DASH_PX * devicePixelRatio, TREAD_DASH_PX * devicePixelRatio]);
    ctx.lineDashOffset = -treadOffset;
    ctx.beginPath();
    ctx.moveTo(treadX, tankY - bodyHeight / 2);
    ctx.lineTo(treadX, tankY + bodyHeight / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const turretRadius = bodyWidth * TURRET_RADIUS_RATIO;
  ctx.strokeStyle = accent(BODY_ALPHA);
  ctx.lineWidth = BODY_LINE_WIDTH_PX * devicePixelRatio;
  ctx.beginPath();
  ctx.arc(tankX, tankY, turretRadius, 0, Math.PI * 2);
  ctx.stroke();
  const barrelTip = tankX + turretRadius + bodyWidth * BARREL_LENGTH_RATIO;
  ctx.beginPath();
  ctx.moveTo(tankX + turretRadius, tankY);
  ctx.lineTo(barrelTip, tankY);
  ctx.stroke();

  if (volleyPhase < FLIGHT_END_PHASE) {
    const bulletX = barrelTip + (wallX - barrelTip) * (volleyPhase / FLIGHT_END_PHASE);
    ctx.fillStyle = accent(BULLET_ALPHA);
    ctx.fillRect(
      bulletX - BULLET_HALF_WIDTH_PX * devicePixelRatio,
      shotY - BULLET_HALF_HEIGHT_PX * devicePixelRatio,
      BULLET_WIDTH_PX * devicePixelRatio,
      BULLET_HEIGHT_PX * devicePixelRatio
    );
    ctx.strokeStyle = accent(TRACER_ALPHA);
    ctx.lineWidth = devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(barrelTip, shotY);
    ctx.lineTo(bulletX, shotY);
    ctx.stroke();
  } else if (volleyPhase < FLIGHT_END_PHASE + FLASH_DURATION_PHASE) {
    const flash = 1 - (volleyPhase - FLIGHT_END_PHASE) / FLASH_DURATION_PHASE;
    const radius = (FLASH_MIN_RADIUS_PX + FLASH_RADIUS_RANGE_PX * (1 - flash)) * devicePixelRatio;
    const gradient = ctx.createRadialGradient(wallX, shotY, 0, wallX, shotY, radius);
    gradient.addColorStop(0, accent(FLASH_ALPHA * flash));
    gradient.addColorStop(1, accent(0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(wallX, shotY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = accent(TAG_ALPHA);
  ctx.font = `${TAG_FONT_PX * devicePixelRatio}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText(
    'STAGE 01',
    TAG_MARGIN_PX * devicePixelRatio,
    height - TAG_MARGIN_PX * devicePixelRatio
  );
}
