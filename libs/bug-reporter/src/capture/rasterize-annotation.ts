import { isNil } from 'lodash-es';

import type { IAnnotation, IStroke, TShape } from '../core/annotation';
import { arrowHead, toBox } from '../core/annotation';
import { CaptureError } from '../core/ports';
import { canvasToPng } from './canvas-png';

/** The head grows with the shaft, so a thick arrow still reads as an arrow. */
const ARROW_HEAD_PER_WIDTH = 4.5;
const REDACT_FILL = '#111111';

/** Flattens the screenshot and its marks into one PNG — redactions become opaque pixels, not a removable layer. */
export async function rasterizeAnnotation(image: Blob, annotation: IAnnotation): Promise<Blob> {
  if (annotation.shapes.length === 0) {
    return image;
  }
  const bitmap = await createImageBitmap(image);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (isNil(context)) {
      throw new CaptureError('failed');
    }
    context.drawImage(bitmap, 0, 0);
    for (const shape of annotation.shapes) {
      drawShape(context, shape);
    }
    return await canvasToPng(canvas);
  } finally {
    bitmap.close();
  }
}

export function drawShape(context: CanvasRenderingContext2D, shape: TShape): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  switch (shape.kind) {
    case 'rectangle': {
      const box = toBox(shape.from, shape.to);
      applyStroke(context, shape.stroke);
      context.strokeRect(box.x, box.y, box.width, box.height);
      return;
    }
    case 'arrow': {
      const [left, right] = arrowHead(
        shape.from,
        shape.to,
        shape.stroke.width * ARROW_HEAD_PER_WIDTH
      );
      applyStroke(context, shape.stroke);
      context.beginPath();
      context.moveTo(shape.from.x, shape.from.y);
      context.lineTo(shape.to.x, shape.to.y);
      context.moveTo(left.x, left.y);
      context.lineTo(shape.to.x, shape.to.y);
      context.lineTo(right.x, right.y);
      context.stroke();
      return;
    }
    case 'pen': {
      const [first, ...rest] = shape.points;
      if (first === undefined) {
        return;
      }
      applyStroke(context, shape.stroke);
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (const point of rest) {
        context.lineTo(point.x, point.y);
      }
      context.stroke();
      return;
    }
    case 'redact': {
      const box = toBox(shape.from, shape.to);
      context.fillStyle = REDACT_FILL;
      context.fillRect(box.x, box.y, box.width, box.height);
      return;
    }
    default:
      shape satisfies never;
  }
}

function applyStroke(context: CanvasRenderingContext2D, stroke: IStroke): void {
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;
}
