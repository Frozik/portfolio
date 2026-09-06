import { isNil } from 'lodash-es';
import {
  resolvePreviewLineStyle,
  resolvePreviewMarkerStyle,
} from '../../application/render/styled-scene';
import type { Vec3Array } from '../../domain/topology-types';

import type { DragPreviewState } from '../drag-connector-types';
import type { PreviewLine } from './drag-preview';
import { computeDragPreviewLine } from './drag-preview';
import {
  FLOATS_PER_STYLED_LINE,
  MARKER_INSTANCE_FLOATS,
  MARKER_INSTANCE_STRIDE,
  packPreviewLine,
  packPreviewMarker,
  STYLED_LINE_STRIDE,
} from './scene-instances';

const VERTEX_BUFFER_USAGE = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;

/** The three single-instance buffers of the drag preview: its line, start marker and snap marker. */
export class PreviewBuffers {
  readonly line: GPUBuffer;
  readonly startMarker: GPUBuffer;
  readonly snapMarker: GPUBuffer;
  private readonly lineStaging = new Float32Array(FLOATS_PER_STYLED_LINE);
  private readonly markerStaging = new Float32Array(MARKER_INSTANCE_FLOATS);
  private readonly lineStyle = resolvePreviewLineStyle();
  private readonly markerStyle = resolvePreviewMarkerStyle();
  /** The line as last resolved; nothing while no drag is in flight. */
  previewLine: PreviewLine | undefined = undefined;
  hasStartMarker = false;
  hasSnapTarget = false;

  constructor(private readonly device: GPUDevice) {
    this.line = device.createBuffer({ size: STYLED_LINE_STRIDE, usage: VERTEX_BUFFER_USAGE });
    this.startMarker = device.createBuffer({
      size: MARKER_INSTANCE_STRIDE,
      usage: VERTEX_BUFFER_USAGE,
    });
    this.snapMarker = device.createBuffer({
      size: MARKER_INSTANCE_STRIDE,
      usage: VERTEX_BUFFER_USAGE,
    });
  }

  writeLine({ pointA, pointB }: PreviewLine): void {
    packPreviewLine(this.lineStaging, pointA, pointB, this.lineStyle);
    this.device.queue.writeBuffer(this.line, 0, this.lineStaging);
  }

  writeStartMarker(position: Vec3Array): void {
    this.writeMarker(this.startMarker, position);
  }

  writeSnapMarker(position: Vec3Array): void {
    this.writeMarker(this.snapMarker, position);
  }

  /** `writeBuffer` copies synchronously, so one staging array serves both markers. */
  private writeMarker(buffer: GPUBuffer, position: Vec3Array): void {
    packPreviewMarker(this.markerStaging, position, this.markerStyle);
    this.device.queue.writeBuffer(buffer, 0, this.markerStaging);
  }

  /** Resolves the drag preview against the given unprojection and uploads its line and markers. */
  apply(
    preview: DragPreviewState | undefined,
    unproject: (screenX: number, screenY: number, reference: Vec3Array) => Vec3Array
  ): void {
    if (isNil(preview)) {
      this.previewLine = undefined;
      this.hasStartMarker = false;
      this.hasSnapTarget = false;
      return;
    }

    const previewLine = computeDragPreviewLine(preview, unproject);
    this.previewLine = previewLine;
    this.writeLine(previewLine);

    this.hasStartMarker = preview.kind === 'vertex';
    if (preview.kind === 'vertex') {
      this.writeStartMarker(preview.startPosition);
    }

    this.hasSnapTarget = !isNil(preview.snapTargetPosition);
    if (!isNil(preview.snapTargetPosition)) {
      this.writeSnapMarker(preview.snapTargetPosition);
    }
  }

  dispose(): void {
    this.line.destroy();
    this.startMarker.destroy();
    this.snapMarker.destroy();
  }
}
