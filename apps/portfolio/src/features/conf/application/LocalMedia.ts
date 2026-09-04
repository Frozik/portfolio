import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { TEmotion } from '../domain/emotion';
import type { TGlassesStyle } from '../domain/glasses-style';
import type { IMediaStreamComposer } from '../domain/ports/media-composer';

/**
 * The local camera and microphone as observable state: the composited
 * stream, mute flags, the chosen glasses and the emotion read off the face.
 * Owns the composer and mirrors its events; commands go straight to it.
 */
export class LocalMedia {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  glassesStyle: TGlassesStyle;
  emotion: TEmotion;

  readonly stream: MediaStream;

  private readonly composer: IMediaStreamComposer;
  private readonly disposables = new DisposableBag();

  constructor(composer: IMediaStreamComposer, onEmotionChange: (emotion: TEmotion) => void) {
    this.composer = composer;
    this.stream = composer.stream;
    this.isAudioMuted = composer.isAudioMuted;
    this.isVideoMuted = composer.isVideoMuted;
    this.glassesStyle = composer.glassesStyle;
    this.emotion = composer.currentEmotion;

    makeAutoObservable<LocalMedia, 'composer' | 'disposables'>(
      this,
      { stream: observableRef, composer: false, disposables: false },
      { autoBind: true }
    );

    this.disposables.add(() => composer.dispose());
    this.disposables.add(
      composer.onMuteStateChange(() => {
        runInAction(() => {
          this.isAudioMuted = composer.isAudioMuted;
          this.isVideoMuted = composer.isVideoMuted;
        });
      })
    );
    this.disposables.add(
      composer.onGlassesStyleChange(() => {
        runInAction(() => {
          this.glassesStyle = composer.glassesStyle;
        });
      })
    );
    this.disposables.add(
      composer.onEmotionChange(emotion => {
        runInAction(() => {
          this.emotion = emotion;
        });
        onEmotionChange(emotion);
      })
    );
  }

  toggleAudio(): void {
    this.composer.setAudioMuted(!this.isAudioMuted);
  }

  toggleVideo(): void {
    this.composer.setVideoMuted(!this.isVideoMuted);
  }

  setGlassesStyle(style: TGlassesStyle): void {
    this.composer.setGlassesStyle(style);
  }

  dispose(): void {
    this.disposables.disposeAll();
  }
}
