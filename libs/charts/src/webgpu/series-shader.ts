import type { IFigurePoint } from '../marks/marker/figures';
import { FIGURE_POLYGONS, POLYGON_FIGURES } from '../marks/marker/figures';
import type { IWebGpuMarkPainter } from './painter';
import commonSource from './shaders/common.wgsl?raw';
import numberAxisSource from './shaders/number-axis.wgsl?raw';
import timeAxisSource from './shaders/time-axis.wgsl?raw';

export type TAxisKind = 'time' | 'number';

const AXIS_SOURCES: Readonly<Record<TAxisKind, string>> = {
  time: timeAxisSource,
  number: numberAxisSource,
};

function wgslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

/** The marker figures as constants: the one table of §5.3, in the shader's words. */
export function figureTableSource(): string {
  const polygons: readonly (readonly IFigurePoint[])[] = POLYGON_FIGURES.map(
    figure => FIGURE_POLYGONS[figure]
  );
  const vertices = polygons.flat();
  const firsts = polygons.map((_, index) =>
    polygons.slice(0, index).reduce((sum, polygon) => sum + polygon.length, 0)
  );
  const list = (values: readonly string[]): string => values.join(', ');

  return [
    `const FIGURE_VERTICES: array<vec2<f32>, ${vertices.length}> = array<vec2<f32>, ${vertices.length}>(`,
    `    ${list(vertices.map(vertex => `vec2<f32>(${wgslFloat(vertex.x)}, ${wgslFloat(vertex.y)})`))}`,
    ');',
    `const FIGURE_FIRST: array<u32, ${polygons.length}> = array<u32, ${polygons.length}>(${list(firsts.map(first => `${first}u`))});`,
    `const FIGURE_COUNT: array<u32, ${polygons.length}> = array<u32, ${polygons.length}>(${list(polygons.map(polygon => `${polygon.length}u`))});`,
  ].join('\n');
}

/**
 * One module for every connected mark: the shared code, the axis reader, each
 * mark's vertex function, and a `switch` over the mark the layer names. A new
 * mark brings its function; nobody edits the shared shader by hand (§6.6).
 */
export function seriesShaderSource(
  painters: readonly IWebGpuMarkPainter[],
  axis: TAxisKind
): string {
  const cases = painters.map(
    (painter, code) =>
      `        case ${code}u: { return ${painter.vertexFunction}(vertex, instance); }`
  );
  return [
    commonSource,
    AXIS_SOURCES[axis],
    figureTableSource(),
    ...painters.map(painter => painter.source),
    '@vertex',
    'fn vertexMain(',
    '    @builtin(vertex_index) vertex: u32,',
    '    @builtin(instance_index) instance: u32,',
    ') -> VertexOutput {',
    '    switch layer.mark {',
    ...cases,
    '        default: { return collapsed(); }',
    '    }',
    '}',
  ].join('\n');
}
