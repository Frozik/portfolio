import type { TEmotion } from '../emotion';
import type { GlassesAssetUrls, TGlassesStyle } from '../glasses-style';

/** The local camera and microphone with the AR glasses composited into the video track. */
export interface IMediaStreamComposer {
  readonly stream: MediaStream;
  readonly isAudioMuted: boolean;
  readonly isVideoMuted: boolean;
  readonly glassesStyle: TGlassesStyle;
  readonly currentEmotion: TEmotion;
  onMuteStateChange(listener: VoidFunction): VoidFunction;
  onGlassesStyleChange(listener: VoidFunction): VoidFunction;
  onEmotionChange(listener: (emotion: TEmotion) => void): VoidFunction;
  setAudioMuted(muted: boolean): void;
  setVideoMuted(muted: boolean): void;
  setGlassesStyle(style: TGlassesStyle): void;
  /** Idempotent. */
  dispose(): void;
}

export interface IMediaStreamComposerParams {
  /** The overlay drawn per style; the composer paints whatever it is given. */
  readonly glassesAssetUrls: GlassesAssetUrls;
  readonly constraints?: MediaStreamConstraints;
  readonly targetFps?: number;
}
