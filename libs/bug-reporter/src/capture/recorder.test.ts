import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordStream } from './recorder';

class FakeMediaRecorder extends EventTarget {
  static instances: FakeMediaRecorder[] = [];
  state: 'inactive' | 'recording' = 'inactive';

  constructor(
    readonly stream: unknown,
    readonly options: { mimeType: string }
  ) {
    super();
    FakeMediaRecorder.instances.push(this);
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.emitChunk(new Uint8Array([9]));
    this.dispatchEvent(new Event('stop'));
  }

  emitChunk(bytes: Uint8Array<ArrayBuffer>): void {
    const event = Object.assign(new Event('dataavailable'), { data: new Blob([bytes]) });
    this.dispatchEvent(event);
  }
}

const FORMAT = { mimeType: 'video/mp4', extension: 'mp4' } as const;

function createStream() {
  const track = new EventTarget();
  return { track, stream: { getVideoTracks: () => [track] } as unknown as MediaStream };
}

describe('recordStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    FakeMediaRecorder.instances = [];
  });

  it('joins the chunks in order into one file of the chosen format', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const handle = recordStream(createStream().stream, {
      format: FORMAT,
      maxDurationMs: 60_000,
      videoBitsPerSecond: 1,
    });
    const recorder = FakeMediaRecorder.instances[0];
    recorder?.emitChunk(new Uint8Array([1, 2]));
    recorder?.emitChunk(new Uint8Array([3]));

    handle.stop();
    const result = await handle.finished;

    expect(new Uint8Array(await result.video.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 9]));
    expect(result.video.type).toBe('video/mp4');
    expect(result.format).toEqual(FORMAT);
  });

  it('stops by itself at the duration limit', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const handle = recordStream(createStream().stream, {
      format: FORMAT,
      maxDurationMs: 5_000,
      videoBitsPerSecond: 1,
    });

    vi.advanceTimersByTime(5_000);

    expect(FakeMediaRecorder.instances[0]?.state).toBe('inactive');
    await expect(handle.finished).resolves.toMatchObject({ format: FORMAT });
  });

  it('finishes when the browser ends the track from its own stop-sharing control', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const { stream, track } = createStream();
    const handle = recordStream(stream, {
      format: FORMAT,
      maxDurationMs: 60_000,
      videoBitsPerSecond: 1,
    });

    track.dispatchEvent(new Event('ended'));

    await expect(handle.finished).resolves.toMatchObject({ format: FORMAT });
  });
});
