import { isNil } from 'lodash-es';

/**
 * Max wait for the source's first decoded frame. A frozen camera never fires
 * `loadeddata`; on timeout the caller proceeds with fallback canvas dimensions
 * rather than hang.
 */
const FIRST_VIDEO_FRAME_TIMEOUT_MS = 5_000;
const OFFSCREEN_SIZE_PX = '1px';
const OFFSCREEN_OFFSET_PX = '-9999px';

/**
 * Safari and Firefox tie certain media APIs to elements that are actually
 * attached to the document: the raw `<video>` must be in the DOM to decode
 * frames reliably, and `HTMLCanvasElement.captureStream` has historically been
 * a no-op for detached canvases. Both helper nodes are attached off-screen
 * rather than left detached so the pipeline works in every target browser.
 */
export function attachOffscreen(element: HTMLElement): void {
  element.style.position = 'absolute';
  element.style.width = OFFSCREEN_SIZE_PX;
  element.style.height = OFFSCREEN_SIZE_PX;
  element.style.left = OFFSCREEN_OFFSET_PX;
  element.style.top = OFFSCREEN_OFFSET_PX;
  element.style.opacity = '0';
  element.style.pointerEvents = 'none';
  element.setAttribute('aria-hidden', 'true');
  document.body.appendChild(element);
}

export function detachOffscreen(element: HTMLElement): void {
  element.remove();
}

/** An off-screen `<video>` playing the stream, resolved once it has decoded a frame (or given up). */
export async function createSourceVideo(stream: MediaStream): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  attachOffscreen(video);
  await video.play();
  await waitForFirstVideoFrame(video);
  return video;
}

/** Whether the source has decoded pixels in both dimensions — what a detector may be fed. */
export function hasDecodedFrame(video: HTMLVideoElement): boolean {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
}

async function waitForFirstVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (hasDecodedFrame(video)) {
    return;
  }
  await new Promise<void>(resolve => {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const settle = (): void => {
      video.removeEventListener('loadeddata', settle);
      if (!isNil(timeoutHandle)) {
        clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }
      resolve();
    };
    video.addEventListener('loadeddata', settle);
    timeoutHandle = setTimeout(settle, FIRST_VIDEO_FRAME_TIMEOUT_MS);
  });
}

interface IRvfcCapableVideoElement extends HTMLVideoElement {
  requestVideoFrameCallback(
    callback: (now: number, metadata: VideoFrameCallbackMetadata) => void
  ): number;
  cancelVideoFrameCallback(handle: number): void;
}

function supportsRvfc(video: HTMLVideoElement): video is IRvfcCapableVideoElement {
  return (
    typeof (video as Partial<IRvfcCapableVideoElement>).requestVideoFrameCallback === 'function'
  );
}

export interface VideoFrameLoop {
  /** Asks for the next frame; the callback re-arms itself by calling `next` again. */
  next(): void;
  stop(): void;
}

/**
 * One callback per decoded video frame: `requestVideoFrameCallback` where the
 * browser has it, `requestAnimationFrame` as the Firefox fallback. The
 * timestamp handed on is the monotonic `now` (same clock as `performance.now()`),
 * not `metadata.mediaTime`, which stays at 0 for live `MediaStream` sources in
 * Firefox — using it would gate detection off forever there.
 */
export function createVideoFrameLoop(
  video: HTMLVideoElement,
  onFrame: (timestamp: number) => void
): VideoFrameLoop {
  let pendingHandle: number | undefined;
  const handleFrame = (timestamp: number): void => {
    pendingHandle = undefined;
    onFrame(timestamp);
  };

  return {
    next(): void {
      pendingHandle = supportsRvfc(video)
        ? video.requestVideoFrameCallback(handleFrame)
        : window.requestAnimationFrame(handleFrame);
    },
    stop(): void {
      if (isNil(pendingHandle)) {
        return;
      }
      if (supportsRvfc(video)) {
        video.cancelVideoFrameCallback(pendingHandle);
      } else {
        window.cancelAnimationFrame(pendingHandle);
      }
      pendingHandle = undefined;
    },
  };
}
