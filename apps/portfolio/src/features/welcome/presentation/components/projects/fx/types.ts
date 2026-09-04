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
  /** Animation seconds: advances faster while the card is hovered, never jumps. */
  readonly time: number;
  /** Animation seconds elapsed since the previous frame. */
  readonly deltaTime: number;
  readonly accent: TAccentAlpha;
  readonly devicePixelRatio: number;
}

/** Draw function of a stateful effect — receives its own typed state bag. */
export type TFxDraw<TState> = (context: IFxDrawContext, state: TState) => void;

/** Frame callback of an effect instance; its state (if any) is already bound. */
export type TFxRender = (context: IFxDrawContext) => void;

/** Creates one effect instance with a fresh state bag, one per card. */
export type TFxEffectFactory = () => TFxRender;
