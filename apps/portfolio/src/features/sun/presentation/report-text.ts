import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { Viewport } from '../application/SunStore';
import type { Benchmark } from '../domain/benchmark';
import type { GpuStatus, WebGlInfo } from '../domain/gpu-capabilities';
import { accelerationOf, featureSupportOf } from '../domain/gpu-capabilities';
import { refreshRateOf } from '../domain/refresh-rate';

interface Report {
  readonly benchmark: Benchmark;
  readonly fps: number;
  readonly viewport: Viewport | undefined;
  readonly gpu: GpuStatus;
  readonly webgl: WebGlInfo | undefined;
  readonly userAgent: string;
}

const numberFormat = new Intl.NumberFormat('en-US');

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

/** Everything the panel knows, as text to paste: always in English, it is read by whoever debugs the card. */
export function reportText(report: Report): string {
  const { viewport, webgl } = report;
  return [
    `Result: ${resultLine(report.benchmark)}`,
    `FPS now: ${report.fps}`,
    `Canvas: ${isNil(viewport) ? 'unknown' : `${viewport.width}x${viewport.height} @${viewport.devicePixelRatio}x`}`,
    `Acceleration: ${accelerationOf(report.gpu, webgl)}`,
    `User agent: ${report.userAgent}`,
    isNil(webgl)
      ? 'WebGL: unavailable'
      : `WebGL: ${webgl.renderer} | ${webgl.vendor} | software: ${webgl.isSoftware ?? 'unknown'} | max texture ${webgl.maxTextureSize}`,
    ...gpuLines(report.gpu),
  ].join('\n');
}

function resultLine(benchmark: Benchmark): string {
  switch (benchmark.phase) {
    case 'calibrating':
      return 'reading the display rate';
    case 'searching':
      return `searching at ${refreshRateOf(benchmark.refreshIntervalMs)} Hz, ${formatCount(benchmark.holds)} triangles hold so far, trying ${formatCount(benchmark.triangles)}`;
    case 'finished':
      return `${benchmark.isCapped ? 'at least ' : ''}${formatCount(benchmark.holds)} triangles at ${refreshRateOf(benchmark.refreshIntervalMs)} Hz with no dropped frames`;
    default:
      return assertNever(benchmark);
  }
}

function gpuLines(gpu: GpuStatus): readonly string[] {
  switch (gpu.kind) {
    case 'pending':
      return ['WebGPU: starting'];
    case 'unavailable':
      return [`WebGPU: unavailable, ${gpu.failure.reason} ${gpu.failure.detail ?? ''}`.trimEnd()];
    case 'ready': {
      const { capabilities } = gpu;
      const features = featureSupportOf(capabilities);
      const named = (isSupported: boolean): string =>
        features
          .filter(feature => feature.isSupported === isSupported)
          .map(feature => feature.name)
          .join(', ');
      return [
        `WebGPU adapter: vendor "${capabilities.vendor}", architecture "${capabilities.architecture}", device "${capabilities.device}", description "${capabilities.description}"`,
        `Fallback adapter: ${capabilities.isFallback ?? 'unknown'}`,
        `Canvas format: ${capabilities.canvasFormat}`,
        `Features supported: ${named(true)}`,
        `Features missing: ${named(false)}`,
        'Limits:',
        ...capabilities.limits.map(limit => `  ${limit.name} = ${limit.value}`),
      ];
    }
    default:
      return assertNever(gpu);
  }
}
