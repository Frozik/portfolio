import { assert } from '@frozik/utils/assert/assert';
import { MsaaTextureCache } from '@frozik/utils/webgpu/msaaTextureCache';
import { isNil } from 'lodash-es';

import type {
  IPaintContribution,
  IRenderBackend,
  ISurface,
  ISurfaceRole,
} from '../core/stage/backend';
import type { IWebGpuPainterContext } from './painter';
import { WEBGPU_BACKEND } from './painter';
import { SeriesPipeline } from './series-pipeline';
import { SeriesRenderer } from './series-renderer';
import { WebGpuSurface } from './surface';

const DEFAULT_SAMPLE_COUNT = 4;

export interface IWebGpuBackendOptions {
  /** A device to draw with; without one the backend requests its own and destroys it when disposed. */
  readonly device?: GPUDevice;
  readonly sampleCount?: number;
  readonly texture?: {
    /** The ceiling of one chart's data texture, in rows of 2048 texels (§4.7). */
    readonly maxRows?: number;
  };
}

async function requestDevice(): Promise<GPUDevice> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');
  const adapter = await navigator.gpu.requestAdapter();
  assert(!isNil(adapter), 'no WebGPU adapter is available');
  return adapter.requestDevice();
}

/** One device, one series pipeline and one command encoder a frame for every chart of the stage (§6.3). */
export async function webgpu(options: IWebGpuBackendOptions = {}): Promise<WebGpuBackend> {
  const device = options.device ?? (await requestDevice());
  return new WebGpuBackend(device, isNil(options.device), options);
}

export class WebGpuBackend implements IRenderBackend {
  readonly id = WEBGPU_BACKEND;
  /** Settles if the device is lost while the backend is alive. */
  readonly lost: Promise<string>;

  private readonly format: GPUTextureFormat;
  private readonly sampleCount: number;
  private readonly multisample: MsaaTextureCache;
  private readonly pipeline: SeriesPipeline;
  private readonly sharedResources = new Map<string, unknown>();
  private readonly painterContext: IWebGpuPainterContext;
  private encoder: GPUCommandEncoder | undefined;

  constructor(
    private readonly device: GPUDevice,
    private readonly ownsDevice: boolean,
    private readonly options: IWebGpuBackendOptions
  ) {
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.sampleCount = options.sampleCount ?? DEFAULT_SAMPLE_COUNT;
    this.multisample = new MsaaTextureCache(device, this.format, this.sampleCount);
    this.pipeline = new SeriesPipeline(device, this.format, this.sampleCount);
    this.painterContext = {
      device,
      format: this.format,
      sampleCount: this.sampleCount,
      shared: (key, create) => this.shared(key, create),
    };
    this.lost = device.lost.then(info => info.message);
  }

  createSurface(
    canvas: unknown,
    contributions: readonly IPaintContribution[],
    role: ISurfaceRole
  ): ISurface {
    assert(canvas instanceof HTMLCanvasElement, 'the WebGPU backend draws into a canvas element');
    assert(role.drawsSeries, 'the WebGPU canvas is opaque: it is the bottom of a stack');
    return new WebGpuSurface({
      canvas,
      painters: this.painterContext,
      multisample: this.multisample,
      series: new SeriesRenderer({
        device: this.device,
        pipeline: this.pipeline,
        maxTextureRows: this.options.texture?.maxRows,
      }),
      contributions,
      encoder: () => {
        assert(!isNil(this.encoder), 'a surface is painted between beginFrame and endFrame');
        return this.encoder;
      },
    });
  }

  beginFrame(): void {
    this.encoder = this.device.createCommandEncoder();
  }

  /** Every chart recorded into the one encoder: the whole stage goes to the GPU as a single submission. */
  endFrame(): void {
    if (!isNil(this.encoder)) {
      this.device.queue.submit([this.encoder.finish()]);
      this.encoder = undefined;
    }
    this.multisample.sweepUnused();
  }

  dispose(): void {
    this.multisample.dispose();
    this.sharedResources.clear();
    if (this.ownsDevice) {
      this.device.destroy();
    }
  }

  private shared<TResource>(key: string, create: () => TResource): TResource {
    if (!this.sharedResources.has(key)) {
      this.sharedResources.set(key, create());
    }
    return this.sharedResources.get(key) as TResource;
  }
}
