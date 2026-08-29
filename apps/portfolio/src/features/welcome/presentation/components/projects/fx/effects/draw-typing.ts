/** Ported design reference — tuning numbers are intentionally inline (see `../effect-registry`). */

import { MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';

export interface ITypingState {
  phrase: string;
  shown: number;
  last: number;
}

export function createTypingState(): ITypingState {
  return { phrase: 'next fri 9am', shown: 0, last: 0 };
}

export function drawTyping(
  { ctx, width, height, time, speed, accent, dpr }: IFxDrawContext,
  typing: ITypingState
): void {
  if (time - typing.last > 0.15 / speed) {
    typing.last = time;
    typing.shown = (typing.shown + 1) % (typing.phrase.length + 15);
  }
  const shown = typing.phrase.slice(0, Math.min(typing.shown, typing.phrase.length));
  const x = width * 0.08;
  const y = height * 0.55;
  ctx.strokeStyle = accent(0.4);
  ctx.lineWidth = dpr;
  ctx.strokeRect(x - 10 * dpr, y - 14 * dpr, width - x * 2 + 20 * dpr, 28 * dpr);
  ctx.font = `${14 * dpr}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = accent(1);
  ctx.fillText(shown, x, y);
  const caretX = x + ctx.measureText(shown).width + dpr;
  if (Math.floor(time * 2.5) % 2 === 0) {
    ctx.fillRect(caretX, y - 11 * dpr, 1.5 * dpr, 14 * dpr);
  }
}
