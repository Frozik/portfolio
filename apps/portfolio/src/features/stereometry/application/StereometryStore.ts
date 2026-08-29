import { makeAutoObservable } from 'mobx';

import type { CameraInteractionMode } from '../domain/types';
import type { StereometryControls } from './render/draw';

/**
 * UI-facing mirror of a stereometry session: which toolbar buttons are live and
 * what the renderer reports. Frame-level scene state deliberately stays out of
 * MobX — it lives in the render loop and the scene state controller, which the
 * store reaches only through the imperative {@link StereometryControls}.
 */
export class StereometryStore {
  canUndo = false;
  canRedo = false;
  fps = 0;
  interactionMode: CameraInteractionMode = 'rotate';

  private controls: StereometryControls | undefined;

  constructor() {
    makeAutoObservable<StereometryStore, 'controls'>(this, { controls: false }, { autoBind: true });
  }

  /** Binds a freshly started session; its history is empty and its camera adopts the current mode. */
  attach(controls: StereometryControls): void {
    this.controls = controls;
    this.canUndo = false;
    this.canRedo = false;
    this.fps = 0;
    controls.camera.setInteractionMode(this.interactionMode);
  }

  /** Drops the session reference so toolbar actions can't reach a destroyed renderer. */
  detach(): void {
    this.controls = undefined;
  }

  setHistoryAvailability(canUndo: boolean, canRedo: boolean): void {
    this.canUndo = canUndo;
    this.canRedo = canRedo;
  }

  setFps(fps: number): void {
    this.fps = fps;
  }

  setInteractionMode(mode: CameraInteractionMode): void {
    this.interactionMode = mode;
    this.controls?.camera.setInteractionMode(mode);
  }

  undo(): void {
    this.controls?.undo();
  }

  redo(): void {
    this.controls?.redo();
  }

  dispose(): void {
    this.detach();
  }
}
