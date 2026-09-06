import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { TEmotion } from '../domain/emotion';
import type { TGlassesStyle } from '../domain/glasses-style';
import { DEFAULT_GLASSES_STYLE } from '../domain/glasses-style';
import type {
  IMediaStreamComposer,
  IMediaStreamComposerParams,
} from '../domain/ports/media-composer';
import { ArFramePipeline } from './ar-frame-pipeline';
import { createFaceLandmarkerClient } from './face-landmarker-client';
import { loadGlassesImages } from './glasses-painter';
import {
  attachOffscreen,
  createSourceVideo,
  createVideoFrameLoop,
  detachOffscreen,
  hasDecodedFrame,
} from './offscreen-media';

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  audio: true,
  video: { width: { ideal: 640 }, height: { ideal: 480 } },
};
const DEFAULT_CAPTURE_FPS = 30;
const FALLBACK_CANVAS_WIDTH_PX = 640;
const FALLBACK_CANVAS_HEIGHT_PX = 480;

function createOutputCanvas(source: HTMLVideoElement): {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = source.videoWidth > 0 ? source.videoWidth : FALLBACK_CANVAS_WIDTH_PX;
  canvas.height = source.videoHeight > 0 ? source.videoHeight : FALLBACK_CANVAS_HEIGHT_PX;
  attachOffscreen(canvas);
  const context = canvas.getContext('2d', { alpha: false });
  assert(!isNil(context), '2D canvas context unavailable');
  return { canvas, context };
}

/**
 * Acquires the local camera and microphone, composites glasses onto each video
 * frame and exposes a single `MediaStream` carrying the composited video track
 * plus the original audio track. The raw `getUserMedia` stream feeds an
 * off-screen `<video>`; a frame loop either paints it straight onto the output
 * canvas (AR off: zero-latency passthrough) or snapshots it into the AR
 * pipeline (`ar-frame-pipeline.ts`). `canvas.captureStream` exports the
 * canvas as the video track the remote peer receives — glasses included.
 *
 * Mute flips `MediaStreamTrack.enabled` on the OUTPUT tracks: the canvas keeps
 * drawing, but muted tracks carry silence / black frames on the wire without
 * an SDP renegotiation.
 */
export async function createMediaStreamComposer(
  params: IMediaStreamComposerParams
): Promise<IMediaStreamComposer> {
  const rawStream = await navigator.mediaDevices.getUserMedia(
    params.constraints ?? DEFAULT_CONSTRAINTS
  );
  const rawAudioTrack: MediaStreamTrack | undefined = rawStream.getAudioTracks()[0];
  assert(
    !isNil(rawStream.getVideoTracks()[0]),
    'composer requires a video track from getUserMedia'
  );

  const sourceVideo = await createSourceVideo(rawStream);
  const { canvas, context } = createOutputCanvas(sourceVideo);
  const glassesImages = await loadGlassesImages(params.glassesAssetUrls);

  const compositedStream = canvas.captureStream(params.targetFps ?? DEFAULT_CAPTURE_FPS);
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

  /** Detector failures leave the frame without glasses; `detect()` reports them as no detection. */
  const landmarker = createFaceLandmarkerClient();
  const pipeline = new ArFramePipeline({
    landmarker,
    canvas,
    context,
    glassesImages,
    readStyle: () => glassesStyle,
    onEmotionChange: emotion => emotionListeners.forEach(listener => listener(emotion)),
  });

  const frames = createVideoFrameLoop(sourceVideo, timestamp => {
    if (isDisposed) {
      return;
    }
    if (glassesStyle === 'none') {
      if (sourceVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        context.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);
      }
    } else if (hasDecodedFrame(sourceVideo)) {
      // Android can deliver a frame callback before the decoded queue has any
      // pixels; feeding the detector then produces a NaN ROI and wedges the
      // VIDEO-mode tracker for the rest of the session.
      void pipeline.capture(sourceVideo, timestamp);
    }
    frames.next();
  });

  // Without a detector the call still runs, on a plain passthrough video track.
  const isArAvailable = await landmarker.init().then(
    () => true,
    () => false
  );
  if (!isArAvailable) {
    glassesStyle = 'none';
  }
  frames.next();

  function setTrackEnabled(track: MediaStreamTrack | undefined, enabled: boolean): void {
    if (!isNil(track)) {
      track.enabled = enabled;
    }
  }

  function setAudioMuted(muted: boolean): void {
    if (isDisposed || isAudioMuted === muted) {
      return;
    }
    isAudioMuted = muted;
    setTrackEnabled(rawAudioTrack, !muted);
    muteListeners.forEach(listener => listener());
  }

  function setVideoMuted(muted: boolean): void {
    if (isDisposed || isVideoMuted === muted) {
      return;
    }
    isVideoMuted = muted;
    setTrackEnabled(outputVideoTrack, !muted);
    muteListeners.forEach(listener => listener());
  }

  function setGlassesStyle(nextStyle: TGlassesStyle): void {
    if (isDisposed || !isArAvailable || glassesStyle === nextStyle) {
      return;
    }
    glassesStyle = nextStyle;
    if (nextStyle === 'none') {
      pipeline.dropPending();
    }
    glassesStyleListeners.forEach(listener => listener());
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;
    frames.stop();
    pipeline.dispose();
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
      return pipeline.currentEmotion;
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
