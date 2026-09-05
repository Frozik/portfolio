import { RAILS_HALF_LENGTH, RAILS_LENGTH } from '../../domain/constants';
import {
  LINE_THICKNESS,
  RAILS_CAPS_WIDTH,
  RAILS_COLOR,
  RAILS_THICKNESS,
  STROKE_COLOR,
} from './constants';

const SCALE_STEP = 10;
const MINOR_MARKS_PER_MEDIUM = 5;
const MINOR_MARKS_PER_MAJOR = 10;
const MINOR_MARK_HEIGHT = 1;
const MEDIUM_MARK_HEIGHT = 2;
const MAJOR_MARK_HEIGHT = 3;
const SCALE_LABEL_FONT = '14px serif';

function markHeight(markIndex: number): number {
  if (markIndex % MINOR_MARKS_PER_MAJOR === 0) {
    return MAJOR_MARK_HEIGHT;
  }
  return markIndex % MINOR_MARKS_PER_MEDIUM === 0 ? MEDIUM_MARK_HEIGHT : MINOR_MARK_HEIGHT;
}

export function drawRails(context: CanvasRenderingContext2D): void {
  context.save();

  context.strokeStyle = RAILS_COLOR;
  context.lineWidth = LINE_THICKNESS;
  context.roundRect(
    -RAILS_HALF_LENGTH - RAILS_CAPS_WIDTH,
    -RAILS_THICKNESS / 2,
    RAILS_LENGTH + 2 * RAILS_CAPS_WIDTH,
    RAILS_THICKNESS,
    RAILS_THICKNESS
  );
  context.stroke();

  const marksCount = Math.trunc(RAILS_HALF_LENGTH / SCALE_STEP);
  for (let markIndex = -marksCount; markIndex <= marksCount; markIndex++) {
    const height = markHeight(markIndex);
    const x = SCALE_STEP * markIndex;

    context.beginPath();
    context.moveTo(x, RAILS_THICKNESS);
    context.lineTo(x, (height + 1) * RAILS_THICKNESS);
    context.stroke();

    if (height === MAJOR_MARK_HEIGHT) {
      const text = Math.abs(x).toFixed(0);

      context.fillStyle = STROKE_COLOR;
      context.font = SCALE_LABEL_FONT;
      const { width: textWidth } = context.measureText(text);
      context.fillText(text, x - textWidth / 2, (height + 2) * RAILS_THICKNESS + LINE_THICKNESS);
    }
  }

  context.restore();
}
