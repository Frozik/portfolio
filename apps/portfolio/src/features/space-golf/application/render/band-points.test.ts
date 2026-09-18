import { describe, expect, it } from 'vitest';

import { viewportOf } from '../../infrastructure/render/board-viewport';
import { VIEW_PIXELS_PER_METER } from '../camera';
import { bandToBoard, toBand } from './band-points';

const ZOOM = 0.5;
const PIXEL_RATIO = 2;
const CSS_SCREEN = { width: 390, height: 844 };
const CENTER = { x: 4, y: 10 };

function viewport() {
  return viewportOf(CENTER, VIEW_PIXELS_PER_METER * ZOOM * PIXEL_RATIO, {
    width: CSS_SCREEN.width * PIXEL_RATIO,
    height: CSS_SCREEN.height * PIXEL_RATIO,
  });
}

describe('the points of the band', () => {
  it('lie on the board right under the pointer that made them, at any zoom or pixel ratio', () => {
    const middle = toBand(CSS_SCREEN.width / 2, CSS_SCREEN.height / 2);

    expect(bandToBoard(viewport(), middle, PIXEL_RATIO)).toEqual(CENTER);
  });

  it('keep the screen distance between them: one scale of pixels, however far the view is zoomed out', () => {
    const anchor = toBand(CSS_SCREEN.width / 2, CSS_SCREEN.height / 2);
    const pull = toBand(CSS_SCREEN.width / 2 + VIEW_PIXELS_PER_METER, CSS_SCREEN.height / 2);

    // A band metre is sixty-four CSS pixels, and at half the zoom those pixels cover two metres of board.
    const drawn = bandToBoard(viewport(), pull, PIXEL_RATIO);
    expect(drawn.x - bandToBoard(viewport(), anchor, PIXEL_RATIO).x).toBeCloseTo(1 / ZOOM);
    expect(drawn.y).toBeCloseTo(CENTER.y);
  });
});
