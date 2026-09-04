import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import { MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';

const SUDOKU_BOARD = [
  '53..7....',
  '6..195...',
  '.98....6.',
  '8...6...3',
  '4..8.3..1',
  '7...2...6',
  '.6....28.',
  '...419..5',
  '....8..79',
] as const;
const EMPTY_CELL = '.';
const GUESS_DIGITS = '123456789';
const BOARD_SIZE = 9;
const BOX_SIZE = 3;
const CURSOR_STEP_SPEED = 0.6;
const LINE_HIGHLIGHT_ALPHA = 0.05;
const BOX_HIGHLIGHT_ALPHA = 0.07;
const MATCH_HIGHLIGHT_ALPHA = 0.14;
const CURSOR_HIGHLIGHT_ALPHA = 0.28;
const THIN_LINE_ALPHA = 0.15;
const THICK_LINE_ALPHA = 0.5;
const THICK_LINE_WIDTH_PX = 1.5;
const DIGIT_FONT_RATIO = 0.58;
const DIGIT_ALPHA = 0.55;
const BLINK_HZ = 3;
const CURSOR_BORDER_WIDTH_PX = 2;

interface ICellPosition {
  readonly row: number;
  readonly column: number;
}

function findEmptyCells(): readonly ICellPosition[] {
  return SUDOKU_BOARD.flatMap((line, row) =>
    Array.from(line).flatMap((character, column) =>
      character === EMPTY_CELL ? [{ row, column }] : []
    )
  );
}

const EMPTY_CELLS = findEmptyCells();

/** A sudoku board with a cursor hopping between empty cells and highlighting the guessed digit. */
export function drawCursor({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const cellWidth = width / BOARD_SIZE;
  const cellHeight = height / BOARD_SIZE;
  const emptyIndex = Math.floor(time * CURSOR_STEP_SPEED) % EMPTY_CELLS.length;
  const cursor = EMPTY_CELLS[emptyIndex];
  assert(!isNil(cursor), 'the board has empty cells');
  const boxRow = Math.floor(cursor.row / BOX_SIZE) * BOX_SIZE;
  const boxColumn = Math.floor(cursor.column / BOX_SIZE) * BOX_SIZE;
  const guess = GUESS_DIGITS[emptyIndex % GUESS_DIGITS.length];

  ctx.fillStyle = accent(LINE_HIGHLIGHT_ALPHA);
  ctx.fillRect(0, cursor.row * cellHeight, width, cellHeight);
  ctx.fillRect(cursor.column * cellWidth, 0, cellWidth, height);
  ctx.fillStyle = accent(BOX_HIGHLIGHT_ALPHA);
  ctx.fillRect(
    boxColumn * cellWidth,
    boxRow * cellHeight,
    cellWidth * BOX_SIZE,
    cellHeight * BOX_SIZE
  );

  ctx.fillStyle = accent(MATCH_HIGHLIGHT_ALPHA);
  SUDOKU_BOARD.forEach((line, row) => {
    Array.from(line).forEach((character, column) => {
      if (character === guess) {
        ctx.fillRect(column * cellWidth, row * cellHeight, cellWidth, cellHeight);
      }
    });
  });

  ctx.fillStyle = accent(CURSOR_HIGHLIGHT_ALPHA);
  ctx.fillRect(cursor.column * cellWidth, cursor.row * cellHeight, cellWidth, cellHeight);

  ctx.strokeStyle = accent(THIN_LINE_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.beginPath();
  for (let lineIndex = 1; lineIndex < BOARD_SIZE; lineIndex++) {
    if (lineIndex % BOX_SIZE === 0) {
      continue;
    }
    ctx.moveTo(lineIndex * cellWidth, 0);
    ctx.lineTo(lineIndex * cellWidth, height);
    ctx.moveTo(0, lineIndex * cellHeight);
    ctx.lineTo(width, lineIndex * cellHeight);
  }
  ctx.stroke();

  ctx.strokeStyle = accent(THICK_LINE_ALPHA);
  ctx.lineWidth = THICK_LINE_WIDTH_PX * devicePixelRatio;
  ctx.beginPath();
  for (let lineIndex = 0; lineIndex <= BOARD_SIZE; lineIndex += BOX_SIZE) {
    ctx.moveTo(lineIndex * cellWidth, 0);
    ctx.lineTo(lineIndex * cellWidth, height);
    ctx.moveTo(0, lineIndex * cellHeight);
    ctx.lineTo(width, lineIndex * cellHeight);
  }
  ctx.stroke();

  ctx.font = `${Math.min(cellWidth, cellHeight) * DIGIT_FONT_RATIO}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textAt = (row: number, column: number, text: string): void => {
    ctx.fillText(
      text,
      column * cellWidth + cellWidth / 2,
      row * cellHeight + cellHeight / 2 + devicePixelRatio
    );
  };
  SUDOKU_BOARD.forEach((line, row) => {
    Array.from(line).forEach((character, column) => {
      if (character !== EMPTY_CELL) {
        ctx.fillStyle = character === guess ? accent(1) : accent(DIGIT_ALPHA);
        textAt(row, column, character);
      }
    });
  });

  if (Math.floor(time * BLINK_HZ) % 2 === 0) {
    ctx.fillStyle = accent(1);
    textAt(cursor.row, cursor.column, guess);
  }

  const borderWidth = CURSOR_BORDER_WIDTH_PX * devicePixelRatio;
  ctx.strokeStyle = accent(1);
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(
    cursor.column * cellWidth + devicePixelRatio,
    cursor.row * cellHeight + devicePixelRatio,
    cellWidth - borderWidth,
    cellHeight - borderWidth
  );

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
