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
  | 'typing';

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

export type TFxDraw = (context: IFxDrawContext, state: Record<string, unknown>) => void;
