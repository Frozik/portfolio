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
  TimerCountdown = 'timerCountdown',
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
  /**
   * Optional repeat schedule — each cue fires `count` consecutive beeps
   * separated by `gapMs` (measured start-to-start). Defaults to a single
   * beep when absent.
   */
  readonly repeat?: { readonly count: number; readonly gapMs: number };
}

const CUE_PROFILES: Record<ERetroSoundCue, ICueProfile> = {
  [ERetroSoundCue.TimerExpired]: {
    frequencyHz: 440,
    durationMs: 280,
    gain: 0.28,
    repeat: { count: 3, gapMs: 220 },
  },
  [ERetroSoundCue.TimerWarning]: { frequencyHz: 660, durationMs: 180, gain: 0.2 },
  [ERetroSoundCue.TimerCountdown]: { frequencyHz: 880, durationMs: 90, gain: 0.16 },
  [ERetroSoundCue.VoteCast]: { frequencyHz: 880, durationMs: 80, gain: 0.12 },
  [ERetroSoundCue.ActionItemAdded]: { frequencyHz: 520, durationMs: 140, gain: 0.15 },
};

const ATTACK_SECONDS = 0.01;
const RELEASE_SECONDS = 0.08;
const SILENCE_TAIL_SECONDS = 0.02;
const MS_IN_SECOND = 1_000;

/**
 * Module-scoped `AudioContext` shared across every retro `SoundPlayer`
 * built in this tab. We hoist it above per-room players so the very
 * first user gesture anywhere inside the retro feature (lobby, room,
 * identity dialog…) constructs and primes it — rather than only the
 * room-scope `pointerdown` handler that races the timer for users who
 * land directly in a running room.
 *
 * Firefox refuses to `resume()` an `AudioContext` that was constructed
 * outside an active user gesture — once it's suspended there it stays
 * suspended for the rest of the page lifetime. To stay compatible we
 * only *create* the context from {@link primeRetroAudio} (which is
 * always invoked synchronously from a pointer / key / touch / click
 * event), and `play()` silently no-ops until that happens.
 */
let sharedAudioContext: AudioContext | null = null;

function getSharedContext(createIfMissing: boolean): AudioContext | null {
  if (!isNil(sharedAudioContext)) {
    return sharedAudioContext;
  }
  if (!createIfMissing) {
    return null;
  }

  const AudioContextCtor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

  if (isNil(AudioContextCtor)) {
    return null;
  }

  sharedAudioContext = new AudioContextCtor();
  return sharedAudioContext;
}

/**
 * Idempotent: called from a user-gesture handler at the retro feature
 * root, ensures the shared `AudioContext` exists and is `'running'`.
 * Subsequent `play()` calls (timer ticks, vote acks, …) become audible.
 */
export function primeRetroAudio(): void {
  const context = getSharedContext(true);
  if (isNil(context)) {
    return;
  }
  if (context.state === 'suspended') {
    void context.resume();
  }
}

/**
 * Build a sound player. Audio scheduling is bound to the
 * module-level shared context; `play()` is silent until
 * {@link primeRetroAudio} runs from a user gesture.
 */
export function createSoundPlayer(): ISoundPlayer {
  let enabled = true;

  const scheduleBeep = (
    context: AudioContext,
    profile: ICueProfile,
    startAtSeconds: number
  ): void => {
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
  };

  return {
    play(cue: ERetroSoundCue): void {
      if (!enabled) {
        return;
      }

      const context = getSharedContext(false);

      if (isNil(context) || context.state === 'suspended') {
        return;
      }

      const profile = CUE_PROFILES[cue];
      const now = context.currentTime;
      const beats = profile.repeat?.count ?? 1;
      const gapSeconds = (profile.repeat?.gapMs ?? 0) / MS_IN_SECOND;

      for (let index = 0; index < beats; index += 1) {
        scheduleBeep(context, profile, now + index * gapSeconds);
      }
    },

    unlock(): void {
      primeRetroAudio();
    },

    setEnabled(nextEnabled: boolean): void {
      enabled = nextEnabled;
    },

    /**
     * Per-player dispose is a no-op — the shared context lives for the
     * lifetime of the tab so the next room (or rejoin) keeps it primed.
     * Closing it would force every future room to re-prompt for a user
     * gesture before sound works.
     */
    dispose(): void {},
  };
}
