import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { createBugReport } from '../testing/report-fixture';
import { createArchiveStream } from './create-archive-stream';

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

describe('createArchiveStream', () => {
  it('produces a zip another tool can open, with every entry intact', async () => {
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const report = createBugReport({
      comment: 'Totals disagree',
      attachments: [
        { kind: 'screenshot', id: 's1', image: new Blob([png], { type: 'image/png' }) },
      ],
    });

    const unzipped = unzipSync(await readAll(createArchiveStream(report)));

    expect(Object.keys(unzipped)).toEqual([
      'report.md',
      'report.json',
      'console.txt',
      'screenshots/1.png',
    ]);
    expect(strFromU8(unzipped['report.md'] ?? new Uint8Array())).toContain('Totals disagree');
    expect(JSON.parse(strFromU8(unzipped['report.json'] ?? new Uint8Array())).schemaVersion).toBe(
      1
    );
    expect(unzipped['screenshots/1.png']).toEqual(png);
  });
});
