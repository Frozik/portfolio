import type { Vector } from 'matter-js';

import { ROD_HALF_LENGTH } from '../constants';
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
} from './constants';
import { renderBobs } from './renderBobs';

export function renderPivot(context: CanvasRenderingContext2D, position: Vector) {
  renderSuspension(context, position);

  renderWheels(context, position);

  renderBobs(context, position);
}

function renderSuspension(context: CanvasRenderingContext2D, position: Vector) {
  context.save();

  context.beginPath();
  context.moveTo(position.x - ROD_HALF_LENGTH, position.y);

  context.lineTo(position.x + ROD_HALF_LENGTH, position.y);
  context.lineWidth = PIVOT_THICKNESS;
  context.lineCap = 'round';
  context.strokeStyle = 'white';
  context.stroke();

  context.restore();
}

function renderWheels(context: CanvasRenderingContext2D, position: Vector) {
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

  renderWheel(
    context,
    topLeftWheelCenterX,
    topWheelCenterY,
    ROD_TOP_WHEEL_RADIUS,
    topRotationAngle
  );
  renderWheel(
    context,
    topRightWheelCenterX,
    topWheelCenterY,
    ROD_TOP_WHEEL_RADIUS,
    topRotationAngle
  );

  renderWheel(
    context,
    bottomLeftWheelCenterX,
    bottomWheelCenterY,
    ROD_BOTTOM_WHEEL_RADIUS,
    bottomRotationAngle
  );
  renderWheel(
    context,
    bottomRightWheelCenterX,
    bottomWheelCenterY,
    ROD_BOTTOM_WHEEL_RADIUS,
    bottomRotationAngle
  );

  context.save();

  context.lineWidth = PIVOT_THICKNESS;
  context.lineCap = 'round';
  context.strokeStyle = 'white';

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

function renderWheel(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number
) {
  context.save();

  context.beginPath();
  context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  context.lineWidth = LINE_THICKNESS;
  context.strokeStyle = 'white';
  context.stroke();

  context.restore();

  for (
    let spokeIndex = 0, spokeRotation = rotation;
    spokeIndex < SPOKES_COUNT;
    spokeIndex++, spokeRotation += SPOKE_ROTATION
  ) {
    renderSpoke(context, centerX, centerY, radius - LINE_THICKNESS * 2, spokeRotation);
  }
}

function renderSpoke(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number
) {
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
  context.fillStyle = 'white';
  context.fill();

  context.restore();
}
