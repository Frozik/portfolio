/**
 * Coarse emotion labels derived from MediaPipe face-blendshape scores.
 * Kept to five buckets (plus neutral) because blendshape-based heuristics
 * cannot reliably disambiguate finer distinctions in real-time webcam
 * footage — over-splitting produces noisy emoji flicker.
 */
export type TEmotion = 'happy' | 'surprised' | 'sad' | 'angry' | 'neutral';

/**
 * Subset of the 52 ARKit-style blendshapes that the emotion classifier
 * actually reads. Listed as constants so typos surface at compile time
 * and the set of inputs is auditable at a glance.
 */
export const BLENDSHAPE_MOUTH_SMILE_LEFT = 'mouthSmileLeft';
export const BLENDSHAPE_MOUTH_SMILE_RIGHT = 'mouthSmileRight';
export const BLENDSHAPE_MOUTH_FROWN_LEFT = 'mouthFrownLeft';
export const BLENDSHAPE_MOUTH_FROWN_RIGHT = 'mouthFrownRight';
export const BLENDSHAPE_JAW_OPEN = 'jawOpen';
export const BLENDSHAPE_EYE_WIDE_LEFT = 'eyeWideLeft';
export const BLENDSHAPE_EYE_WIDE_RIGHT = 'eyeWideRight';
export const BLENDSHAPE_BROW_INNER_UP = 'browInnerUp';
export const BLENDSHAPE_BROW_DOWN_LEFT = 'browDownLeft';
export const BLENDSHAPE_BROW_DOWN_RIGHT = 'browDownRight';
export const BLENDSHAPE_NOSE_SNEER_LEFT = 'noseSneerLeft';

/**
 * Per-emotion activation thresholds. Each emotion is triggered by a
 * weighted sum of blendshape scores crossing its threshold; when
 * multiple trigger simultaneously the classifier picks the one with
 * the largest excess over its threshold.
 */
export const EMOTION_HAPPY_THRESHOLD = 0.6;
export const EMOTION_SURPRISED_THRESHOLD = 1.5;
export const EMOTION_SAD_THRESHOLD = 1.2;
export const EMOTION_ANGRY_THRESHOLD = 1.2;

const EYE_WIDE_AVERAGE_DIVISOR = 2;

interface IEmotionCandidate {
  readonly emotion: TEmotion;
  readonly excess: number;
}

function readScore(scores: ReadonlyMap<string, number>, name: string): number {
  return scores.get(name) ?? 0;
}

/**
 * Classify a facial expression from MediaPipe FaceLandmarker blendshape
 * scores. Pure function — no MediaPipe / React / DOM imports.
 *
 * Algorithm:
 *  1. For each emotion compute `score - threshold` where `score` is a
 *     small linear combination of blendshapes (see below).
 *  2. Pick the emotion with the largest positive excess. If none is
 *     positive, return `'neutral'`.
 *
 * Weighted sums:
 *  - happy     = mouthSmileLeft + mouthSmileRight
 *  - surprised = jawOpen + avg(eyeWideLeft, eyeWideRight) + browInnerUp
 *  - sad       = mouthFrownLeft + mouthFrownRight + browDownLeft
 *  - angry     = browDownLeft + browDownRight + noseSneerLeft
 *
 * The max-excess tie-break means a genuine smile wins over a simultaneous
 * mild frown, and vice versa, instead of the classifier locking to whatever
 * emotion was listed first.
 */
export function classifyEmotion(scores: ReadonlyMap<string, number>): TEmotion {
  const happyRaw =
    readScore(scores, BLENDSHAPE_MOUTH_SMILE_LEFT) +
    readScore(scores, BLENDSHAPE_MOUTH_SMILE_RIGHT);

  const eyeWideAverage =
    (readScore(scores, BLENDSHAPE_EYE_WIDE_LEFT) + readScore(scores, BLENDSHAPE_EYE_WIDE_RIGHT)) /
    EYE_WIDE_AVERAGE_DIVISOR;
  const surprisedRaw =
    readScore(scores, BLENDSHAPE_JAW_OPEN) +
    eyeWideAverage +
    readScore(scores, BLENDSHAPE_BROW_INNER_UP);

  const sadRaw =
    readScore(scores, BLENDSHAPE_MOUTH_FROWN_LEFT) +
    readScore(scores, BLENDSHAPE_MOUTH_FROWN_RIGHT) +
    readScore(scores, BLENDSHAPE_BROW_DOWN_LEFT);

  const angryRaw =
    readScore(scores, BLENDSHAPE_BROW_DOWN_LEFT) +
    readScore(scores, BLENDSHAPE_BROW_DOWN_RIGHT) +
    readScore(scores, BLENDSHAPE_NOSE_SNEER_LEFT);

  const candidates: readonly IEmotionCandidate[] = [
    { emotion: 'happy', excess: happyRaw - EMOTION_HAPPY_THRESHOLD },
    { emotion: 'surprised', excess: surprisedRaw - EMOTION_SURPRISED_THRESHOLD },
    { emotion: 'sad', excess: sadRaw - EMOTION_SAD_THRESHOLD },
    { emotion: 'angry', excess: angryRaw - EMOTION_ANGRY_THRESHOLD },
  ];

  let bestEmotion: TEmotion = 'neutral';
  let bestExcess = 0;
  for (const candidate of candidates) {
    if (candidate.excess > bestExcess) {
      bestExcess = candidate.excess;
      bestEmotion = candidate.emotion;
    }
  }
  return bestEmotion;
}

/** Map each emotion to a single presentation emoji for canvas rendering. */
export function emotionToEmoji(emotion: TEmotion): string {
  switch (emotion) {
    case 'happy':
      return '😊';
    case 'surprised':
      return '😮';
    case 'sad':
      return '😢';
    case 'angry':
      return '😠';
    case 'neutral':
      return '😐';
  }
}
