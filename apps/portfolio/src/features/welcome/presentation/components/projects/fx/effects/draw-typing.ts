import { MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';

const PHRASE = 'next fri 9am';
const CHARACTER_INTERVAL_SEC = 0.15;
const PAUSE_AFTER_PHRASE_CHARS = 15;
const INPUT_X_RATIO = 0.08;
const INPUT_Y_RATIO = 0.55;
const INPUT_ALPHA = 0.4;
const INPUT_PADDING_X_PX = 10;
const INPUT_PADDING_TOP_PX = 14;
const INPUT_HEIGHT_PX = 28;
const FONT_PX = 14;
const CARET_BLINK_HZ = 2.5;
const CARET_TOP_PX = 11;
const CARET_WIDTH_PX = 1.5;
const CARET_HEIGHT_PX = 14;

export interface ITypingState {
  shownCharacters: number;
  lastStepAt: number;
}

export function createTypingState(): ITypingState {
  return { shownCharacters: 0, lastStepAt: 0 };
}

/** A date input being typed into, one character per step, then cleared after a pause. */
export function drawTyping(
  { ctx, width, height, time, accent, devicePixelRatio }: IFxDrawContext,
  typing: ITypingState
): void {
  if (time - typing.lastStepAt > CHARACTER_INTERVAL_SEC) {
    typing.lastStepAt = time;
    typing.shownCharacters =
      (typing.shownCharacters + 1) % (PHRASE.length + PAUSE_AFTER_PHRASE_CHARS);
  }
  const shown = PHRASE.slice(0, Math.min(typing.shownCharacters, PHRASE.length));
  const x = width * INPUT_X_RATIO;
  const y = height * INPUT_Y_RATIO;
  ctx.strokeStyle = accent(INPUT_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  ctx.strokeRect(
    x - INPUT_PADDING_X_PX * devicePixelRatio,
    y - INPUT_PADDING_TOP_PX * devicePixelRatio,
    width - x * 2 + INPUT_PADDING_X_PX * 2 * devicePixelRatio,
    INPUT_HEIGHT_PX * devicePixelRatio
  );
  ctx.font = `${FONT_PX * devicePixelRatio}px ${MONO_FONT_STACK}`;
  ctx.fillStyle = accent(1);
  ctx.fillText(shown, x, y);
  if (Math.floor(time * CARET_BLINK_HZ) % 2 === 0) {
    ctx.fillRect(
      x + ctx.measureText(shown).width + devicePixelRatio,
      y - CARET_TOP_PX * devicePixelRatio,
      CARET_WIDTH_PX * devicePixelRatio,
      CARET_HEIGHT_PX * devicePixelRatio
    );
  }
}
