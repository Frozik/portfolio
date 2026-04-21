import { isNil } from 'lodash-es';

/**
 * Short audible cues for retro UI events. The feature does not ship any
 * audio assets — instead we synthesize tones on the fly via the Web Audio
 * API. This keeps the bundle small and avoids a round-trip for the
 * occasional quiet "ding".
 */
export enum ERetroSoundCue {
  TimerExpired = 'timerExpired',
  TimerWarning = 'timerWarning',
  VoteCast = 'voteCast',
  ActionItemAdded = 'actionItemAdded',
}

export interface ISoundPlayer {
  play(cue: ERetroSoundCue): void;
  /**
   * Resume the underlying `AudioContext` if it is suspended. Browsers
   * block audio until the page has seen a user gesture — call this inside
   * event handlers (click, keypress, etc.) so later `play()` calls that
   * fire from timers or effects are audible.
   */
  unlock(): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

interface ICueProfile {
  readonly frequencyHz: number;
  readonly durationMs: number;
  readonly gain: number;
}

const CUE_PROFILES: Record<ERetroSoundCue, ICueProfile> = {
  [ERetroSoundCue.TimerExpired]: { frequencyHz: 440, durationMs: 420, gain: 0.25 },
  [ERetroSoundCue.TimerWarning]: { frequencyHz: 660, durationMs: 180, gain: 0.18 },
  [ERetroSoundCue.VoteCast]: { frequencyHz: 880, durationMs: 80, gain: 0.12 },
  [ERetroSoundCue.ActionItemAdded]: { frequencyHz: 520, durationMs: 140, gain: 0.15 },
};

const ATTACK_SECONDS = 0.01;
const RELEASE_SECONDS = 0.08;
const SILENCE_TAIL_SECONDS = 0.02;
const MS_IN_SECOND = 1_000;

/**
 * Build a sound player bound to a shared `AudioContext`. The context is
 * created lazily on the first `play()` call so we never request audio
 * permission speculatively.
 */
export function createSoundPlayer(): ISoundPlayer {
  let audioContext: AudioContext | null = null;
  let enabled = true;

  const getContext = (): AudioContext | null => {
    if (!isNil(audioContext)) {
      return audioContext;
    }

    const AudioContextCtor =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

    if (isNil(AudioContextCtor)) {
      return null;
    }

    audioContext = new AudioContextCtor();
    return audioContext;
  };

  return {
    play(cue: ERetroSoundCue): void {
      if (!enabled) {
        return;
      }

      const context = getContext();

      if (isNil(context)) {
        return;
      }

      const profile = CUE_PROFILES[cue];
      const now = context.currentTime;
      const durationSeconds = profile.durationMs / MS_IN_SECOND;

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(profile.frequencyHz, now);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(profile.gain, now + ATTACK_SECONDS);
      gainNode.gain.linearRampToValueAtTime(
        0,
        now + Math.max(durationSeconds, ATTACK_SECONDS + RELEASE_SECONDS)
      );

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + durationSeconds + SILENCE_TAIL_SECONDS);

      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };
    },

    unlock(): void {
      const context = getContext();
      if (isNil(context)) {
        return;
      }
      if (context.state === 'suspended') {
        void context.resume();
      }
    },

    setEnabled(nextEnabled: boolean): void {
      enabled = nextEnabled;
    },

    dispose(): void {
      if (!isNil(audioContext)) {
        void audioContext.close();
        audioContext = null;
      }
    },
  };
}
