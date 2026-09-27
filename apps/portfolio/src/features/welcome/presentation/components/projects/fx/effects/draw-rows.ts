import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

const ROW_HEIGHT_RATIO = 0.11;
const HEADER_HEIGHT_RATIO = 0.14;
const COLUMN_WIDTH_RATIOS: readonly number[] = [0.08, 0.3, 0.16, 0.16, 0.3];
const PADDING_RATIO = 0.04;
const SCROLL_ROWS_PER_SECOND = 0.6;
const HEADER_ALPHA = 0.22;
const LINE_ALPHA = 0.12;
const TEXT_ALPHA_MIN = 0.16;
const TEXT_ALPHA_MAX = 0.42;
const HIGHLIGHT_ALPHA = 0.14;
const HIGHLIGHT_PERIOD_SECONDS = 3;
const HIGHLIGHT_WIDTH_ROWS = 1.5;
const BAR_HEIGHT_RATIO = 0.34;
const BAR_WIDTH_MIN = 0.35;
const BAR_WIDTH_MAX = 0.85;
const SORTED_COLUMN = 3;

/**
 * A data grid that never stops scrolling: a sticky header, rows of text
 * bars whose widths are stable per row, and a selection band sweeping
 * down the sorted column.
 */
export function drawRows({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const padding = width * PADDING_RATIO;
  const innerWidth = width - padding * 2;
  const headerHeight = height * HEADER_HEIGHT_RATIO;
  const rowHeight = height * ROW_HEIGHT_RATIO;
  const scrolled = time * SCROLL_ROWS_PER_SECOND;
  const firstRow = Math.floor(scrolled);
  const shift = (scrolled - firstRow) * rowHeight;
  const rowCount = Math.ceil((height - headerHeight) / rowHeight) + 1;
  const columns = COLUMN_WIDTH_RATIOS.map(ratio => ratio * innerWidth);
  const highlightRow = ((time % HIGHLIGHT_PERIOD_SECONDS) / HIGHLIGHT_PERIOD_SECONDS) * rowCount;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, headerHeight, width, height - headerHeight);
  ctx.clip();

  for (let index = 0; index < rowCount; index++) {
    const row = firstRow + index;
    const top = headerHeight + index * rowHeight - shift;
    const distance = Math.abs(index - highlightRow);
    if (distance < HIGHLIGHT_WIDTH_ROWS) {
      ctx.fillStyle = accent(HIGHLIGHT_ALPHA * (1 - distance / HIGHLIGHT_WIDTH_ROWS));
      ctx.fillRect(padding, top, innerWidth, rowHeight);
    }
    ctx.strokeStyle = accent(LINE_ALPHA);
    ctx.lineWidth = devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(padding, top + rowHeight);
    ctx.lineTo(width - padding, top + rowHeight);
    ctx.stroke();

    let left = padding;
    columns.forEach((columnWidth, column) => {
      const noise = pseudoRandom(row, column);
      const barWidth = columnWidth * (BAR_WIDTH_MIN + (BAR_WIDTH_MAX - BAR_WIDTH_MIN) * noise);
      const barHeight = rowHeight * BAR_HEIGHT_RATIO;
      const alpha = TEXT_ALPHA_MIN + (TEXT_ALPHA_MAX - TEXT_ALPHA_MIN) * pseudoRandom(column, row);
      ctx.fillStyle = accent(column === SORTED_COLUMN ? TEXT_ALPHA_MAX : alpha);
      const barLeft =
        column === SORTED_COLUMN ? left + columnWidth - barWidth - padding : left + padding * 0.5;
      ctx.fillRect(barLeft, top + (rowHeight - barHeight) / 2, barWidth, barHeight);
      left += columnWidth;
    });
  }
  ctx.restore();

  ctx.fillStyle = accent(HEADER_ALPHA);
  ctx.fillRect(padding, 0, innerWidth, headerHeight);
  let left = padding;
  columns.forEach((columnWidth, column) => {
    const barHeight = headerHeight * BAR_HEIGHT_RATIO;
    ctx.fillStyle = accent(column === SORTED_COLUMN ? TEXT_ALPHA_MAX : TEXT_ALPHA_MIN);
    ctx.fillRect(
      left + padding * 0.5,
      (headerHeight - barHeight) / 2,
      columnWidth * 0.5,
      barHeight
    );
    left += columnWidth;
  });
}
