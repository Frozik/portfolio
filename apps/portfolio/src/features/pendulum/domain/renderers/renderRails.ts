import { RAILS_HALF_LENGTH, RAILS_LENGTH } from '../constants';
import { LINE_THICKNESS, RAILS_CAPS_WIDTH, RAILS_THICKNESS } from './constants';

export function renderRails(context: CanvasRenderingContext2D) {
  context.save();

  context.strokeStyle = '#999999';
  context.lineWidth = LINE_THICKNESS;
  context.roundRect(
    -RAILS_HALF_LENGTH - RAILS_CAPS_WIDTH,
    -RAILS_THICKNESS / 2,
    RAILS_LENGTH + 2 * RAILS_CAPS_WIDTH,
    RAILS_THICKNESS,
    RAILS_THICKNESS
  );
  context.stroke();

  const strokesCount = Math.trunc(RAILS_HALF_LENGTH / 10);
  for (let i = -strokesCount; i <= strokesCount; i++) {
    const strokeHeight = i % 10 === 0 ? 3 : i % 5 === 0 ? 2 : 1;

    context.beginPath();
    context.moveTo(10 * i, RAILS_THICKNESS);
    context.lineTo(10 * i, (strokeHeight + 1) * RAILS_THICKNESS);
    context.stroke();

    if (strokeHeight === 3) {
      const text = Math.abs(i * 10).toFixed(0);

      context.fillStyle = 'white';
      context.font = '14px serif';
      const { width: textWidth } = context.measureText(text);
      context.fillText(
        text,
        10 * i - textWidth / 2,
        (strokeHeight + 2) * RAILS_THICKNESS + LINE_THICKNESS
      );
    }
  }

  context.restore();
}
