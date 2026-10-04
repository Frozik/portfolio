import { isNil } from 'lodash-es';

import { CaptureError } from '../core/ports';

const PNG = 'image/png';

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (isNil(blob) ? reject(new CaptureError('failed')) : resolve(blob)), PNG);
  });
}
