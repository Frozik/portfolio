import type { Vector } from 'matter-js';

import { ROD_HALF_LENGTH } from '../../domain/constants';
import {
  LINE_THICKNESS,
  PIVOT_THICKNESS,
  RAILS_HALF_THICKNESS,
  ROD_BOTTOM_WHEEL_OFFSET,
  ROD_BOTTOM_WHEEL_RADIUS,
  ROD_TOP_WHEEL_OFFSET,
  ROD_TOP_WHEEL_RADIUS,
  SPOKE_HALF_ANGLE,
  SPOKE_ROTATION,
  SPOKES_COUNT,
  STROKE_COLOR,
} from './constants';
import { drawBobs } from './draw-bobs';

export function drawPivot(context: CanvasRenderingContext2D, position: Vector): void {
  drawSuspension(context, position);
  drawWheels(context, position);
  drawBobs(context, [position]);
}

function drawSuspension(context: CanvasRenderingContext2D, position: Vector): void {
  context.save();

  context.beginPath();
  context.moveTo(position.x - ROD_HALF_LENGTH, position.y);

  context.lineTo(position.x + ROD_HALF_LENGTH, position.y);
  context.lineWidth = PIVOT_THICKNESS;
  context.lineCap = 'round';
  context.strokeStyle = STROKE_COLOR;
  context.stroke();

  context.restore();
}

function drawWheels(context: CanvasRenderingContext2D, position: Vector): void {
  const leftEdge = position.x - ROD_HALF_LENGTH;
  const rightEdge = position.x + ROD_HALF_LENGTH;

  const topLeftWheelCenterX = leftEdge - ROD_TOP_WHEEL_OFFSET;
  const topRightWheelCenterX = rightEdge + ROD_TOP_WHEEL_OFFSET;
  const topWheelCenterY = position.y - RAILS_HALF_THICKNESS - ROD_TOP_WHEEL_RADIUS - LINE_THICKNESS;

  const bottomLeftWheelCenterX = leftEdge - ROD_BOTTOM_WHEEL_OFFSET;
  const bottomRightWheelCenterX = rightEdge + ROD_BOTTOM_WHEEL_OFFSET;
  const bottomWheelCenterY =
    position.y + RAILS_HALF_THICKNESS + ROD_BOTTOM_WHEEL_RADIUS + LINE_THICKNESS;

  const topRotationAngle = position.x / (ROD_TOP_WHEEL_RADIUS + LINE_THICKNESS);
  const bottomRotationAngle = -position.x / (ROD_BOTTOM_WHEEL_RADIUS + LINE_THICKNESS);

  drawWheel(context, topLeftWheelCenterX, topWheelCenterY, ROD_TOP_WHEEL_RADIUS, topRotationAngle);
  drawWheel(context, topRightWheelCenterX, topWheelCenterY, ROD_TOP_WHEEL_RADIUS, topRotationAngle);

  drawWheel(
    context,
    bottomLeftWheelCenterX,
    bottomWheelCenterY,
    ROD_BOTTOM_WHEEL_RADIUS,
    bottomRotationAngle
  );
  drawWheel(
    context,
    bottomRightWheelCenterX,
    bottomWheelCenterY,
    ROD_BOTTOM_WHEEL_RADIUS,
    bottomRotationAngle
  );

  context.save();

  context.lineWidth = PIVOT_THICKNESS;
  context.lineCap = 'round';
  context.strokeStyle = STROKE_COLOR;

  context.beginPath();
  context.moveTo(topLeftWheelCenterX, topWheelCenterY);
  context.lineTo(leftEdge, position.y);
  context.lineTo(bottomLeftWheelCenterX, bottomWheelCenterY);
  context.stroke();

  context.beginPath();
  context.moveTo(topRightWheelCenterX, topWheelCenterY);
  context.lineTo(rightEdge, position.y);
  context.lineTo(bottomRightWheelCenterX, bottomWheelCenterY);
  context.stroke();

  context.restore();
}

function drawWheel(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number
): void {
  context.save();

  context.beginPath();
  context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  context.lineWidth = LINE_THICKNESS;
  context.strokeStyle = STROKE_COLOR;
  context.stroke();

  context.restore();

  for (
    let spokeIndex = 0, spokeRotation = rotation;
    spokeIndex < SPOKES_COUNT;
    spokeIndex++, spokeRotation += SPOKE_ROTATION
  ) {
    drawSpoke(context, centerX, centerY, radius - LINE_THICKNESS * 2, spokeRotation);
  }
}

function drawSpoke(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number
): void {
  context.save();

  context.beginPath();
  context.moveTo(centerX, centerY);
  context.arc(
    centerX,
    centerY,
    radius + LINE_THICKNESS,
    rotation - SPOKE_HALF_ANGLE,
    rotation + SPOKE_HALF_ANGLE
  );
  context.fillStyle = STROKE_COLOR;
  context.fill();

  context.restore();
}
