import { describe, expect, it } from 'vitest';

import { deferStream } from './defer-stream';

describe('deferStream', () => {
  it('opens the source only when the first chunk is read and passes every chunk through', async () => {
    let opened = 0;
    const stream = deferStream(async () => {
      opened += 1;
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          controller.enqueue(new Uint8Array([2, 3]));
          controller.close();
        },
      });
    });
    expect(opened).toBe(0);

    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());

    expect(opened).toBe(1);
    expect([...bytes]).toEqual([1, 2, 3]);
  });
});
