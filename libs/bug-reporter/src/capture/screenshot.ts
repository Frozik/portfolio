import { isNil } from 'lodash-es';

import { CaptureError } from '../core/ports';
import { canvasToPng } from './canvas-png';

/** A stream that never decodes a frame (a tab that stopped painting) must not hang the reporter. */
const FIRST_FRAME_TIMEOUT_MS = 5_000;
const HAVE_CURRENT_DATA = 2;

const OFFSCREEN_VIDEO_CLASS = 'bug-reporter-offscreen';

/**
 * One pixel-exact frame of the captured tab as PNG: what the person sees,
 * canvases and all. The video element sits in the document, off screen:
 * browsers decode a capture stream for an element that takes part in
 * rendering, and the first decoded frame is awaited through `loadeddata`.
 */
export async function grabFrame(stream: MediaStream): Promise<Blob> {
  const video = document.createElement('video');
  video.className = OFFSCREEN_VIDEO_CLASS;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  document.body.append(video);
  try {
    await Promise.all([video.play(), firstFrame(video)]);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (isNil(context) || canvas.width === 0) {
      throw new CaptureError('failed');
    }
    context.drawImage(video, 0, 0);
    return await canvasToPng(canvas);
  } catch (error) {
    throw error instanceof CaptureError ? error : new CaptureError('failed', error);
  } finally {
    video.pause();
    video.srcObject = null;
    video.remove();
  }
}

function firstFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      video.removeEventListener('loadeddata', onLoaded);
      reject(new CaptureError('failed', new Error('no frame arrived from the captured tab')));
    }, FIRST_FRAME_TIMEOUT_MS);
    const onLoaded = () => {
      clearTimeout(timeout);
      resolve();
    };
    video.addEventListener('loadeddata', onLoaded, { once: true });
  });
}
