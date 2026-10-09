import type { TSurface } from './sky-palette';

export interface IMountainFace {
  readonly id: string;
  readonly path: string;
  readonly surface: TSurface;
  readonly faceAzimuthDegrees: number;
  readonly depth: number;
  readonly top: number;
  readonly bottom: number;
}

export const SUMMIT_Y = 66;
export const FOOT_Y = 182;

export const MOUNTAIN_FACES: readonly IMountainFace[] = [
  {
    id: 'far-west-range',
    path: 'M0 132 L14 124 L26 128 L38 118 L50 124 L60 120 L68 132 L68 200 L0 200 Z',
    surface: 'snow',
    faceAzimuthDegrees: 120,
    depth: 1,
    top: 118,
    bottom: 150,
  },
  {
    id: 'far-east-range',
    path: 'M132 128 L144 118 L156 124 L166 112 L178 120 L190 116 L200 124 L200 200 L132 200 Z',
    surface: 'snow',
    faceAzimuthDegrees: 240,
    depth: 1,
    top: 112,
    bottom: 150,
  },
  {
    id: 'summit-east-face',
    path: 'M100 66 L94 72 L88 82 L80 92 L72 104 L62 116 L52 126 L40 138 L28 150 L20 162 L10 178 L0 200 L100 200 L97 126 L102 98 Z',
    surface: 'snow',
    faceAzimuthDegrees: 105,
    depth: 0.15,
    top: 66,
    bottom: 200,
  },
  {
    id: 'summit-west-face',
    path: 'M100 66 L106 74 L114 86 L124 98 L134 110 L146 122 L158 134 L170 148 L180 162 L190 178 L200 200 L100 200 L97 126 L102 98 Z',
    surface: 'snow',
    faceAzimuthDegrees: 255,
    depth: 0.15,
    top: 66,
    bottom: 200,
  },
  {
    id: 'east-shoulder',
    path: 'M6 168 L18 152 L30 146 L42 150 L54 142 L66 150 L78 162 L86 176 L0 184 Z',
    surface: 'snow',
    faceAzimuthDegrees: 115,
    depth: 0.1,
    top: 142,
    bottom: 184,
  },
  {
    id: 'west-shoulder',
    path: 'M114 176 L124 162 L136 154 L148 148 L158 152 L170 144 L184 150 L200 146 L200 184 L120 184 Z',
    surface: 'snow',
    faceAzimuthDegrees: 245,
    depth: 0.1,
    top: 144,
    bottom: 184,
  },
  {
    id: 'valley-snow',
    path: 'M60 200 L72 184 L88 176 L100 174 L116 178 L130 186 L138 200 Z',
    surface: 'snow',
    faceAzimuthDegrees: 180,
    depth: 0.05,
    top: 174,
    bottom: 200,
  },
  {
    id: 'east-rocks',
    path: 'M0 172 L10 166 L20 170 L30 164 L42 174 L52 172 L64 186 L70 200 L0 200 Z',
    surface: 'rock',
    faceAzimuthDegrees: 110,
    depth: 0,
    top: 164,
    bottom: 200,
  },
  {
    id: 'west-rocks',
    path: 'M134 200 L142 188 L152 184 L160 176 L172 180 L182 172 L192 176 L200 172 L200 200 Z',
    surface: 'rock',
    faceAzimuthDegrees: 250,
    depth: 0,
    top: 172,
    bottom: 200,
  },
];

export const ROCK_RIBS: readonly string[] = [
  'M95 104 L90 116 L86 132 L84 148 L86 149 L89 132 L93 116 Z',
  'M77 108 L70 122 L64 138 L66 139 L72 124 Z',
  'M58 130 L51 142 L53 143 L60 132 Z',
  'M107 96 L112 110 L115 128 L117 146 L120 147 L118 128 L114 110 Z',
  'M125 108 L132 122 L138 138 L141 139 L135 122 Z',
  'M145 126 L153 140 L158 149 L160 149 L155 138 Z',
  'M101 136 L104 150 L107 160 L109 160 L105 148 Z',
];

export const STARS: readonly (readonly [number, number])[] = [
  [62, 44],
  [84, 34],
  [118, 40],
  [140, 52],
  [52, 70],
  [150, 76],
  [96, 52],
  [128, 30],
  [72, 58],
  [110, 62],
  [40, 92],
  [162, 96],
  [88, 74],
  [134, 68],
  [58, 104],
  [146, 104],
];
