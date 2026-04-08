import { computeXTicks, computeYTicks } from './axis-ticks';
import {
  AXIS_FONT_FAMILY,
  AXIS_FONT_SIZE,
  AXIS_LABEL_BG_COLOR,
  AXIS_LABEL_BG_PADDING_X,
  AXIS_LABEL_BG_PADDING_Y,
  AXIS_LABEL_COLOR,
  AXIS_LINE_COLOR,
  AXIS_MARGIN_BOTTOM,
  AXIS_MARGIN_LEFT,
  AXIS_MARGIN_RIGHT,
  AXIS_MARGIN_TOP,
  GRID_LINE_COLOR,
  SVG_NS,
  TICK_LENGTH,
  X_LABEL_Y_AXIS_CLEARANCE,
  Y_LABEL_X_AXIS_CLEARANCE,
} from './constants';
import type { IChartViewport } from './types';
import { scaleFromTimeRange } from './viewport';

export function clearSvg(svgContainer: SVGSVGElement): void {
  while (svgContainer.firstChild) {
    svgContainer.removeChild(svgContainer.firstChild);
  }
}

interface IPlotBounds {
  svgWidth: number;
  svgHeight: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  plotWidth: number;
  plotHeight: number;
}

function computePlotBounds(
  canvasClientWidth: number,
  canvasClientHeight: number
): IPlotBounds | null {
  const svgWidth = canvasClientWidth;
  const svgHeight = canvasClientHeight;
  const plotLeft = AXIS_MARGIN_LEFT;
  const plotRight = svgWidth - AXIS_MARGIN_RIGHT;
  const plotTop = AXIS_MARGIN_TOP;
  const plotBottom = svgHeight - AXIS_MARGIN_BOTTOM;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  if (plotWidth <= 0 || plotHeight <= 0) {
    return null;
  }

  return { svgWidth, svgHeight, plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight };
}

function setupSvg(svg: SVGSVGElement, width: number, height: number): void {
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
}

/** Render grid lines only (background layer, behind canvas). */
export function renderGrid(
  svgContainer: SVGSVGElement,
  viewport: IChartViewport,
  canvasClientWidth: number,
  canvasClientHeight: number
): void {
  clearSvg(svgContainer);

  const bounds = computePlotBounds(canvasClientWidth, canvasClientHeight);

  if (bounds === null) {
    return;
  }

  const { svgWidth, svgHeight, plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight } =
    bounds;

  setupSvg(svgContainer, svgWidth, svgHeight);

  const timeRange = viewport.viewTimeEnd - viewport.viewTimeStart;
  const valueRange = viewport.viewValueMax - viewport.viewValueMin;

  // Vertical grid lines
  const scale = scaleFromTimeRange(viewport.viewTimeStart, viewport.viewTimeEnd);
  const xTicks = computeXTicks(viewport.viewTimeStart, viewport.viewTimeEnd, scale, plotWidth);

  for (const tick of xTicks) {
    const normalized = (tick.position - viewport.viewTimeStart) / timeRange;
    const x = plotLeft + normalized * plotWidth;

    if (x < plotLeft || x > plotRight) {
      continue;
    }

    const gridLine = document.createElementNS(SVG_NS, 'line');
    gridLine.setAttribute('x1', String(x));
    gridLine.setAttribute('y1', String(plotTop));
    gridLine.setAttribute('x2', String(x));
    gridLine.setAttribute('y2', String(plotBottom));
    gridLine.setAttribute('stroke', GRID_LINE_COLOR);
    gridLine.setAttribute('stroke-width', '0.5');
    svgContainer.appendChild(gridLine);
  }

  // Horizontal grid lines
  const yTicks = computeYTicks(viewport.viewValueMin, viewport.viewValueMax, plotHeight);

  for (const tick of yTicks) {
    const normalized = (tick.position - viewport.viewValueMin) / valueRange;
    const y = plotBottom - normalized * plotHeight;

    if (y < plotTop || y > plotBottom) {
      continue;
    }

    const gridLine = document.createElementNS(SVG_NS, 'line');
    gridLine.setAttribute('x1', String(plotLeft));
    gridLine.setAttribute('y1', String(y));
    gridLine.setAttribute('x2', String(plotRight));
    gridLine.setAttribute('y2', String(y));
    gridLine.setAttribute('stroke', GRID_LINE_COLOR);
    gridLine.setAttribute('stroke-width', '0.5');
    svgContainer.appendChild(gridLine);
  }
}

/** Render axis lines, tick marks, and labels (foreground layer, above canvas). */
export function renderAxes(
  svgContainer: SVGSVGElement,
  viewport: IChartViewport,
  canvasClientWidth: number,
  canvasClientHeight: number
): void {
  clearSvg(svgContainer);

  const bounds = computePlotBounds(canvasClientWidth, canvasClientHeight);

  if (bounds === null) {
    return;
  }

  const { svgWidth, svgHeight, plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight } =
    bounds;

  setupSvg(svgContainer, svgWidth, svgHeight);

  // Axis lines
  const axisPath = document.createElementNS(SVG_NS, 'path');
  axisPath.setAttribute(
    'd',
    `M ${plotLeft} ${plotTop} L ${plotLeft} ${plotBottom} L ${plotRight} ${plotBottom}`
  );
  axisPath.setAttribute('stroke', AXIS_LINE_COLOR);
  axisPath.setAttribute('fill', 'none');
  axisPath.setAttribute('stroke-width', '1');
  svgContainer.appendChild(axisPath);

  const timeRange = viewport.viewTimeEnd - viewport.viewTimeStart;
  const valueRange = viewport.viewValueMax - viewport.viewValueMin;

  // X-axis ticks + labels
  const scale = scaleFromTimeRange(viewport.viewTimeStart, viewport.viewTimeEnd);
  const xTicks = computeXTicks(viewport.viewTimeStart, viewport.viewTimeEnd, scale, plotWidth);

  for (const tick of xTicks) {
    const normalized = (tick.position - viewport.viewTimeStart) / timeRange;
    const x = plotLeft + normalized * plotWidth;

    if (x < plotLeft || x > plotRight) {
      continue;
    }

    // Tick mark (upward from axis)
    const tickLine = document.createElementNS(SVG_NS, 'line');
    tickLine.setAttribute('x1', String(x));
    tickLine.setAttribute('y1', String(plotBottom));
    tickLine.setAttribute('x2', String(x));
    tickLine.setAttribute('y2', String(plotBottom - TICK_LENGTH));
    tickLine.setAttribute('stroke', AXIS_LINE_COLOR);
    tickLine.setAttribute('stroke-width', '1');
    svgContainer.appendChild(tickLine);

    // Label background + text (above axis)
    const labelY = plotBottom - TICK_LENGTH - 3;
    const textWidth = tick.label.length * AXIS_FONT_SIZE * 0.6;
    const labelLeft = x - textWidth / 2 - AXIS_LABEL_BG_PADDING_X;

    // Skip if label would overlap the Y-axis zone
    if (labelLeft < plotLeft + X_LABEL_Y_AXIS_CLEARANCE) {
      continue;
    }

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', String(x - textWidth / 2 - AXIS_LABEL_BG_PADDING_X));
    bg.setAttribute('y', String(labelY - AXIS_FONT_SIZE + AXIS_LABEL_BG_PADDING_Y));
    bg.setAttribute('width', String(textWidth + AXIS_LABEL_BG_PADDING_X * 2));
    bg.setAttribute('height', String(AXIS_FONT_SIZE + AXIS_LABEL_BG_PADDING_Y * 2));
    bg.setAttribute('fill', AXIS_LABEL_BG_COLOR);
    bg.setAttribute('rx', '2');
    svgContainer.appendChild(bg);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', String(labelY));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', AXIS_LABEL_COLOR);
    label.setAttribute('font-size', String(AXIS_FONT_SIZE));
    label.setAttribute('font-family', AXIS_FONT_FAMILY);
    label.textContent = tick.label;
    svgContainer.appendChild(label);
  }

  // Y-axis ticks + labels
  const yTicks = computeYTicks(viewport.viewValueMin, viewport.viewValueMax, plotHeight);

  for (const tick of yTicks) {
    const normalized = (tick.position - viewport.viewValueMin) / valueRange;
    const y = plotBottom - normalized * plotHeight;

    if (y < plotTop || y > plotBottom) {
      continue;
    }

    // Tick mark (rightward from axis)
    const tickLine = document.createElementNS(SVG_NS, 'line');
    tickLine.setAttribute('x1', String(plotLeft));
    tickLine.setAttribute('y1', String(y));
    tickLine.setAttribute('x2', String(plotLeft + TICK_LENGTH));
    tickLine.setAttribute('y2', String(y));
    tickLine.setAttribute('stroke', AXIS_LINE_COLOR);
    tickLine.setAttribute('stroke-width', '1');
    svgContainer.appendChild(tickLine);

    // Label background + text (right of axis)
    const labelX = plotLeft + TICK_LENGTH + 4;
    const labelY = y + AXIS_FONT_SIZE / 3;
    const labelBottom = labelY + AXIS_LABEL_BG_PADDING_Y;

    // Skip if label would overlap the X-axis label zone
    if (labelBottom > plotBottom - Y_LABEL_X_AXIS_CLEARANCE) {
      continue;
    }

    const textWidth = tick.label.length * AXIS_FONT_SIZE * 0.6;

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', String(labelX - AXIS_LABEL_BG_PADDING_X));
    bg.setAttribute('y', String(labelY - AXIS_FONT_SIZE + AXIS_LABEL_BG_PADDING_Y));
    bg.setAttribute('width', String(textWidth + AXIS_LABEL_BG_PADDING_X * 2));
    bg.setAttribute('height', String(AXIS_FONT_SIZE + AXIS_LABEL_BG_PADDING_Y * 2));
    bg.setAttribute('fill', AXIS_LABEL_BG_COLOR);
    bg.setAttribute('rx', '2');
    svgContainer.appendChild(bg);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(labelX));
    label.setAttribute('y', String(labelY));
    label.setAttribute('text-anchor', 'start');
    label.setAttribute('fill', AXIS_LABEL_COLOR);
    label.setAttribute('font-size', String(AXIS_FONT_SIZE));
    label.setAttribute('font-family', AXIS_FONT_FAMILY);
    label.textContent = tick.label;
    svgContainer.appendChild(label);
  }
}
