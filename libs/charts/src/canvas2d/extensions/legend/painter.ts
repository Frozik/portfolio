import type { IChartFrame } from '../../../core/frame/chart-frame';
import { cssOf } from '../../../core/series/color';
import { ownFrame } from '../../../core/stage/backend';
import type { ILegendEntry, ILegendSlice } from '../../../extensions/legend/core';
import { axisLabelStyleOf } from '../../axis-label';
import type { ICanvasPainter, TCanvasPainterFactory } from '../../painter';

/** Clear of the labels of the scale on the left, CSS pixels from the left edge of the plot. */
const LEFT_OFFSET = 64;
const TOP_OFFSET = 6;
const ROW_GAP = 4;
const WORD_GAP = 6;
const BOX_PADDING = 4;

interface IWord {
  readonly text: string;
  readonly color: string;
}

function wordsOf<TX>(entry: ILegendEntry<TX>, nameColor: string): readonly IWord[] {
  const color = cssOf(entry.color);
  return [
    { text: entry.name, color: nameColor },
    ...entry.values.map(({ label, text }) => ({
      text: label === '' ? text : `${label} ${text}`,
      color,
    })),
  ];
}

/**
 * The legend in the top left corner of every pane: a row per series of the
 * pane — its name, then its values at the pointed position in the colour the
 * series is drawn in — on the colour of the label boxes, so it reads over
 * the series.
 */
export function legendPainter<TX>(slice: ILegendSlice<TX>): TCanvasPainterFactory {
  return ({ text }): ICanvasPainter => {
    let paintedFrame: IChartFrame<unknown> | undefined;
    let paintedPointer = slice.pointer;
    return {
      isStale(frame): boolean {
        const stale = frame !== paintedFrame || slice.pointer !== paintedPointer;
        paintedFrame = frame;
        paintedPointer = slice.pointer;
        return stale;
      },
      paint(context, unknownFrame): void {
        const frame = ownFrame<TX>(unknownFrame);
        const { theme } = frame;
        const dpr = frame.size.devicePixelRatio;
        const style = axisLabelStyleOf(frame, text);
        const entries = slice.entriesOf(frame);
        const padding = BOX_PADDING * dpr;
        const wordGap = WORD_GAP * dpr;
        const rowHeight = style.boxHeight + ROW_GAP * dpr;

        context.font = style.font;
        context.textBaseline = 'alphabetic';
        context.textAlign = 'start';
        for (const pane of frame.panes) {
          const left = pane.plot.left + LEFT_OFFSET * dpr;
          let centerY = pane.plot.top + TOP_OFFSET * dpr + style.boxHeight / 2;
          for (const entry of entries) {
            if (entry.paneId !== pane.id) {
              continue;
            }
            const words = wordsOf(entry, cssOf(theme.label.text));
            const widths = words.map(word => text.measureWidth(word.text, style.font));
            const rowWidth =
              widths.reduce((sum, width) => sum + width, 0) + wordGap * (words.length - 1);

            context.fillStyle = cssOf(theme.label.background);
            context.beginPath();
            context.roundRect(
              left - padding,
              centerY - style.boxHeight / 2,
              rowWidth + padding * 2,
              style.boxHeight,
              style.radius
            );
            context.fill();

            let wordLeft = left;
            words.forEach((word, index) => {
              context.fillStyle = word.color;
              context.fillText(word.text, wordLeft, centerY + style.glyphCenterOffset);
              wordLeft += widths[index] + wordGap;
            });
            centerY += rowHeight;
          }
        }
      },
    };
  };
}
