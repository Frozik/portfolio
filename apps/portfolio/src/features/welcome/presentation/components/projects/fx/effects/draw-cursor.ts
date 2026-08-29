/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

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

export function drawCursor({ ctx, width, height, time, speed, accent, dpr }: IFxDrawContext): void {
  const size = 9;
  const cellW = width / size;
  const cellH = height / size;

  const empties: Array<[number, number]> = [];
  for (let rowIndex = 0; rowIndex < size; rowIndex++) {
    for (let columnIndex = 0; columnIndex < size; columnIndex++) {
      if (SUDOKU_BOARD[rowIndex][columnIndex] === '.') {
        empties.push([rowIndex, columnIndex]);
      }
    }
  }
  if (empties.length === 0) {
    return;
  }
  const emptyIndex = Math.floor(time * speed * 0.6) % empties.length;
  const [cursorRow, cursorColumn] = empties[emptyIndex];
  const boxRow = Math.floor(cursorRow / 3) * 3;
  const boxColumn = Math.floor(cursorColumn / 3) * 3;
  const guess = '123456789'[emptyIndex % 9];

  ctx.fillStyle = accent(0.05);
  ctx.fillRect(0, cursorRow * cellH, width, cellH);
  ctx.fillRect(cursorColumn * cellW, 0, cellW, height);
  ctx.fillStyle = accent(0.07);
  ctx.fillRect(boxColumn * cellW, boxRow * cellH, cellW * 3, cellH * 3);

  ctx.fillStyle = accent(0.14);
  for (let rowIndex = 0; rowIndex < size; rowIndex++) {
    for (let columnIndex = 0; columnIndex < size; columnIndex++) {
      if (SUDOKU_BOARD[rowIndex][columnIndex] === guess) {
        ctx.fillRect(columnIndex * cellW, rowIndex * cellH, cellW, cellH);
      }
    }
  }

  ctx.fillStyle = accent(0.28);
  ctx.fillRect(cursorColumn * cellW, cursorRow * cellH, cellW, cellH);

  ctx.strokeStyle = accent(0.15);
  ctx.lineWidth = dpr;
  ctx.beginPath();
  for (let lineIndex = 1; lineIndex < size; lineIndex++) {
    if (lineIndex % 3 === 0) {
      continue;
    }
    const x = lineIndex * cellW;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    const y = lineIndex * cellH;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.strokeStyle = accent(0.5);
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  for (let lineIndex = 0; lineIndex <= size; lineIndex += 3) {
    const x = lineIndex * cellW;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    const y = lineIndex * cellH;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  const fontSize = Math.min(cellW, cellH) * 0.58;
  ctx.font = `${fontSize}px ${MONO_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let rowIndex = 0; rowIndex < size; rowIndex++) {
    for (let columnIndex = 0; columnIndex < size; columnIndex++) {
      const character = SUDOKU_BOARD[rowIndex][columnIndex];
      if (character === '.') {
        continue;
      }
      const isGuessMatch = character === guess;
      ctx.fillStyle = isGuessMatch ? accent(1) : accent(0.55);
      ctx.fillText(character, columnIndex * cellW + cellW / 2, rowIndex * cellH + cellH / 2 + dpr);
    }
  }

  if (Math.floor(time * 3) % 2 === 0) {
    ctx.fillStyle = accent(1);
    ctx.fillText(guess, cursorColumn * cellW + cellW / 2, cursorRow * cellH + cellH / 2 + dpr);
  }

  ctx.strokeStyle = accent(1);
  ctx.lineWidth = 2 * dpr;
  ctx.strokeRect(
    cursorColumn * cellW + dpr,
    cursorRow * cellH + dpr,
    cellW - 2 * dpr,
    cellH - 2 * dpr
  );

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
