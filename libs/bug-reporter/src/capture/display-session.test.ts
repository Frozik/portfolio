import { afterEach, describe, expect, it, vi } from 'vitest';

import { CaptureError } from '../core/ports';
import { DisplayCaptureSession } from './display-session';

interface IFakeTrack {
  readonly stop: ReturnType<typeof vi.fn>;
  readonly listeners: Map<string, () => void>;
  addEventListener(type: string, listener: () => void): void;
}

function createFakeStream() {
  const track: IFakeTrack = {
    stop: vi.fn(),
    listeners: new Map(),
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    },
  };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  return { stream, track };
}

function stubDisplayMedia(implementation: () => Promise<unknown>) {
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getDisplayMedia: implementation } });
}

describe('DisplayCaptureSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the browser once and shares the stream across captures', async () => {
    const { stream } = createFakeStream();
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    stubDisplayMedia(getDisplayMedia);
    const session = new DisplayCaptureSession({ maxFrameRate: 30 });

    const [first, second] = await Promise.all([session.acquire(), session.acquire()]);
    const third = await session.acquire();

    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(first).toBe(stream);
    expect(second).toBe(stream);
    expect(third).toBe(stream);
    expect(getDisplayMedia.mock.calls[0]?.[0]).toMatchObject({ preferCurrentTab: true });
  });

  it('reports a refused permission as denied, anything else as failed', async () => {
    stubDisplayMedia(() => Promise.reject(new DOMException('no', 'NotAllowedError')));
    const session = new DisplayCaptureSession({ maxFrameRate: 30 });
    await expect(session.acquire()).rejects.toMatchObject({ reason: 'denied' });

    stubDisplayMedia(() => Promise.reject(new Error('busy')));
    await expect(new DisplayCaptureSession({ maxFrameRate: 30 }).acquire()).rejects.toBeInstanceOf(
      CaptureError
    );
  });

  it('forgets the stream and notifies when the browser ends sharing', async () => {
    const { stream, track } = createFakeStream();
    stubDisplayMedia(() => Promise.resolve(stream));
    const session = new DisplayCaptureSession({ maxFrameRate: 30 });
    const ended = vi.fn();
    session.onEnded(ended);
    await session.acquire();

    track.listeners.get('ended')?.();

    expect(ended).toHaveBeenCalledTimes(1);
    expect(session.active).toBe(false);
  });

  it('stops a stream the picker hands over after the session was released', async () => {
    const { stream, track } = createFakeStream();
    let deliver: (stream: unknown) => void = () => undefined;
    stubDisplayMedia(
      () =>
        new Promise(resolve => {
          deliver = resolve;
        })
    );
    const session = new DisplayCaptureSession({ maxFrameRate: 30 });
    const pending = session.acquire();

    session.release();
    deliver(stream);

    await expect(pending).rejects.toMatchObject({ reason: 'ended' });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(session.active).toBe(false);
  });

  it('stops every track on release', async () => {
    const { stream, track } = createFakeStream();
    stubDisplayMedia(() => Promise.resolve(stream));
    const session = new DisplayCaptureSession({ maxFrameRate: 30 });
    await session.acquire();

    session.release();

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(session.active).toBe(false);
  });
});
