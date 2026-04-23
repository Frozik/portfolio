import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { isNil } from 'lodash-es';

/**
 * CDN base URL for MediaPipe WASM + model assets. Locked to a specific
 * version so a silent upstream update cannot break the detector at
 * runtime; bump deliberately alongside `@mediapipe/tasks-vision`.
 */
const MEDIAPIPE_WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';

/** Public model bundle Google ships for FaceLandmarker. */
const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const NUM_FACES = 1;

/**
 * Per-frame detection payload. `null` when:
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

export type TFaceLandmarkerDetectResult = IFaceLandmarkerDetection | null;

export interface IFaceLandmarkerClient {
  init(): Promise<void>;
  detect(
    bitmap: ImageBitmap,
    timestamp: number,
    videoWidth: number,
    videoHeight: number
  ): Promise<TFaceLandmarkerDetectResult>;
  dispose(): void;
}

export interface IFaceLandmarkerClientParams {
  /**
   * Optional observer for init / detect errors. The client already
   * returns `null` from `detect()` on errors — this hook exists so the
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

function pickDetection(result: FaceLandmarkerResult): IFaceLandmarkerDetection | null {
  const faces = result.faceLandmarks;
  if (faces.length === 0) {
    return null;
  }
  const firstFace = faces[0];
  if (isNil(firstFace) || firstFace.length === 0) {
    return null;
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
 * The wrapper enforces a single in-flight detection per client: if
 * `detect()` is called while another frame is being processed, the
 * incoming `ImageBitmap` is closed immediately and the call resolves
 * with `null`. Dropping a frame is always preferable to queueing and
 * amplifying latency.
 */
export function createFaceLandmarkerClient(
  params: IFaceLandmarkerClientParams = {}
): IFaceLandmarkerClient {
  let landmarker: FaceLandmarker | null = null;
  let isDisposed = false;
  let isProcessing = false;

  async function init(): Promise<void> {
    if (landmarker !== null || isDisposed) {
      return;
    }
    try {
      landmarker = await createLandmarker('GPU');
      return;
    } catch {
      // GPU delegate is unavailable on some devices; fall back to WASM.
    }
    try {
      landmarker = await createLandmarker('CPU');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'face-landmarker init failed';
      params.onError?.(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async function detect(
    bitmap: ImageBitmap,
    timestamp: number,
    videoWidth: number,
    videoHeight: number
  ): Promise<TFaceLandmarkerDetectResult> {
    if (isDisposed || isProcessing || landmarker === null) {
      bitmap.close();
      return null;
    }
    if (videoWidth <= 0 || videoHeight <= 0) {
      bitmap.close();
      return null;
    }
    isProcessing = true;
    try {
      const result = landmarker.detectForVideo(bitmap, timestamp);
      return pickDetection(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'detect failed';
      params.onError?.(message);
      return null;
    } finally {
      bitmap.close();
      isProcessing = false;
    }
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;
    if (landmarker !== null) {
      try {
        landmarker.close();
      } catch {
        // Already-closed landmarkers throw; safe to ignore during teardown.
      }
      landmarker = null;
    }
  }

  return {
    init,
    detect,
    dispose,
  };
}
