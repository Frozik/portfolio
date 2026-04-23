import { assertNever } from '@frozik/utils';
import type { CSSProperties, ReactNode } from 'react';
import { memo, useMemo } from 'react';

const COLOR_UP = '#16a34a';
const COLOR_DOWN = '#dc2626';
const COLOR_FLAT = '#9ca3af';

const DEFAULT_PADDING = 1;
const DEFAULT_STROKE_WIDTH = 1.5;
const COORD_DECIMAL_PLACES = 1;
const MIN_POINTS_TO_RENDER = 2;

type TSparklineTrend = 'up' | 'down' | 'flat';

export interface SparklineProps {
  /** Numeric data points rendered as a polyline, oldest → newest. */
  readonly data: readonly number[];
  /** Virtual viewBox width for the SVG coordinate system. */
  readonly viewBoxWidth: number;
  /** Virtual viewBox height for the SVG coordinate system. */
  readonly viewBoxHeight: number;
  /**
   * Maximum number of data points the chart is designed for. Controls
   * horizontal spacing so the line advances at a constant rate even
   * before the buffer is full.
   */
  readonly maxPoints: number;
  /** Padding inside the viewBox on all sides. @default 1 */
  readonly padding?: number;
  /** CSS class applied to the root SVG element. */
  readonly className?: string;
  /** Inline styles applied to the root SVG element. */
  readonly style?: CSSProperties;
  /**
   * When true the SVG uses `preserveAspectRatio="none"` so the chart
   * stretches to fill its container width set via CSS. When false the
   * SVG uses explicit `width`/`height` attributes matching the viewBox.
   * @default false
   */
  readonly stretchToFill?: boolean;
  /**
   * Swap the up/down trend colours. Use when a lower value is better
   * (e.g. round-trip time) and you want a downward line to read as green.
   * @default false
   */
  readonly invertTrend?: boolean;
  /** Override the trend-derived stroke colour with a single fixed value. */
  readonly strokeColor?: string;
  /** SVG children rendered before the polyline (background layers). */
  readonly children?: ReactNode;
  /** SVG children rendered after the polyline (foreground overlays). */
  readonly overlay?: ReactNode;
}

interface IPolylineData {
  readonly points: string;
  readonly trend: TSparklineTrend;
}

function determineTrend(first: number, last: number): TSparklineTrend {
  if (last > first) {
    return 'up';
  }
  if (last < first) {
    return 'down';
  }
  return 'flat';
}

function getTrendColor(trend: TSparklineTrend, invert: boolean): string {
  switch (trend) {
    case 'up':
      return invert ? COLOR_DOWN : COLOR_UP;
    case 'down':
      return invert ? COLOR_UP : COLOR_DOWN;
    case 'flat':
      return COLOR_FLAT;
    default:
      assertNever(trend);
  }
}

function computePolyline(
  data: readonly number[],
  viewBoxWidth: number,
  viewBoxHeight: number,
  maxPoints: number,
  padding: number
): IPolylineData | null {
  if (data.length < MIN_POINTS_TO_RENDER || maxPoints < MIN_POINTS_TO_RENDER) {
    return null;
  }

  const first = data[0];
  const last = data[data.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }

  let min = first;
  let max = first;
  for (const value of data) {
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  const range = max - min;
  const drawableWidth = viewBoxWidth - padding * 2;
  const drawableHeight = viewBoxHeight - padding * 2;
  const step = drawableWidth / (maxPoints - 1);
  const midY = padding + drawableHeight / 2;

  const points = data
    .map((value, index) => {
      const x = padding + index * step;
      const y =
        range === 0 ? midY : padding + drawableHeight - ((value - min) / range) * drawableHeight;
      return `${x.toFixed(COORD_DECIMAL_PLACES)},${y.toFixed(COORD_DECIMAL_PLACES)}`;
    })
    .join(' ');

  return { points, trend: determineTrend(first, last) };
}

const SparklineComponent = ({
  data,
  viewBoxWidth,
  viewBoxHeight,
  maxPoints,
  padding = DEFAULT_PADDING,
  className,
  style,
  stretchToFill = false,
  invertTrend = false,
  strokeColor,
  children,
  overlay,
}: SparklineProps) => {
  const polyline = useMemo(
    () => computePolyline(data, viewBoxWidth, viewBoxHeight, maxPoints, padding),
    [data, viewBoxWidth, viewBoxHeight, maxPoints, padding]
  );

  const resolvedStroke =
    strokeColor ?? (polyline !== null ? getTrendColor(polyline.trend, invertTrend) : COLOR_FLAT);

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      {...(stretchToFill
        ? { preserveAspectRatio: 'none' }
        : { width: viewBoxWidth, height: viewBoxHeight })}
      className={className}
      style={style}
    >
      {children}
      {polyline !== null && (
        <polyline
          points={polyline.points}
          fill="none"
          stroke={resolvedStroke}
          strokeWidth={DEFAULT_STROKE_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="round"
          {...(stretchToFill ? { vectorEffect: 'non-scaling-stroke' } : {})}
        />
      )}
      {overlay}
    </svg>
  );
};

export const Sparkline = memo(SparklineComponent);
