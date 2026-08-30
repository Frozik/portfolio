export type TProjectFxKind =
  | 'neural'
  | 'flare'
  | 'shapes'
  | 'crosshair'
  | 'ticker'
  | 'cursor'
  | 'rotate'
  | 'peers'
  | 'ar'
  | 'typing'
  | 'tanks'
  | 'artillery'
  | 'contours';

export type TAccentAlpha = (alpha: number) => string;

export interface IFxDrawContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly time: number;
  readonly speed: number;
  readonly accent: TAccentAlpha;
  readonly dpr: number;
}

/** Draw function of a stateful effect — receives its own typed state bag. */
export type TFxDraw<TState> = (context: IFxDrawContext, state: TState) => void;

/** Frame callback of an effect instance; its state (if any) is already bound. */
export type TFxRender = (context: IFxDrawContext) => void;

/** Creates one effect instance with a fresh state bag, one per card. */
export type TFxEffectFactory = () => TFxRender;
