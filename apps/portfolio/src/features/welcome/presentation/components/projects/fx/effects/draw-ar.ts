import { MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';

const FACE_CENTER_Y_RATIO = 0.54;
const FACE_WIDTH_RATIO = 0.44;
const FACE_ASPECT = 1.3;
const FACE_OFFSET_RATIO = 0.02;
const GLOW_RADIUS_RATIO = 0.7;
const GLOW_ALPHA = 0.06;
const FACE_OUTLINE_ALPHA = 0.18;
const FACE_DASH_PX = [3, 4] as const;
const FRAME_PADDING_PX = 10;
const CORNER_LENGTH_PX = 18;
const CORNER_PULSE_BASE = 0.55;
const CORNER_PULSE_RANGE = 0.45;
const CORNER_PULSE_SPEED = 2;
const CORNER_ALPHA = 0.55;
const CORNER_LINE_WIDTH_PX = 1.5;
const EYE_Y_RATIO = 0.12;
const EYE_SPACING_RATIO = 0.2;
const LENS_WIDTH_RATIO = 0.3;
const LENS_HEIGHT_RATIO = 0.14;
const LENS_GLOW_RADIUS_RATIO = 0.9;
const LENS_GLOW_ALPHA = 0.32;
const LENS_ALPHA = 0.98;
const LENS_LINE_WIDTH_PX = 1.8;
const TEMPLE_LENGTH_RATIO = 0.18;
const TEMPLE_RISE_RATIO = 0.2;
const SCAN_SPEED_PX = 45;
const SCAN_OVERSHOOT_PX = 20;
const SCAN_PEAK_ALPHA = 0.8;
const SCAN_LINE_HEIGHT_PX = 2;
const TAG_ALPHA = 0.75;
const TAG_FONT_PX = 9;
const TAG_MARGIN_PX = 10;

/** A face outline in a scanning AR frame with the glasses overlay drawn on. */
export function drawAR({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const centerX = width / 2;
  const centerY = height * FACE_CENTER_Y_RATIO;
  const faceWidth = Math.min(width, height) * FACE_WIDTH_RATIO;
  const faceHeight = faceWidth * FACE_ASPECT;

  const glow = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    Math.max(width, height) * GLOW_RADIUS_RATIO
  );
  glow.addColorStop(0, accent(GLOW_ALPHA));
  glow.addColorStop(1, accent(0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = accent(FACE_OUTLINE_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.setLineDash(FACE_DASH_PX.map(dash => dash * devicePixelRatio));
  ctx.beginPath();
  ctx.ellipse(
    centerX,
    centerY + faceHeight * FACE_OFFSET_RATIO,
    faceWidth / 2,
    faceHeight / 2,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();

  const padding = FRAME_PADDING_PX * devicePixelRatio;
  const frameLeft = centerX - faceWidth / 2 - padding;
  const frameTop = centerY - faceHeight / 2 - padding;
  const frameWidth = faceWidth + padding * 2;
  const frameHeight = faceHeight + padding * 2;
  const cornerLength = CORNER_LENGTH_PX * devicePixelRatio;
  const cornerPulse = CORNER_PULSE_BASE + CORNER_PULSE_RANGE * Math.sin(time * CORNER_PULSE_SPEED);

  ctx.strokeStyle = accent(CORNER_ALPHA);
  ctx.lineWidth = CORNER_LINE_WIDTH_PX * devicePixelRatio;
  ctx.globalAlpha = CORNER_ALPHA + cornerPulse * CORNER_PULSE_RANGE;
  const corners: readonly (readonly [number, number, number, number])[] = [
    [frameLeft, frameTop, 1, 1],
    [frameLeft + frameWidth, frameTop, -1, 1],
    [frameLeft, frameTop + frameHeight, 1, -1],
    [frameLeft + frameWidth, frameTop + frameHeight, -1, -1],
  ];
  for (const [x, y, directionX, directionY] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + cornerLength * directionY);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cornerLength * directionX, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const eyeY = centerY - faceHeight * EYE_Y_RATIO;
  const eyeSpacing = faceWidth * EYE_SPACING_RATIO;
  const eyes = [
    { x: centerX - eyeSpacing, y: eyeY },
    { x: centerX + eyeSpacing, y: eyeY },
  ] as const;
  const [leftEye, rightEye] = eyes;
  const lensWidth = faceWidth * LENS_WIDTH_RATIO;
  const lensHeight = faceHeight * LENS_HEIGHT_RATIO;

  for (const eye of eyes) {
    const lensGlow = ctx.createRadialGradient(
      eye.x,
      eye.y,
      0,
      eye.x,
      eye.y,
      lensWidth * LENS_GLOW_RADIUS_RATIO
    );
    lensGlow.addColorStop(0, accent(LENS_GLOW_ALPHA));
    lensGlow.addColorStop(1, accent(0));
    ctx.fillStyle = lensGlow;
    ctx.fillRect(eye.x - lensWidth, eye.y - lensHeight, lensWidth * 2, lensHeight * 2);
  }

  ctx.strokeStyle = accent(LENS_ALPHA);
  ctx.lineWidth = LENS_LINE_WIDTH_PX * devicePixelRatio;
  for (const eye of eyes) {
    ctx.strokeRect(eye.x - lensWidth / 2, eye.y - lensHeight / 2, lensWidth, lensHeight);
  }

  const templeLength = faceWidth * TEMPLE_LENGTH_RATIO;
  const templeRise = lensHeight * TEMPLE_RISE_RATIO;
  ctx.beginPath();
  ctx.moveTo(leftEye.x + lensWidth / 2, eyeY);
  ctx.lineTo(rightEye.x - lensWidth / 2, eyeY);
  ctx.moveTo(leftEye.x - lensWidth / 2, eyeY);
  ctx.lineTo(leftEye.x - lensWidth / 2 - templeLength, eyeY - templeRise);
  ctx.moveTo(rightEye.x + lensWidth / 2, eyeY);
  ctx.lineTo(rightEye.x + lensWidth / 2 + templeLength, eyeY - templeRise);
  ctx.stroke();

  const scanLineY = frameTop + ((time * SCAN_SPEED_PX) % (frameHeight + SCAN_OVERSHOOT_PX));
  if (scanLineY < frameTop + frameHeight) {
    const scan = ctx.createLinearGradient(frameLeft, scanLineY, frameLeft + frameWidth, scanLineY);
    scan.addColorStop(0, accent(0));
    scan.addColorStop(0.5, accent(SCAN_PEAK_ALPHA));
    scan.addColorStop(1, accent(0));
    ctx.fillStyle = scan;
    ctx.fillRect(
      frameLeft,
      scanLineY - devicePixelRatio,
      frameWidth,
      SCAN_LINE_HEIGHT_PX * devicePixelRatio
    );
  }

  ctx.fillStyle = accent(TAG_ALPHA);
  ctx.font = `${TAG_FONT_PX * devicePixelRatio}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText(
    'AR · LIVE',
    TAG_MARGIN_PX * devicePixelRatio,
    height - TAG_MARGIN_PX * devicePixelRatio
  );
}
