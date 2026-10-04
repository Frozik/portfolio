import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileSystemAccessSink } from './file-system-access';

function archiveOf(...chunks: readonly number[][]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach(chunk => controller.enqueue(new Uint8Array(chunk)));
      controller.close();
    },
  });
}

describe('FileSystemAccessSink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pipes the archive into the chosen file and reports progress as bytes land', async () => {
    const written: Uint8Array[] = [];
    const writable = new WritableStream<Uint8Array>({ write: chunk => void written.push(chunk) });
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockResolvedValue({ createWritable: () => Promise.resolve(writable) })
    );
    const progress: number[] = [];

    const outcome = await new FileSystemAccessSink().save('r.zip', archiveOf([1, 2], [3]), bytes =>
      progress.push(bytes)
    );

    expect(outcome).toBe('saved');
    expect(written.map(chunk => [...chunk])).toEqual([[1, 2], [3]]);
    expect(progress).toEqual([2, 3]);
  });

  it('treats a dismissed dialog as a cancellation, not a failure', async () => {
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'))
    );
    const outcome = await new FileSystemAccessSink().save('r.zip', archiveOf([1]), () => undefined);
    expect(outcome).toBe('cancelled');
  });
});
