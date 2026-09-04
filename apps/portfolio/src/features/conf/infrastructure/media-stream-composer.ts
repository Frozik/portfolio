import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import { GLASSES_BASE_WIDTH_PX } from '../domain/constants';
import type { TEmotion } from '../domain/emotion';
import { classifyEmotion } from '../domain/emotion';
import type { GlassesAssetUrls, TGlassesStyle } from '../domain/glasses-style';
import { DEFAULT_GLASSES_STYLE } from '../domain/glasses-style';
import { computeGlassesTransform } from '../domain/glasses-transform';
import type {
  IMediaStreamComposer,
  IMediaStreamComposerParams,
} from '../domain/ports/media-composer';
import type { IFaceLandmarkerClient } from './face-landmarker-client';
import { createFaceLandmarkerClient } from './face-landmarker-client';

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  audio: true,
  video: { width: { ideal: 640 }, height: { ideal: 480 } },
};

const DEFAULT_CAPTURE_FPS = 30;
const GLASSES_INTRINSIC_WIDTH_PX = GLASSES_BASE_WIDTH_PX;
/**
 * Fallback intrinsic dimensions used when an image's `naturalWidth` /
 * `naturalHeight` are unavailable. Every bundled SVG declares explicit
 * `width` / `height` attributes so this should not trigger in practice.
 */
const FALLBACK_INTRINSIC_HEIGHT_PX = 80;
const GLASSES_SIZE_MULTIPLIER = 2;
const GLASSES_DRAW_WIDTH_PX = GLASSES_INTRINSIC_WIDTH_PX * GLASSES_SIZE_MULTIPLIER;
const FALLBACK_CANVAS_WIDTH_PX = 640;
const FALLBACK_CANVAS_HEIGHT_PX = 480;
const RAD_PER_DEG = Math.PI / 180;

/**
 * Max wait for the source's first decoded frame. A frozen camera never fires
 * `loadeddata`; on timeout we proceed with fallback canvas dims rather than hang.
 */
const FIRST_VIDEO_FRAME_TIMEOUT_MS = 5_000;

/**
 * Hysteresis for the emotion label so it doesn't flicker on every
 * detection: a new classification must appear on this many consecutive
 * detections before it replaces the committed emotion. With a ~30 Hz
 * detection cadence, 2 consecutive ≈ 66 ms — imperceptible latency.
 */
const EMOTION_COMMIT_THRESHOLD = 2;

/**
 * Safari and Firefox tie certain media APIs to elements that are
 * actually attached to the document: the raw `<video>` must be in the
 * DOM to decode frames reliably, and `HTMLCanvasElement.captureStream`
 * has historically been a no-op for detached canvases. We attach both
 * helper nodes off-screen rather than detached so the pipeline works
 * in every target browser.
 */
function attachOffscreen(element: HTMLElement): void {
  element.style.position = 'absolute';
  element.style.width = '1px';
  element.style.height = '1px';
  element.style.left = '-9999px';
  element.style.top = '-9999px';
  element.style.opacity = '0';
  element.style.pointerEvents = 'none';
  element.setAttribute('aria-hidden', 'true');
  document.body.appendChild(element);
}

function detachOffscreen(element: HTMLElement): void {
  element.remove();
}

function loadGlassesImages(
  assetUrls: GlassesAssetUrls
): Readonly<Record<Exclude<TGlassesStyle, 'none'>, HTMLImageElement>> {
  const load = (url: string): HTMLImageElement => {
    const image = new Image();
    image.src = url;
    return image;
  };
  return {
    round: load(assetUrls.round),
    hippie: load(assetUrls.hippie),
    teacher: load(assetUrls.teacher),
  };
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

async function waitForFirstVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
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

/**
 * Acquire the local camera + microphone, composite glasses onto each
 * video frame, and expose a single `MediaStream` that carries the
 * composited video track plus the original audio track.
 *
 * Architecture:
 *  - The raw `getUserMedia` stream feeds an off-DOM `<video>` element.
 *  - A frame loop (`requestVideoFrameCallback` with `requestAnimationFrame`
 *    fallback for Firefox) snapshots the live video into an
 *    `ImageBitmap` and feeds it into the AR pipeline.
 *  - The AR pipeline runs face detection on the snapshot, then paints
 *    the SAME snapshot onto the output canvas with the glasses sprite
 *    overlaid using a 2D affine transform from the snapshot's
 *    eye-corner landmarks. Locking video pixels and glasses to the
 *    same snapshot is what keeps the overlay rigidly attached — there
 *    is no chase between detection and display because both come from
 *    one frame.
 *  - The detector is single-flight. Snapshots taken while detection is
 *    busy are coalesced: the most recent unprocessed bitmap wins; older
 *    pending snapshots are closed and discarded. As soon as the current
 *    detection resolves, the freshest pending snapshot enters the
 *    pipeline. Output framerate therefore matches the detector's
 *    throughput (typically 30 Hz on GPU) at the cost of ~10–30 ms of
 *    output latency vs. the live camera — imperceptible on a call,
 *    indispensable for rigid glasses lock.
 *  - When AR is disabled the pipeline is bypassed entirely: each
 *    `requestVideoFrameCallback` paints `sourceVideo` straight onto the
 *    output canvas, restoring zero-latency passthrough.
 *  - `canvas.captureStream(targetFps)` exports the composited canvas as
 *    a `MediaStream.videoTrack`; the audio track from the raw stream is
 *    attached alongside so the result can be fed directly into an
 *    `RTCPeerConnection`. The remote peer receives a video track that
 *    already contains the glasses.
 *
 * Mute semantics flip `MediaStreamTrack.enabled` on the OUTPUT tracks:
 * the canvas keeps drawing, but muted tracks carry silence / black
 * frames on the wire without requiring SDP renegotiation.
 */
export async function createMediaStreamComposer(
  params: IMediaStreamComposerParams
): Promise<IMediaStreamComposer> {
  const constraints = params.constraints ?? DEFAULT_CONSTRAINTS;
  const targetFps = params.targetFps ?? DEFAULT_CAPTURE_FPS;

  const rawStream = await navigator.mediaDevices.getUserMedia(constraints);
  const rawAudioTrack: MediaStreamTrack | undefined = rawStream.getAudioTracks()[0];
  const rawVideoTrack: MediaStreamTrack | undefined = rawStream.getVideoTracks()[0];
  assert(!isNil(rawVideoTrack), 'composer requires a video track from getUserMedia');

  const sourceVideo = document.createElement('video');
  sourceVideo.srcObject = rawStream;
  sourceVideo.muted = true;
  sourceVideo.playsInline = true;
  sourceVideo.autoplay = true;
  attachOffscreen(sourceVideo);
  await sourceVideo.play();
  await waitForFirstVideoFrame(sourceVideo);

  const canvasWidth =
    sourceVideo.videoWidth > 0 ? sourceVideo.videoWidth : FALLBACK_CANVAS_WIDTH_PX;
  const canvasHeight =
    sourceVideo.videoHeight > 0 ? sourceVideo.videoHeight : FALLBACK_CANVAS_HEIGHT_PX;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  attachOffscreen(canvas);
  const rawContext = canvas.getContext('2d', { alpha: false });
  assert(!isNil(rawContext), '2D canvas context unavailable');
  const context: CanvasRenderingContext2D = rawContext;

  // Load every non-`none` style's SVG up-front so flipping the picker
  // is a no-op in the paint loop. `decode()` failures are non-fatal —
  // `drawImage` still works against a loaded (but undecoded) image as
  // long as the root SVG declares explicit width/height.
  const glassesImages = loadGlassesImages(params.glassesAssetUrls);
  await Promise.all(
    Object.values(glassesImages).map(image => image.decode().catch(() => undefined))
  );

  const compositedStream = canvas.captureStream(targetFps);
  if (!isNil(rawAudioTrack)) {
    compositedStream.addTrack(rawAudioTrack);
  }
  const outputVideoTrack: MediaStreamTrack | undefined = compositedStream.getVideoTracks()[0];

  const muteListeners = new Set<() => void>();
  const glassesStyleListeners = new Set<() => void>();
  const emotionListeners = new Set<(emotion: TEmotion) => void>();
  let isAudioMuted = false;
  let isVideoMuted = false;
  let glassesStyle: TGlassesStyle = DEFAULT_GLASSES_STYLE;
  let isDisposed = false;

  let isProcessing = false;
  let pendingBitmap: ImageBitmap | undefined;
  let pendingBitmapTimestamp = 0;
  let pendingFrameHandle: number | undefined;

  let committedEmotion: TEmotion = 'neutral';
  let candidateEmotion: TEmotion | undefined;
  let candidateEmotionCount = 0;

  function releasePendingBitmap(): void {
    if (isNil(pendingBitmap)) {
      return;
    }
    pendingBitmap.close();
    pendingBitmap = undefined;
    pendingBitmapTimestamp = 0;
  }

  function notifyEmotion(emotion: TEmotion): void {
    emotionListeners.forEach(listener => listener(emotion));
  }

  function observeEmotion(nextEmotion: TEmotion): void {
    if (nextEmotion === committedEmotion) {
      candidateEmotion = undefined;
      candidateEmotionCount = 0;
      return;
    }
    if (candidateEmotion === nextEmotion) {
      candidateEmotionCount += 1;
    } else {
      candidateEmotion = nextEmotion;
      candidateEmotionCount = 1;
    }
    if (candidateEmotionCount >= EMOTION_COMMIT_THRESHOLD) {
      committedEmotion = nextEmotion;
      candidateEmotion = undefined;
      candidateEmotionCount = 0;
      notifyEmotion(committedEmotion);
    }
  }

  /** Detector failures leave the frame without glasses; `detect()` reports them as no detection. */
  const landmarker: IFaceLandmarkerClient = createFaceLandmarkerClient();

  function notifyMute(): void {
    muteListeners.forEach(listener => listener());
  }
  function notifyGlassesStyle(): void {
    glassesStyleListeners.forEach(listener => listener());
  }

  function applyOutputTrackEnabled(track: MediaStreamTrack | undefined, enabled: boolean): void {
    if (!isNil(track)) {
      track.enabled = enabled;
    }
  }

  function paintPassthrough(): void {
    if (sourceVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
  }

  async function processBitmap(bitmap: ImageBitmap, timestamp: number): Promise<void> {
    isProcessing = true;
    try {
      const detection = await landmarker.detect(bitmap, timestamp);
      if (isDisposed || glassesStyle === 'none') {
        return;
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (isNil(detection)) {
        observeEmotion('neutral');
        return;
      }
      observeEmotion(classifyEmotion(detection.blendshapes));
      const transform = computeGlassesTransform(detection.landmarks, {
        width: canvas.width,
        height: canvas.height,
      });
      if (isNil(transform)) {
        return;
      }
      // Each style's SVG declares its own intrinsic aspect: round and
      // teacher are 240x80 (3:1) but hippie is 240x160 (3:2) so the
      // 2x-larger stars fit without clipping. Deriving the destination
      // height from `naturalHeight / naturalWidth` keeps lens centres
      // on the pupil line for every style without per-style branching.
      const styledImage = glassesImages[glassesStyle];
      const naturalWidth =
        styledImage.naturalWidth > 0 ? styledImage.naturalWidth : GLASSES_INTRINSIC_WIDTH_PX;
      const naturalHeight =
        styledImage.naturalHeight > 0 ? styledImage.naturalHeight : FALLBACK_INTRINSIC_HEIGHT_PX;
      const drawHeight = (GLASSES_DRAW_WIDTH_PX * naturalHeight) / naturalWidth;
      context.save();
      context.translate(transform.translateX, transform.translateY);
      context.rotate(transform.rotateDeg * RAD_PER_DEG);
      context.scale(transform.scaleX, transform.scaleY);
      context.drawImage(
        styledImage,
        -GLASSES_DRAW_WIDTH_PX / 2,
        -drawHeight / 2,
        GLASSES_DRAW_WIDTH_PX,
        drawHeight
      );
      context.restore();
    } finally {
      bitmap.close();
      isProcessing = false;
      // The most recent snapshot taken while we were busy enters the
      // pipeline immediately — that is what keeps the output as fresh
      // as the detector allows. If AR was switched off mid-flight the
      // fast path is already in charge, so drop the pending snapshot.
      if (!isNil(pendingBitmap) && !isDisposed && glassesStyle !== 'none') {
        const nextBitmap = pendingBitmap;
        const nextTimestamp = pendingBitmapTimestamp;
        pendingBitmap = undefined;
        pendingBitmapTimestamp = 0;
        void processBitmap(nextBitmap, nextTimestamp);
      } else {
        releasePendingBitmap();
      }
    }
  }

  async function captureAndQueue(timestamp: number): Promise<void> {
    // `createImageBitmap` rejects while the source has no decoded frame yet; the next tick retries.
    const bitmap = await createImageBitmap(sourceVideo).catch(() => undefined);
    if (isNil(bitmap)) {
      return;
    }
    if (isDisposed || glassesStyle === 'none') {
      bitmap.close();
      return;
    }
    if (isProcessing) {
      // Replace any older pending snapshot — newest frame wins so the
      // pipeline always wakes up on the freshest pixels.
      releasePendingBitmap();
      pendingBitmap = bitmap;
      pendingBitmapTimestamp = timestamp;
      return;
    }
    void processBitmap(bitmap, timestamp);
  }

  function onVideoFrame(timestamp: number): void {
    pendingFrameHandle = undefined;
    if (isDisposed) {
      return;
    }
    if (glassesStyle === 'none') {
      paintPassthrough();
      scheduleNextFrame();
      return;
    }
    // Android can deliver a `requestVideoFrameCallback` tick before the
    // decoded frame queue has any pixels (`videoWidth === 0`), at which
    // point feeding `detectForVideo` immediately produces a NaN ROI and
    // wedges the VIDEO-mode tracker for the rest of the session. Defer
    // detection until the source is ready in *both* dimensions.
    if (
      sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      sourceVideo.videoWidth > 0 &&
      sourceVideo.videoHeight > 0
    ) {
      void captureAndQueue(timestamp);
    }
    scheduleNextFrame();
  }

  function scheduleNextFrame(): void {
    if (isDisposed) {
      return;
    }
    if (supportsRvfc(sourceVideo)) {
      // `now` is a monotonic DOMHighResTimeStamp (same clock as
      // `performance.now()`), unlike `metadata.mediaTime` which stays
      // at 0 for live `MediaStream` sources in Firefox — using
      // mediaTime would gate detection off forever there.
      pendingFrameHandle = sourceVideo.requestVideoFrameCallback(onVideoFrame);
      return;
    }
    pendingFrameHandle = window.requestAnimationFrame(onVideoFrame);
  }

  function cancelScheduledFrame(): void {
    if (isNil(pendingFrameHandle)) {
      return;
    }
    if (supportsRvfc(sourceVideo)) {
      sourceVideo.cancelVideoFrameCallback(pendingFrameHandle);
    } else {
      window.cancelAnimationFrame(pendingFrameHandle);
    }
    pendingFrameHandle = undefined;
  }

  // Without a detector the call still runs, on a plain passthrough video track.
  const isArAvailable = await landmarker.init().then(
    () => true,
    () => false
  );
  if (!isArAvailable) {
    glassesStyle = 'none';
  }
  scheduleNextFrame();

  function setAudioMuted(muted: boolean): void {
    if (isDisposed || isAudioMuted === muted) {
      return;
    }
    isAudioMuted = muted;
    applyOutputTrackEnabled(rawAudioTrack, !muted);
    notifyMute();
  }

  function setVideoMuted(muted: boolean): void {
    if (isDisposed || isVideoMuted === muted) {
      return;
    }
    isVideoMuted = muted;
    applyOutputTrackEnabled(outputVideoTrack, !muted);
    notifyMute();
  }

  function setGlassesStyle(nextStyle: TGlassesStyle): void {
    if (isDisposed || !isArAvailable || glassesStyle === nextStyle) {
      return;
    }
    const wasEnabled = glassesStyle !== 'none';
    glassesStyle = nextStyle;
    if (nextStyle === 'none' && wasEnabled) {
      // Drop any pending snapshot so we don't paint a stale frame from
      // the AR pipeline over the live passthrough that takes over now.
      releasePendingBitmap();
    }
    notifyGlassesStyle();
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;
    cancelScheduledFrame();
    releasePendingBitmap();
    landmarker.dispose();
    sourceVideo.pause();
    sourceVideo.srcObject = null;
    detachOffscreen(sourceVideo);
    detachOffscreen(canvas);
    for (const track of [...rawStream.getTracks(), ...compositedStream.getTracks()]) {
      track.stop();
    }
    muteListeners.clear();
    glassesStyleListeners.clear();
    emotionListeners.clear();
  }

  return {
    stream: compositedStream,
    get isAudioMuted() {
      return isAudioMuted;
    },
    get isVideoMuted() {
      return isVideoMuted;
    },
    get glassesStyle() {
      return glassesStyle;
    },
    get currentEmotion() {
      return committedEmotion;
    },
    onMuteStateChange(listener) {
      muteListeners.add(listener);
      return () => {
        muteListeners.delete(listener);
      };
    },
    onGlassesStyleChange(listener) {
      glassesStyleListeners.add(listener);
      return () => {
        glassesStyleListeners.delete(listener);
      };
    },
    onEmotionChange(listener) {
      emotionListeners.add(listener);
      return () => {
        emotionListeners.delete(listener);
      };
    },
    setAudioMuted,
    setVideoMuted,
    setGlassesStyle,
    dispose,
  };
}
