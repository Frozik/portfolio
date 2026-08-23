import { assertNever } from '@frozik/utils/assert/assertNever';

export type EngineHumState = 'off' | 'idle' | 'moving';

export interface IEngineHum {
  setState(state: EngineHumState): void;
  dispose(): void;
}

const BUZZ_FREQUENCY_BY_STATE: Readonly<Record<'idle' | 'moving', number>> = {
  idle: 48,
  moving: 74,
};

/** The triangle rides an octave above the buzz. */
const BODY_FREQUENCY_RATIO = 2;
const BUZZ_GAIN = 0.05;
const BODY_GAIN = 0.03;
const SILENT_GAIN = 0;
/** Long enough that a rev is audible, short enough that stopping is immediate. */
const RETUNE_TIME_CONSTANT_SECONDS = 0.04;
const GAIN_RAMP_SECONDS = 0.05;
/** Rolls the harsh upper harmonics off the square wave so the loop can run for minutes. */
const TONE_CUTOFF_HZ = 900;

function resolveBuzzFrequencyHz(state: EngineHumState): number {
  switch (state) {
    case 'off':
      return BUZZ_FREQUENCY_BY_STATE.idle;
    case 'idle':
    case 'moving':
      return BUZZ_FREQUENCY_BY_STATE[state];
    default:
      return assertNever(state);
  }
}

/** Oscillators start once and run forever — WebAudio cannot restart them; the gain gates instead. */
export function createEngineHum(context: AudioContext, destination: AudioNode): IEngineHum {
  const buzz = context.createOscillator();
  const body = context.createOscillator();
  const buzzGain = context.createGain();
  const bodyGain = context.createGain();
  const tone = context.createBiquadFilter();

  let currentState: EngineHumState = 'off';
  let isDisposed = false;

  buzz.type = 'square';
  body.type = 'triangle';
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(TONE_CUTOFF_HZ, context.currentTime);

  buzz.frequency.setValueAtTime(BUZZ_FREQUENCY_BY_STATE.idle, context.currentTime);
  body.frequency.setValueAtTime(
    BUZZ_FREQUENCY_BY_STATE.idle * BODY_FREQUENCY_RATIO,
    context.currentTime
  );
  buzzGain.gain.setValueAtTime(SILENT_GAIN, context.currentTime);
  bodyGain.gain.setValueAtTime(SILENT_GAIN, context.currentTime);

  buzz.connect(buzzGain);
  body.connect(bodyGain);
  buzzGain.connect(tone);
  bodyGain.connect(tone);
  tone.connect(destination);

  buzz.start();
  body.start();

  return {
    setState(state: EngineHumState): void {
      if (isDisposed || state === currentState) {
        return;
      }

      currentState = state;

      const now = context.currentTime;
      const buzzFrequencyHz = resolveBuzzFrequencyHz(state);
      const isRunning = state !== 'off';

      buzz.frequency.setTargetAtTime(buzzFrequencyHz, now, RETUNE_TIME_CONSTANT_SECONDS);
      body.frequency.setTargetAtTime(
        buzzFrequencyHz * BODY_FREQUENCY_RATIO,
        now,
        RETUNE_TIME_CONSTANT_SECONDS
      );
      buzzGain.gain.linearRampToValueAtTime(
        isRunning ? BUZZ_GAIN : SILENT_GAIN,
        now + GAIN_RAMP_SECONDS
      );
      bodyGain.gain.linearRampToValueAtTime(
        isRunning ? BODY_GAIN : SILENT_GAIN,
        now + GAIN_RAMP_SECONDS
      );
    },

    dispose(): void {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      buzz.stop();
      body.stop();
      buzz.disconnect();
      body.disconnect();
      buzzGain.disconnect();
      bodyGain.disconnect();
      tone.disconnect();
    },
  };
}
