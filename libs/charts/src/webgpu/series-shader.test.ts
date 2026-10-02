import { describe, expect, it } from 'vitest';

import type { IWebGpuMarkPainter } from './painter';
import { figureTableSource, seriesShaderSource } from './series-shader';

function painter(markId: string): IWebGpuMarkPainter {
  return {
    markId,
    source: `fn ${markId}Vertex(vertex: u32, instance: u32) -> VertexOutput { return collapsed(); }`,
    vertexFunction: `${markId}Vertex`,
    verticesPerInstance: 6,
    layers: () => [],
    instances: visible => ({ first: visible.firstPoint, count: visible.pointCount }),
  };
}

describe('the series shader', () => {
  it('gives each connected mark a branch numbered by its place in the list', () => {
    const source = seriesShaderSource([painter('line'), painter('marker')], 'time');

    expect(source).toContain('case 0u: { return lineVertex(vertex, instance); }');
    expect(source).toContain('case 1u: { return markerVertex(vertex, instance); }');
    expect(source).toContain('fn markerVertex(');
  });

  it('reads positions the way the axis stores them', () => {
    expect(seriesShaderSource([], 'time')).toContain('nanos');
    expect(seriesShaderSource([], 'number')).not.toContain('nanos');
  });

  it('defines every binding and the fragment stage once, whatever the marks', () => {
    const source = seriesShaderSource([painter('line'), painter('candle')], 'time');

    expect(source.match(/fn fragmentMain/g)).toHaveLength(1);
    expect(source.match(/fn axisX/g)).toHaveLength(1);
    expect(source.match(/@vertex/g)).toHaveLength(1);
  });

  it('writes the marker figures as one table of polygon vertices', () => {
    const table = figureTableSource();

    expect(table).toContain('const FIGURE_VERTICES: array<vec2<f32>, 69>');
    expect(table).toContain('const FIGURE_FIRST: array<u32, 13> = array<u32, 13>(0u, 4u, 8u,');
    expect(table).toMatch(/FIGURE_COUNT.*4u, 4u, 3u, 3u, 3u, 3u, 7u, 7u, 7u, 7u, 5u, 6u, 10u\)/);
  });
});
