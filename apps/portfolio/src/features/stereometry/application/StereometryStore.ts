import { makeAutoObservable, observableRef } from 'mobx';

import type { CameraInteractionMode } from '../domain/types';
import type { StereometryControls } from './render/draw';

/**
 * Toolbar state of the stereometry route. The interaction mode is owned here
 * and read by the camera through a getter; undo/redo availability is owned by
 * the scene state controller and only read through the attached session.
 * Frame-level scene state stays out of MobX on purpose: it changes per frame.
 */
export class StereometryStore {
  fps = 0;
  interactionMode: CameraInteractionMode = 'rotate';
  session: StereometryControls | undefined = undefined;

  constructor() {
    makeAutoObservable(this, { session: observableRef }, { autoBind: true });
  }

  get canUndo(): boolean {
    return this.session?.history.canUndo ?? false;
  }

  get canRedo(): boolean {
    return this.session?.history.canRedo ?? false;
  }

  attach(session: StereometryControls): void {
    this.session = session;
    this.fps = 0;
  }

  /** Drops the session so toolbar actions can't reach a destroyed renderer. */
  detach(): void {
    this.session = undefined;
  }

  setFps(fps: number): void {
    this.fps = fps;
  }

  setInteractionMode(mode: CameraInteractionMode): void {
    this.interactionMode = mode;
  }

  undo(): void {
    this.session?.undo();
  }

  redo(): void {
    this.session?.redo();
  }

  dispose(): void {
    this.detach();
  }
}
