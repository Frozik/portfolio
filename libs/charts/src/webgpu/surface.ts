import { assert } from '@frozik/utils/assert/assert';
import type { MsaaTextureCache } from '@frozik/utils/webgpu/msaaTextureCache';
import { isNil } from 'lodash-es';

import type { IChartFrame } from '../core/frame/chart-frame';
import { channelsOf } from '../core/series/color';
import type { IPaintContribution, ISurface } from '../core/stage/backend';
import { PAINT_BAND } from '../core/stage/backend';
import type { IWebGpuPainter, IWebGpuPainterContext } from './painter';
import { isPainterFactory } from './painter';
import type { SeriesRenderer } from './series-renderer';

export interface ISurfaceOptions {
  readonly canvas: HTMLCanvasElement;
  readonly painters: IWebGpuPainterContext;
  readonly multisample: MsaaTextureCache;
  readonly series: SeriesRenderer;
  readonly contributions: readonly IPaintContribution[];
  /** The command encoder of the frame being drawn: every chart of the stage records into the same one. */
  readonly encoder: () => GPUCommandEncoder;
}

/** One chart's canvas on the shared device: its own context, its own data, the device's pipelines (§6.3). */
export class WebGpuSurface implements ISurface {
  private readonly context: GPUCanvasContext;
  private readonly below: readonly IWebGpuPainter[];
  private readonly above: readonly IWebGpuPainter[];

  constructor(private readonly options: ISurfaceOptions) {
    const context = options.canvas.getContext('webgpu');
    assert(!isNil(context), 'the canvas gave no WebGPU context');
    this.context = context;
    context.configure({
      device: options.painters.device,
      format: options.painters.format,
      alphaMode: 'opaque',
    });
    const ordered = [...options.contributions].sort((first, second) => first.band - second.band);
    const painterOf = (contribution: IPaintContribution): IWebGpuPainter => {
      assert(
        isPainterFactory(contribution.painter),
        `"${contribution.id}" carries no WebGPU painter`
      );
      return contribution.painter(options.painters);
    };
    this.below = ordered.filter(each => each.band < PAINT_BAND.series).map(painterOf);
    this.above = ordered.filter(each => each.band >= PAINT_BAND.series).map(painterOf);
  }

  paint(frame: IChartFrame<unknown>): void {
    const { canvas, series, multisample } = this.options;
    const { width, height } = frame.size;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    for (const painter of this.below) {
      painter.prepare(frame);
    }
    series.prepare(frame);
    for (const painter of this.above) {
      painter.prepare(frame);
    }

    const background = channelsOf(frame.theme.background);
    const pass = this.options.encoder().beginRenderPass({
      colorAttachments: [
        {
          view: multisample.acquireView(width, height),
          resolveTarget: this.context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: {
            r: background.red,
            g: background.green,
            b: background.blue,
            a: background.alpha,
          },
          storeOp: 'discard',
        },
      ],
    });
    for (const painter of this.below) {
      painter.draw(pass, frame);
    }
    series.draw(pass, frame);
    for (const painter of this.above) {
      painter.draw(pass, frame);
    }
    pass.end();
  }

  dispose(): void {
    for (const painter of [...this.below, ...this.above]) {
      painter.dispose();
    }
    this.options.series.dispose();
    this.context.unconfigure();
  }
}
