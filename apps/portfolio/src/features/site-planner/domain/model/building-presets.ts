import type { Meters } from '../units';
import type { FoundationKind } from './foundation';

/**
 * The kinds of structure «Добавить строение» offers (`building-editor.md` §5,
 * R19): presets, never editor variants — every building runs the same editor,
 * a preset only seeds the data, and everything stays editable afterwards.
 */
export type BuildingPresetId = 'house' | 'shed' | 'carport';

export interface BuildingPreset {
  readonly id: BuildingPresetId;
  readonly foundationKind: FoundationKind;
  readonly wallHeightMeters: Meters;
}

/** Every preset, in the order the add-building menu offers them. */
export const BUILDING_PRESETS: readonly BuildingPreset[] = [
  { id: 'house', foundationKind: 'slab', wallHeightMeters: 2.7 },
  { id: 'shed', foundationKind: 'slab', wallHeightMeters: 2.2 },
  // A carport is a roof on posts: piers under it, no enclosure expected.
  { id: 'carport', foundationKind: 'pier', wallHeightMeters: 2.4 },
];

export function findBuildingPreset(id: BuildingPresetId): BuildingPreset | undefined {
  return BUILDING_PRESETS.find(preset => preset.id === id);
}
