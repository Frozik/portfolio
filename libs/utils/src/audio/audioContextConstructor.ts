declare global {
  interface Window {
    /** Legacy Safari name for `AudioContext`. */
    readonly webkitAudioContext?: typeof AudioContext;
  }
}

export function resolveAudioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.AudioContext ?? window.webkitAudioContext;
}
