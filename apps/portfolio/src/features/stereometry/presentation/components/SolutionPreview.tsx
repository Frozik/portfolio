import { memo, useMemo } from 'react';

import { STEREOMETRY_STYLES } from '../../application/render/scene-styles';
import type { ResolvedElementStyle } from '../../application/render/style-resolver';
import { resolveStyle } from '../../application/render/style-resolver';
import type { Point2, PreviewMarker, PreviewSegment } from '../../domain/solution-preview';
import { buildSolutionPreview } from '../../domain/solution-preview';
import type { PuzzleDefinition } from '../../domain/types';

/** The picture is square; strokes and markers are in CSS pixels of the rendered box. */
const PREVIEW_SIZE = 400;
/** Dash pattern of hidden lines, in pixels: the live scene dashes in world units. */
const HIDDEN_DASH = '5 4';
const MARKER_TYPE_CIRCLE = 'circle';

function pointsAttribute(points: readonly Point2[]): string {
  return points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

function segmentStyle(segment: PreviewSegment): ResolvedElementStyle {
  return resolveStyle(
    STEREOMETRY_STYLES,
    'line',
    segment.hidden ? ['hidden', ...segment.modifiers] : segment.modifiers
  );
}

function markerStyle(marker: PreviewMarker): ResolvedElementStyle {
  return resolveStyle(
    STEREOMETRY_STYLES,
    'vertex',
    marker.hidden ? ['hidden', ...marker.modifiers] : marker.modifiers
  );
}

/** The solved puzzle, projected through its own camera and drawn with the scene's style map. */
export const SolutionPreview = memo(
  ({
    puzzle,
    className,
    label,
  }: {
    readonly puzzle: PuzzleDefinition;
    readonly className?: string;
    readonly label: string;
  }) => {
    const preview = useMemo(
      () => buildSolutionPreview(puzzle, PREVIEW_SIZE, PREVIEW_SIZE),
      [puzzle]
    );
    const background = resolveStyle(STEREOMETRY_STYLES, 'background', []).color;
    const face = resolveStyle(STEREOMETRY_STYLES, 'face', ['solution']);

    return (
      <svg
        viewBox={`0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}`}
        className={className}
        role="img"
        aria-label={label}
      >
        <rect width={PREVIEW_SIZE} height={PREVIEW_SIZE} fill={background} />
        {preview.faces.map(polygon => (
          <polygon
            key={pointsAttribute(polygon)}
            points={pointsAttribute(polygon)}
            fill={face.color}
            fillOpacity={face.alpha}
          />
        ))}
        {preview.segments.map(segment => {
          const style = segmentStyle(segment);
          return (
            <line
              key={`${segment.start.x},${segment.start.y}-${segment.end.x},${segment.end.y}`}
              x1={segment.start.x}
              y1={segment.start.y}
              x2={segment.end.x}
              y2={segment.end.y}
              stroke={style.color}
              strokeOpacity={style.alpha * segment.depthFade}
              strokeWidth={style.width}
              strokeDasharray={style.line.type === 'dashed' ? HIDDEN_DASH : undefined}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {preview.markers.map(marker => {
          const style = markerStyle(marker);
          const isRing = style.markerType === MARKER_TYPE_CIRCLE;
          return (
            <circle
              key={`${marker.position.x},${marker.position.y}`}
              cx={marker.position.x}
              cy={marker.position.y}
              r={style.size / 2}
              fill={style.color}
              fillOpacity={style.alpha * marker.depthFade}
              stroke={isRing ? style.strokeColor : undefined}
              strokeOpacity={style.alpha * marker.depthFade}
              strokeWidth={isRing ? style.strokeWidth : undefined}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    );
  }
);
