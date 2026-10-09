export interface IMoonPatch {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly rotationDegrees: number;
}

export interface IMoonCrater {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly tone: 'bright' | 'dark';
}

export const MOON_MARIA: readonly IMoonPatch[] = [
  { name: 'Mare Imbrium', x: -0.3, y: -0.4, radiusX: 0.27, radiusY: 0.21, rotationDegrees: -10 },
  { name: 'Mare Serenitatis', x: 0.17, y: -0.38, radiusX: 0.16, radiusY: 0.15, rotationDegrees: 0 },
  {
    name: 'Mare Tranquillitatis',
    x: 0.3,
    y: -0.08,
    radiusX: 0.21,
    radiusY: 0.16,
    rotationDegrees: 20,
  },
  { name: 'Mare Crisium', x: 0.64, y: -0.27, radiusX: 0.12, radiusY: 0.09, rotationDegrees: 0 },
  { name: 'Mare Fecunditatis', x: 0.5, y: 0.16, radiusX: 0.12, radiusY: 0.17, rotationDegrees: 10 },
  {
    name: 'Oceanus Procellarum',
    x: -0.56,
    y: -0.04,
    radiusX: 0.27,
    radiusY: 0.4,
    rotationDegrees: 8,
  },
  { name: 'Mare Nubium', x: -0.14, y: 0.32, radiusX: 0.18, radiusY: 0.12, rotationDegrees: -10 },
  { name: 'Mare Humorum', x: -0.46, y: 0.33, radiusX: 0.09, radiusY: 0.08, rotationDegrees: 0 },
  { name: 'Mare Frigoris', x: 0, y: -0.7, radiusX: 0.4, radiusY: 0.07, rotationDegrees: 0 },
  {
    name: 'Mare Vaporum and Sinus Medii',
    x: 0,
    y: -0.18,
    radiusX: 0.1,
    radiusY: 0.07,
    rotationDegrees: 0,
  },
];

export const MOON_CRATERS: readonly IMoonCrater[] = [
  { name: 'Tycho', x: -0.12, y: 0.62, radius: 0.05, tone: 'bright' },
  { name: 'Copernicus', x: -0.25, y: -0.12, radius: 0.055, tone: 'bright' },
  { name: 'Kepler', x: -0.55, y: -0.12, radius: 0.03, tone: 'bright' },
  { name: 'Aristarchus', x: -0.68, y: -0.3, radius: 0.025, tone: 'bright' },
  { name: 'Plato', x: -0.15, y: -0.68, radius: 0.045, tone: 'dark' },
  { name: 'Grimaldi', x: -0.85, y: 0.08, radius: 0.05, tone: 'dark' },
  { name: 'Langrenus', x: 0.82, y: 0.12, radius: 0.04, tone: 'bright' },
  { name: 'Stöfler', x: 0.2, y: 0.55, radius: 0.04, tone: 'bright' },
  { name: 'Maurolycus', x: 0.4, y: 0.7, radius: 0.035, tone: 'bright' },
];

export const TYCHO = { x: -0.12, y: 0.62 } as const;
export const TYCHO_RAY_ENDS: readonly (readonly [number, number])[] = [
  [-0.6, 0.15],
  [0.25, 0.1],
  [0.45, 0.75],
  [-0.55, 0.78],
  [-0.05, 0.98],
];
