import { resolveAudioContextConstructor } from '@frozik/utils/audio/audioContextConstructor';
import { isNil } from 'lodash-es';

/** Short synthesised cues; the feature ships no audio assets. */
export type RetroSoundCue = 'timerExpired' | 'timerWarning' | 'timerCountdown';

export interface ISoundPlayer {
  play(cue: RetroSoundCue): void;
  dispose(): void;
}

interface ICueProfile {
  readonly frequencyHz: number;
  readonly durationMs: number;
  readonly gain: number;
  /** `count` beeps `gapMs` apart, start to start; a single beep when absent. */
  readonly repeat?: { readonly count: number; readonly gapMs: number };
}

const CUE_PROFILES: Record<RetroSoundCue, ICueProfile> = {
  timerExpired: { frequencyHz: 440, durationMs: 280, gain: 0.28, repeat: { count: 3, gapMs: 220 } },
  timerWarning: { frequencyHz: 660, durationMs: 180, gain: 0.2 },
  timerCountdown: { frequencyHz: 880, durationMs: 90, gain: 0.16 },
};

const ATTACK_SECONDS = 0.01;
const RELEASE_SECONDS = 0.08;
const SILENCE_TAIL_SECONDS = 0.02;
const MS_IN_SECOND = 1_000;

/**
 * One `AudioContext` per tab, shared by every room's player. Firefox never
 * resumes a context created outside a user gesture, so the context is only
 * ever created by {@link primeRetroAudio} — called from a gesture handler at
 * the feature root — and `play()` stays silent until then.
 */
let sharedAudioContext: AudioContext | undefined;

/** Idempotent: creates the shared context if needed and resumes it. Call from a user gesture. */
export function primeRetroAudio(): void {
  if (isNil(sharedAudioContext)) {
    const AudioContextConstructor = resolveAudioContextConstructor();
    if (isNil(AudioContextConstructor)) {
      return;
    }
    sharedAudioContext = new AudioContextConstructor();
  }
  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume();
  }
}

function scheduleBeep(context: AudioContext, profile: ICueProfile, startAtSeconds: number): void {
  const durationSeconds = profile.durationMs / MS_IN_SECOND;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(profile.frequencyHz, startAtSeconds);
  gainNode.gain.setValueAtTime(0, startAtSeconds);
  gainNode.gain.linearRampToValueAtTime(profile.gain, startAtSeconds + ATTACK_SECONDS);
  gainNode.gain.linearRampToValueAtTime(
    0,
    startAtSeconds + Math.max(durationSeconds, ATTACK_SECONDS + RELEASE_SECONDS)
  );

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startAtSeconds);
  oscillator.stop(startAtSeconds + durationSeconds + SILENCE_TAIL_SECONDS);
  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
  };
}

export function createSoundPlayer(): ISoundPlayer {
  return {
    play(cue: RetroSoundCue): void {
      const context = sharedAudioContext;
      if (isNil(context) || context.state === 'suspended') {
        return;
      }
      const profile = CUE_PROFILES[cue];
      const beats = profile.repeat?.count ?? 1;
      const gapSeconds = (profile.repeat?.gapMs ?? 0) / MS_IN_SECOND;
      for (let beat = 0; beat < beats; beat += 1) {
        scheduleBeep(context, profile, context.currentTime + beat * gapSeconds);
      }
    },
    /** The shared context outlives the player so the next room stays primed. */
    dispose(): void {},
  };
}
