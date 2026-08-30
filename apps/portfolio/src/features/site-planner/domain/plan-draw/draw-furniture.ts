import { isNil } from 'lodash-es';

import { rotatedBoxRing } from '../geometry/hit-test-shape';
import type { FurnitureId, FurnitureInstance } from '../model/furniture';
import { findFurnitureEntry, furnitureBox } from '../model/furniture';
import type { PlanViewport } from '../view/plan-viewport';
import { planToScreen } from '../view/plan-viewport';
import type { ShapeHandle } from './draw-selection';
import { ROTATION_HANDLE_GAP_PX } from './draw-selection';
import { PLAN_COLORS } from './shared';

const BODY_LINE_WIDTH_PX = 1.2;
const SELECTED_LINE_WIDTH_PX = 2.2;
const RADIANS_PER_DEGREE = Math.PI / 180;
const HALF = 0.5;

/** Household pieces read warm wood; plumbing reads cool porcelain. */
const FURNITURE_FILL = 'rgba(196, 154, 108, 0.28)';
const FURNITURE_STROKE = '#c49a6c';
const PLUMBING_FILL = 'rgba(186, 210, 235, 0.28)';
const PLUMBING_STROKE = '#bad2eb';

/**
 * The furniture of the displayed storey, each piece a turned box with a front
 * tick — the short line marking which way it faces, so a bed and a wardrobe
 * read differently from a plain rectangle.
 */
export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  furniture: readonly FurnitureInstance[],
  selectedFurnitureId?: FurnitureId
): void {
  if (furniture.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';

  for (const item of furniture) {
    const entry = findFurnitureEntry(item.catalogId);
    const box = furnitureBox(item);

    if (isNil(entry) || isNil(box)) {
      continue;
    }

    const corners = rotatedBoxRing(box).map(corner => planToScreen(viewport, corner));
    const isSelected = item.id === selectedFurnitureId;
    const isPlumbing = entry.category === 'plumbing';

    ctx.beginPath();

    corners.forEach((corner, index) => {
      if (index === 0) {
        ctx.moveTo(corner.x, corner.y);
      } else {
        ctx.lineTo(corner.x, corner.y);
      }
    });

    ctx.closePath();
    ctx.fillStyle = isPlumbing ? PLUMBING_FILL : FURNITURE_FILL;
    ctx.fill();
    ctx.strokeStyle = isSelected
      ? PLAN_COLORS.selectionStroke
      : isPlumbing
        ? PLUMBING_STROKE
        : FURNITURE_STROKE;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : BODY_LINE_WIDTH_PX;
    ctx.stroke();

    drawFrontTick(ctx, viewport, item, entry.depthMeters);
  }

  ctx.restore();
}

/** A short line at the middle of the front edge — which way the piece faces. */
function drawFrontTick(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  item: FurnitureInstance,
  depthMeters: number
): void {
  const radians = item.rotationDegrees * RADIANS_PER_DEGREE;
  const front = {
    x: item.position.x - Math.sin(radians) * depthMeters * HALF,
    y: item.position.y + Math.cos(radians) * depthMeters * HALF,
  };
  const start = planToScreen(viewport, item.position);
  const end = planToScreen(viewport, front);

  ctx.beginPath();
  ctx.moveTo(start.x + (end.x - start.x) * HALF, start.y + (end.y - start.y) * HALF);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

/**
 * The grip that turns the selected piece: ahead of its front, off the body —
 * the car's rotation grip, reused for what stands indoors.
 */
export function computeFurnitureHandles(
  item: FurnitureInstance,
  viewport: PlanViewport
): readonly ShapeHandle[] {
  const entry = findFurnitureEntry(item.catalogId);

  if (isNil(entry)) {
    return [];
  }

  const radians = item.rotationDegrees * RADIANS_PER_DEGREE;
  const frontDirection = { x: -Math.sin(radians), y: Math.cos(radians) };
  const front = planToScreen(viewport, {
    x: item.position.x + frontDirection.x * entry.depthMeters * HALF,
    y: item.position.y + frontDirection.y * entry.depthMeters * HALF,
  });

  // Screen y runs down while plan y runs up, so the heading flips its y.
  return [
    {
      kind: 'rotate',
      screenPoint: {
        x: front.x + frontDirection.x * ROTATION_HANDLE_GAP_PX,
        y: front.y - frontDirection.y * ROTATION_HANDLE_GAP_PX,
      },
    },
  ];
}
