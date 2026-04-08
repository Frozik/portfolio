import { computeXTicks, computeYTicks } from './axis-ticks';
import {
  AXIS_FONT_FAMILY,
  AXIS_FONT_SIZE,
  AXIS_LABEL_COLOR,
  AXIS_LINE_COLOR,
  AXIS_MARGIN_BOTTOM,
  AXIS_MARGIN_LEFT,
  AXIS_MARGIN_RIGHT,
  AXIS_MARGIN_TOP,
  GRID_LINE_COLOR,
  SVG_NS,
  TICK_LENGTH,
} from './constants';
import type { IChartViewport } from './types';
import { scaleFromTimeRange } from './viewport';

export function clearSvg(svgContainer: SVGSVGElement): void {
  while (svgContainer.firstChild) {
    svgContainer.removeChild(svgContainer.firstChild);
  }
}

export function renderAxes(
  svgContainer: SVGSVGElement,
  viewport: IChartViewport,
  canvasClientWidth: number,
  canvasClientHeight: number
): void {
  clearSvg(svgContainer);

  const svgWidth = canvasClientWidth;
  const svgHeight = canvasClientHeight;

  svgContainer.setAttribute('width', String(svgWidth));
  svgContainer.setAttribute('height', String(svgHeight));
  svgContainer.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

  const plotLeft = AXIS_MARGIN_LEFT;
  const plotRight = svgWidth - AXIS_MARGIN_RIGHT;
  const plotTop = AXIS_MARGIN_TOP;
  const plotBottom = svgHeight - AXIS_MARGIN_BOTTOM;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  if (plotWidth <= 0 || plotHeight <= 0) {
    return;
  }

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

  // X-axis ticks
  const scale = scaleFromTimeRange(viewport.viewTimeStart, viewport.viewTimeEnd);
  const xTicks = computeXTicks(viewport.viewTimeStart, viewport.viewTimeEnd, scale, plotWidth);

  for (const tick of xTicks) {
    const normalized = (tick.position - viewport.viewTimeStart) / timeRange;
    const x = plotLeft + normalized * plotWidth;

    if (x < plotLeft || x > plotRight) {
      continue;
    }

    // Grid line
    const gridLine = document.createElementNS(SVG_NS, 'line');
    gridLine.setAttribute('x1', String(x));
    gridLine.setAttribute('y1', String(plotTop));
    gridLine.setAttribute('x2', String(x));
    gridLine.setAttribute('y2', String(plotBottom));
    gridLine.setAttribute('stroke', GRID_LINE_COLOR);
    gridLine.setAttribute('stroke-width', '0.5');
    svgContainer.appendChild(gridLine);

    // Tick mark
    const tickLine = document.createElementNS(SVG_NS, 'line');
    tickLine.setAttribute('x1', String(x));
    tickLine.setAttribute('y1', String(plotBottom));
    tickLine.setAttribute('x2', String(x));
    tickLine.setAttribute('y2', String(plotBottom + TICK_LENGTH));
    tickLine.setAttribute('stroke', AXIS_LINE_COLOR);
    tickLine.setAttribute('stroke-width', '1');
    svgContainer.appendChild(tickLine);

    // Label
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', String(plotBottom + TICK_LENGTH + AXIS_FONT_SIZE + 2));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', AXIS_LABEL_COLOR);
    label.setAttribute('font-size', String(AXIS_FONT_SIZE));
    label.setAttribute('font-family', AXIS_FONT_FAMILY);
    label.textContent = tick.label;
    svgContainer.appendChild(label);
  }

  // Y-axis ticks
  const yTicks = computeYTicks(viewport.viewValueMin, viewport.viewValueMax, plotHeight);

  for (const tick of yTicks) {
    const normalized = (tick.position - viewport.viewValueMin) / valueRange;
    const y = plotBottom - normalized * plotHeight;

    if (y < plotTop || y > plotBottom) {
      continue;
    }

    // Grid line
    const gridLine = document.createElementNS(SVG_NS, 'line');
    gridLine.setAttribute('x1', String(plotLeft));
    gridLine.setAttribute('y1', String(y));
    gridLine.setAttribute('x2', String(plotRight));
    gridLine.setAttribute('y2', String(y));
    gridLine.setAttribute('stroke', GRID_LINE_COLOR);
    gridLine.setAttribute('stroke-width', '0.5');
    svgContainer.appendChild(gridLine);

    // Tick mark
    const tickLine = document.createElementNS(SVG_NS, 'line');
    tickLine.setAttribute('x1', String(plotLeft - TICK_LENGTH));
    tickLine.setAttribute('y1', String(y));
    tickLine.setAttribute('x2', String(plotLeft));
    tickLine.setAttribute('y2', String(y));
    tickLine.setAttribute('stroke', AXIS_LINE_COLOR);
    tickLine.setAttribute('stroke-width', '1');
    svgContainer.appendChild(tickLine);

    // Label
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(plotLeft - TICK_LENGTH - 4));
    label.setAttribute('y', String(y + AXIS_FONT_SIZE / 3));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('fill', AXIS_LABEL_COLOR);
    label.setAttribute('font-size', String(AXIS_FONT_SIZE));
    label.setAttribute('font-family', AXIS_FONT_FAMILY);
    label.textContent = tick.label;
    svgContainer.appendChild(label);
  }
}
