import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { isNil } from 'lodash-es';

/**
 * CDN base URL for MediaPipe WASM + model assets. Locked to a specific
 * version so a silent upstream update cannot break the detector at
 * runtime; bump deliberately alongside `@mediapipe/tasks-vision`.
 */
const MEDIAPIPE_WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';

/** Public model bundle Google ships for FaceLandmarker. */
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const NUM_FACES = 1;

/**
 * Per-frame detection payload. `undefined` when:
 *   - another detection was still in flight (frame dropped), or
 *   - the detector ran but did not find a face, or
 *   - the detector reported an init/detect error (surfaced via `onError`).
 * Callers treat all three uniformly by hiding the glasses overlay and
 * resetting the emotion to neutral.
 */
export interface IFaceLandmarkerDetection {
  readonly landmarks: readonly NormalizedLandmark[];
  /**
   * 52 ARKit-style blendshape scores keyed by categoryName
   * (e.g. `'mouthSmileLeft' → 0.72`). Empty map if the detector is
   * configured without `outputFaceBlendshapes`.
   */
  readonly blendshapes: ReadonlyMap<string, number>;
}

export type TFaceLandmarkerDetectResult = IFaceLandmarkerDetection | undefined;

export interface IFaceLandmarkerClient {
  init(): Promise<void>;
  /**
   * Run face detection on `bitmap` for the given monotonic `timestamp`.
   * The caller retains ownership of `bitmap`: this method does NOT close
   * it on any code path. That contract lets the composer keep the same
   * bitmap around to paint as the output frame after detection finishes,
   * guaranteeing video pixels and glasses landmarks come from a single
   * snapshot.
   */
  detect(bitmap: ImageBitmap, timestamp: number): Promise<TFaceLandmarkerDetectResult>;
  dispose(): void;
}

export interface IFaceLandmarkerClientParams {
  /**
   * Optional observer for init / detect errors. The client already
   * returns `undefined` from `detect()` on errors — this hook exists so the
   * application layer can surface a toast / disable AR.
   */
  readonly onError?: (message: string) => void;
}

async function createLandmarker(delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> {
  const filesetResolver = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_URL);
  return FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: FACE_LANDMARKER_MODEL_URL,
      delegate,
    },
    runningMode: 'VIDEO',
    numFaces: NUM_FACES,
    outputFaceBlendshapes: true,
  });
}

/**
 * The MediaPipe GPU delegate is documented-broken on Android Chrome:
 * its WebGL path produces `texImage2D: no video` /
 * `GL_INVALID_FRAMEBUFFER_OPERATION` errors when binding live camera
 * frames, which corrupts the VIDEO-mode tracker's `NormalizedRect`
 * with NaNs and makes every subsequent `detectForVideo` throw
 * `ROI contains NaN values`. The CPU (XNNPACK) path takes a different
 * code path entirely and is the community-confirmed workaround. See
 * google-ai-edge/mediapipe issues #5190, #5908, #5100, #5152, #4711.
 *
 * A UA sniff is the right granularity here: GPU init "succeeds" on
 * Android — the failure shows up only at the first detect call — so a
 * try/catch fallback is too late (the landmarker is already wedged).
 * Recorded under "Known Architectural Debt" in CLAUDE.md; drop the sniff once
 * MediaPipe's GPU path works on Android.
 */
function shouldForceCpuDelegate(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Android/i.test(navigator.userAgent);
}

function pickDetection(result: FaceLandmarkerResult): IFaceLandmarkerDetection | undefined {
  const faces = result.faceLandmarks;
  if (faces.length === 0) {
    return undefined;
  }
  const firstFace = faces[0];
  if (isNil(firstFace) || firstFace.length === 0) {
    return undefined;
  }
  const blendshapeMap = new Map<string, number>();
  const firstBlendshapes = result.faceBlendshapes[0]?.categories ?? [];
  for (const category of firstBlendshapes) {
    blendshapeMap.set(category.categoryName, category.score);
  }
  return { landmarks: firstFace, blendshapes: blendshapeMap };
}

/**
 * Main-thread wrapper around MediaPipe `FaceLandmarker`.
 *
 * Runs on the main thread rather than a Web Worker because MediaPipe's
 * `tasks-vision` WASM loader does not compose reliably with Vite's
 * worker bundling pipeline (it emits `self.import(...)` at runtime,
 * which is not a function in either classic or module workers). The
 * detector uses its own internal GPU worker for the heavy work, so the
 * main-thread cost is limited to a ~5–10 ms `detectForVideo` blocking
 * call per detection on modern hardware — acceptable at 30 FPS and the
 * simplest shape compatible with the portfolio's dev + build setup.
 *
 * The wrapper enforces a single in-flight detection per client: a
 * `detect()` call made while another is still in flight resolves with
 * `undefined` immediately. The caller owns the `ImageBitmap` lifecycle on
 * every code path — see `IFaceLandmarkerClient.detect`.
 */
export function createFaceLandmarkerClient(
  params: IFaceLandmarkerClientParams = {}
): IFaceLandmarkerClient {
  let landmarker: FaceLandmarker | undefined;
  let isDisposed = false;
  let isProcessing = false;

  async function init(): Promise<void> {
    if (!isNil(landmarker) || isDisposed) {
      return;
    }
    try {
      landmarker = shouldForceCpuDelegate()
        ? await createLandmarker('CPU')
        : await createLandmarker('GPU').catch(() => createLandmarker('CPU'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'face-landmarker init failed';
      params.onError?.(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async function detect(
    bitmap: ImageBitmap,
    timestamp: number
  ): Promise<TFaceLandmarkerDetectResult> {
    if (isDisposed || isProcessing || isNil(landmarker)) {
      return undefined;
    }
    if (bitmap.width <= 0 || bitmap.height <= 0) {
      return undefined;
    }
    isProcessing = true;
    try {
      const result = landmarker.detectForVideo(bitmap, timestamp);
      return pickDetection(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'detect failed';
      params.onError?.(message);
      return undefined;
    } finally {
      isProcessing = false;
    }
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;
    landmarker?.close();
    landmarker = undefined;
  }

  return {
    init,
    detect,
    dispose,
  };
}
