import { describe, expect, it } from 'vitest';
import {
  BLENDSHAPE_BROW_DOWN_LEFT,
  BLENDSHAPE_BROW_DOWN_RIGHT,
  BLENDSHAPE_BROW_INNER_UP,
  BLENDSHAPE_EYE_WIDE_LEFT,
  BLENDSHAPE_EYE_WIDE_RIGHT,
  BLENDSHAPE_JAW_OPEN,
  BLENDSHAPE_MOUTH_FROWN_LEFT,
  BLENDSHAPE_MOUTH_FROWN_RIGHT,
  BLENDSHAPE_MOUTH_SMILE_LEFT,
  BLENDSHAPE_MOUTH_SMILE_RIGHT,
  BLENDSHAPE_NOSE_SNEER_LEFT,
  classifyEmotion,
  emotionToEmoji,
} from './emotion';

function scoreMap(pairs: readonly (readonly [string, number])[]): ReadonlyMap<string, number> {
  return new Map(pairs);
}

describe('classifyEmotion', () => {
  it('returns neutral for an empty score map', () => {
    expect(classifyEmotion(new Map())).toBe('neutral');
  });

  it('returns neutral when every cue sits below its threshold', () => {
    const scores = scoreMap([
      [BLENDSHAPE_MOUTH_SMILE_LEFT, 0.2],
      [BLENDSHAPE_MOUTH_SMILE_RIGHT, 0.2],
      [BLENDSHAPE_JAW_OPEN, 0.3],
      [BLENDSHAPE_BROW_DOWN_LEFT, 0.3],
    ]);
    expect(classifyEmotion(scores)).toBe('neutral');
  });

  it('classifies a clear smile as happy', () => {
    const scores = scoreMap([
      [BLENDSHAPE_MOUTH_SMILE_LEFT, 0.5],
      [BLENDSHAPE_MOUTH_SMILE_RIGHT, 0.5],
    ]);
    expect(classifyEmotion(scores)).toBe('happy');
  });

  it('classifies open jaw with wide eyes and raised inner brows as surprised', () => {
    const scores = scoreMap([
      [BLENDSHAPE_JAW_OPEN, 0.7],
      [BLENDSHAPE_EYE_WIDE_LEFT, 0.8],
      [BLENDSHAPE_EYE_WIDE_RIGHT, 0.8],
      [BLENDSHAPE_BROW_INNER_UP, 0.6],
    ]);
    expect(classifyEmotion(scores)).toBe('surprised');
  });

  it('classifies frowning mouth plus brow-down as sad', () => {
    const scores = scoreMap([
      [BLENDSHAPE_MOUTH_FROWN_LEFT, 0.5],
      [BLENDSHAPE_MOUTH_FROWN_RIGHT, 0.5],
      [BLENDSHAPE_BROW_DOWN_LEFT, 0.5],
    ]);
    expect(classifyEmotion(scores)).toBe('sad');
  });

  it('classifies furrowed brow plus nose sneer as angry', () => {
    const scores = scoreMap([
      [BLENDSHAPE_BROW_DOWN_LEFT, 0.6],
      [BLENDSHAPE_BROW_DOWN_RIGHT, 0.6],
      [BLENDSHAPE_NOSE_SNEER_LEFT, 0.5],
    ]);
    expect(classifyEmotion(scores)).toBe('angry');
  });

  it('picks the emotion with the greatest excess over its threshold', () => {
    // Both happy (1.0 > 0.6) and surprised (1.8 > 1.5) trigger. Happy excess
    // is 0.4, surprised excess is 0.3 — happy wins.
    const scores = scoreMap([
      [BLENDSHAPE_MOUTH_SMILE_LEFT, 0.5],
      [BLENDSHAPE_MOUTH_SMILE_RIGHT, 0.5],
      [BLENDSHAPE_JAW_OPEN, 0.6],
      [BLENDSHAPE_EYE_WIDE_LEFT, 0.6],
      [BLENDSHAPE_EYE_WIDE_RIGHT, 0.6],
      [BLENDSHAPE_BROW_INNER_UP, 0.6],
    ]);
    expect(classifyEmotion(scores)).toBe('happy');
  });

  it('ignores ambiguous brow-down + smile mix where neither dominates', () => {
    const scores = scoreMap([
      [BLENDSHAPE_MOUTH_SMILE_LEFT, 0.1],
      [BLENDSHAPE_MOUTH_SMILE_RIGHT, 0.1],
      [BLENDSHAPE_BROW_DOWN_LEFT, 0.3],
      [BLENDSHAPE_BROW_DOWN_RIGHT, 0.3],
    ]);
    expect(classifyEmotion(scores)).toBe('neutral');
  });
});

describe('emotionToEmoji', () => {
  it('returns a distinct emoji for each emotion', () => {
    const emojis = new Set(
      (['happy', 'surprised', 'sad', 'angry', 'neutral'] as const).map(emotionToEmoji)
    );
    expect(emojis.size).toBe(5);
  });
});
