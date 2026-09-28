import { isNil } from 'lodash-es';

import type { IChartFrameLayout } from '../../domain/frame-layout';
import { computeChartGrid } from '../../domain/grid-lines';

const MAX_GRID_LINES = 256;
const FLOATS_PER_GRID_LINE = 4;
const GRID_UNIFORM_FLOATS = 4;
const VERTICES_PER_GRID_LINE = 6;

/** Dashed grid lines of one chart, drawn before its series; uploaded only when the layout changes. */
export class GridLayer {
  private readonly uniformBuffer: GPUBuffer;
  private readonly linesBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;
  private readonly uniformData = new Float32Array(GRID_UNIFORM_FLOATS);
  private readonly linesData = new Float32Array(MAX_GRID_LINES * FLOATS_PER_GRID_LINE);
  private uploadedLayout: IChartFrameLayout | undefined;
  private lineCount = 0;

  constructor(
    private readonly device: GPUDevice,
    bindGroupLayout: GPUBindGroupLayout,
    private readonly pipeline: GPURenderPipeline
  ) {
    this.uniformBuffer = device.createBuffer({
      size: this.uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.linesBuffer = device.createBuffer({
      size: this.linesData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.linesBuffer } },
      ],
    });
  }

  update(layout: IChartFrameLayout | undefined): void {
    if (layout === this.uploadedLayout) {
      return;
    }
    this.uploadedLayout = layout;
    if (isNil(layout)) {
      this.lineCount = 0;
      return;
    }

    const grid = computeChartGrid(layout);
    this.lineCount = Math.min(grid.lines.length, MAX_GRID_LINES);
    if (this.lineCount === 0) {
      return;
    }

    for (let index = 0; index < this.lineCount; index++) {
      const line = grid.lines[index];
      const base = index * FLOATS_PER_GRID_LINE;
      this.linesData[base] = line.left;
      this.linesData[base + 1] = line.top;
      this.linesData[base + 2] = line.width;
      this.linesData[base + 3] = line.height;
    }
    this.uniformData[0] = layout.canvasWidth;
    this.uniformData[1] = layout.canvasHeight;
    this.uniformData[2] = grid.dashLength;
    this.uniformData[3] = grid.opacity;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
    this.device.queue.writeBuffer(
      this.linesBuffer,
      0,
      this.linesData,
      0,
      this.lineCount * FLOATS_PER_GRID_LINE
    );
  }

  render(pass: GPURenderPassEncoder): void {
    if (this.lineCount === 0) {
      return;
    }
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(VERTICES_PER_GRID_LINE, this.lineCount, 0, 0);
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.linesBuffer.destroy();
  }
}
