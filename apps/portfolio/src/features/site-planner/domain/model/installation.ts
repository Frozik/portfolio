/**
 * How a cable is laid on a stretch of route (`wiring.md` §3.1): in a
 * corrugated conduit of a standard bore, in a chase cut into the wall, in
 * surface trunking, on a tray, in a rigid pipe, or bare. Data, not tools —
 * a stretch is switched between them in a dropdown, the way a path segment
 * is repaved.
 */
export type InstallationKind = 'conduit' | 'chase' | 'trunking' | 'tray' | 'pipe' | 'open';

export type InstallationPresetId =
  | 'conduit-16'
  | 'conduit-20'
  | 'conduit-25'
  | 'conduit-32'
  | 'chase'
  | 'trunking'
  | 'tray'
  | 'pipe'
  | 'open';

export interface InstallationPreset {
  readonly id: InstallationPresetId;
  readonly kind: InstallationKind;
  /** The conduit's nominal outer diameter; the bore is what the fill reads. */
  readonly diameterMm?: number;
  readonly innerDiameterMm?: number;
}

/** In menu order: the conduits most houses are wired in first. */
const INSTALLATION_PRESETS: readonly InstallationPreset[] = [
  { id: 'conduit-16', kind: 'conduit', diameterMm: 16, innerDiameterMm: 10.7 },
  { id: 'conduit-20', kind: 'conduit', diameterMm: 20, innerDiameterMm: 14.1 },
  { id: 'conduit-25', kind: 'conduit', diameterMm: 25, innerDiameterMm: 18.3 },
  { id: 'conduit-32', kind: 'conduit', diameterMm: 32, innerDiameterMm: 24.3 },
  { id: 'chase', kind: 'chase' },
  { id: 'trunking', kind: 'trunking' },
  { id: 'tray', kind: 'tray' },
  { id: 'pipe', kind: 'pipe', diameterMm: 20, innerDiameterMm: 16 },
  { id: 'open', kind: 'open' },
];

export const INSTALLATION_PRESET_IDS: readonly InstallationPresetId[] = INSTALLATION_PRESETS.map(
  preset => preset.id
);

export const DEFAULT_INSTALLATION_PRESET: InstallationPresetId = 'conduit-20';

export function installationPreset(id: InstallationPresetId): InstallationPreset {
  return INSTALLATION_PRESETS.find(candidate => candidate.id === id) ?? INSTALLATION_PRESETS[1];
}

export function parseInstallationPreset(value: string): InstallationPresetId | undefined {
  return INSTALLATION_PRESET_IDS.find(id => id === value);
}

/** How wide a method lies on the plan — what two runs laid side by side keep between centres. */
const NOMINAL_WIDTHS_MM: Readonly<Record<InstallationKind, number>> = {
  conduit: 20,
  chase: 30,
  trunking: 40,
  tray: 100,
  pipe: 20,
  open: 10,
};

export function installationWidthMeters(preset: InstallationPreset): number {
  return (preset.diameterMm ?? NOMINAL_WIDTHS_MM[preset.kind]) / MM_PER_METER;
}

const MM_PER_METER = 1000;

/**
 * How much of a conduit's bore the cables may take. The trade reads ПУЭ and
 * СП 31-110 as 35 % for a bundle; the norm's own wording is looser, which is
 * why the finding stays advisory.
 */
export const CONDUIT_FILL_LIMIT = 0.35;

/** The bore's cross-section; nothing for a method that has no bore to fill. */
export function installationBoreAreaMm2(preset: InstallationPreset): number | undefined {
  const { innerDiameterMm } = preset;

  return innerDiameterMm === undefined ? undefined : (Math.PI * innerDiameterMm ** 2) / 4;
}
