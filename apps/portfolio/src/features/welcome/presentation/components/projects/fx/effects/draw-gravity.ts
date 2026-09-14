import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

const CYCLE_SEC = 3.6;
/** The stroke: the ball flies from the floor to the wall on the left. */
const FLIGHT_END_PHASE = 0.5;
/** How long the dust takes to turn to the new gravity after the hit. */
const TURN_PHASE = 0.18;
/** The next stroke being aimed: five dots run from the ball. */
const AIM_START_PHASE = 0.72;
const AIM_END_PHASE = 0.96;

const FLOOR_LEFT_RATIO = 0.32;
const FLOOR_RIGHT_RATIO = 0.92;
const FLOOR_TOP_RATIO = 0.78;
const FLOOR_BOTTOM_RATIO = 0.94;
const WALL_LEFT_RATIO = 0.06;
const WALL_RIGHT_RATIO = 0.19;
const WALL_TOP_RATIO = 0.12;
const WALL_BOTTOM_RATIO = 0.94;
const CHAMFER_RATIO = 0.035;
const BLOCK_FILL_ALPHA = 0.08;
const BLOCK_STROKE_ALPHA = 0.7;
const BLOCK_LINE_WIDTH_PX = 1.4;

const BALL_RADIUS_PX = 3.2;
const BALL_START_X_RATIO = 0.7;
const BALL_LAND_Y_RATIO = 0.42;
const APEX_HEIGHT_RATIO = 0.5;
const APEX_PARABOLA_SCALE = 4;
const TRAIL_DOTS = 18;
const TRAIL_MIN_ALPHA = 0.12;
const TRAIL_ALPHA_RANGE = 0.45;
const TRAIL_DOT_RADIUS_PX = 1.3;

const AIM_DOTS = 5;
const AIM_SPACING_PX = 9;
const AIM_DOT_RADIUS_PX = 1.5;
const AIM_ALPHA = 0.8;
const AIM_DIRECTION_X = 0.55;
const AIM_DIRECTION_Y = 0.35;
const AIM_RING_RADIUS_PX = 22;
const AIM_RING_ALPHA = 0.25;

const DUST_COUNT = 34;
const DUST_SPEED_PX = 14;
const DUST_ALPHA = 0.3;
const DUST_RADIUS_PX = 1;
const DUST_SEED_X = 11;
const DUST_SEED_Y = 23;

const CUP_X_RATIO = 0.8;
const CUP_RADIUS_PX = 4;
const FLAG_HEIGHT_PX = 14;
const FLAG_WIDTH_PX = 7;
const FLAG_ALPHA = 0.9;

interface Point {
  readonly x: number;
  readonly y: number;
}

function chamferedBlock(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  right: number,
  bottom: number,
  chamfer: number
): void {
  ctx.beginPath();
  ctx.moveTo(left + chamfer, top);
  ctx.lineTo(right - chamfer, top);
  ctx.lineTo(right, top + chamfer);
  ctx.lineTo(right, bottom - chamfer);
  ctx.lineTo(right - chamfer, bottom);
  ctx.lineTo(left + chamfer, bottom);
  ctx.lineTo(left, bottom - chamfer);
  ctx.lineTo(left, top + chamfer);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A gravity-golf stroke: the ball flies to a wall, the wall becomes the floor, the dust turns to follow. */
export function drawGravity({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const phase = (time / CYCLE_SEC) % 1;
  const chamfer = width * CHAMFER_RATIO;
  const radius = BALL_RADIUS_PX * devicePixelRatio;

  ctx.fillStyle = accent(BLOCK_FILL_ALPHA);
  ctx.strokeStyle = accent(BLOCK_STROKE_ALPHA);
  ctx.lineWidth = BLOCK_LINE_WIDTH_PX * devicePixelRatio;
  chamferedBlock(
    ctx,
    width * FLOOR_LEFT_RATIO,
    height * FLOOR_TOP_RATIO,
    width * FLOOR_RIGHT_RATIO,
    height * FLOOR_BOTTOM_RATIO,
    chamfer
  );
  chamferedBlock(
    ctx,
    width * WALL_LEFT_RATIO,
    height * WALL_TOP_RATIO,
    width * WALL_RIGHT_RATIO,
    height * WALL_BOTTOM_RATIO,
    chamfer
  );

  const cupX = width * CUP_X_RATIO;
  const floorTop = height * FLOOR_TOP_RATIO;
  const cupRadius = CUP_RADIUS_PX * devicePixelRatio;
  ctx.fillStyle = accent(BLOCK_STROKE_ALPHA);
  ctx.beginPath();
  ctx.arc(cupX, floorTop, cupRadius, 0, Math.PI);
  ctx.fill();
  const flagHeight = FLAG_HEIGHT_PX * devicePixelRatio;
  ctx.strokeStyle = accent(FLAG_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.beginPath();
  ctx.moveTo(cupX, floorTop + cupRadius);
  ctx.lineTo(cupX, floorTop - flagHeight);
  ctx.stroke();
  ctx.fillStyle = accent(FLAG_ALPHA);
  ctx.beginPath();
  ctx.moveTo(cupX, floorTop - flagHeight);
  ctx.lineTo(cupX + FLAG_WIDTH_PX * devicePixelRatio, floorTop - flagHeight * 0.75);
  ctx.lineTo(cupX, floorTop - flagHeight * 0.5);
  ctx.closePath();
  ctx.fill();

  const start: Point = { x: width * BALL_START_X_RATIO, y: floorTop - radius };
  const landing: Point = { x: width * WALL_RIGHT_RATIO + radius, y: height * BALL_LAND_Y_RATIO };
  const arcAt = (progress: number): Point => ({
    x: start.x + (landing.x - start.x) * progress,
    y:
      start.y +
      (landing.y - start.y) * progress -
      height * APEX_HEIGHT_RATIO * APEX_PARABOLA_SCALE * progress * (1 - progress) * 0.5,
  });
  const flightProgress = Math.min(1, phase / FLIGHT_END_PHASE);
  const ball = arcAt(flightProgress);

  // Gravity: down during the flight, left once the wall has been touched; the dust eases round.
  const turn = Math.min(1, Math.max(0, (phase - FLIGHT_END_PHASE) / TURN_PHASE));
  const eased = turn * turn * (3 - 2 * turn);
  const drift: Point = { x: -eased, y: 1 - eased };
  const dustTravel = time * DUST_SPEED_PX * devicePixelRatio;
  ctx.fillStyle = accent(DUST_ALPHA);
  for (let index = 0; index < DUST_COUNT; index++) {
    const baseX = pseudoRandom(index, DUST_SEED_X) * width;
    const baseY = pseudoRandom(index, DUST_SEED_Y) * height;
    const x = (((baseX + dustTravel * drift.x) % width) + width) % width;
    const y = (((baseY + dustTravel * drift.y) % height) + height) % height;
    ctx.beginPath();
    ctx.arc(x, y, DUST_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let dotIndex = 1; dotIndex <= TRAIL_DOTS; dotIndex++) {
    const progress = (dotIndex / TRAIL_DOTS) * flightProgress;
    const point = arcAt(progress);
    ctx.fillStyle = accent(TRAIL_MIN_ALPHA + TRAIL_ALPHA_RANGE * (progress / flightProgress));
    ctx.beginPath();
    ctx.arc(point.x, point.y, TRAIL_DOT_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }

  if (phase >= AIM_START_PHASE && phase < AIM_END_PHASE) {
    const pull = (phase - AIM_START_PHASE) / (AIM_END_PHASE - AIM_START_PHASE);
    ctx.strokeStyle = accent(AIM_RING_ALPHA);
    ctx.lineWidth = devicePixelRatio;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, AIM_RING_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = accent(AIM_ALPHA);
    for (let dotIndex = 1; dotIndex <= AIM_DOTS; dotIndex++) {
      const distance = dotIndex * AIM_SPACING_PX * devicePixelRatio * pull;
      ctx.beginPath();
      ctx.arc(
        ball.x + AIM_DIRECTION_X * distance,
        ball.y - AIM_DIRECTION_Y * distance,
        AIM_DOT_RADIUS_PX * devicePixelRatio,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  ctx.fillStyle = accent(1);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
  ctx.fill();
}
