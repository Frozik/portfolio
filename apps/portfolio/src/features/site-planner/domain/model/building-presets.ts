import type { Meters } from '../units';
import type { FoundationKind, UtilityEntry, UtilitySystem } from './foundation';
import { createUtilityEntry, ENTRY_SPACING_METERS } from './foundation';

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
  /**
   * The utility entries a typical building of this kind comes with, in the
   * order they walk along the outline. Seeded, never imposed: they are plain
   * entries afterwards — movable, editable, removable — and their badges
   * appear once a footprint exists to stand them on. This is what lets a
   * stock house land on the plot ready to have its trenches routed.
   */
  readonly entrySystems: readonly UtilitySystem[];
}

/** Every preset, in the order the add-building menu offers them. */
export const BUILDING_PRESETS: readonly BuildingPreset[] = [
  {
    id: 'house',
    foundationKind: 'slab',
    wallHeightMeters: 2.7,
    // A dwelling takes every external system; gas rides the facade (СП 62).
    entrySystems: ['power', 'water', 'sewer', 'gas'],
  },
  {
    id: 'shed',
    foundationKind: 'slab',
    wallHeightMeters: 2.2,
    entrySystems: ['power'],
  },
  // A carport is a roof on posts: piers under it, no enclosure expected.
  { id: 'carport', foundationKind: 'pier', wallHeightMeters: 2.4, entrySystems: ['power'] },
];

/** The preset's entry set materialized: spaced along the outline, norm depths. */
export function presetUtilityEntries(
  preset: BuildingPreset,
  frostDepthMeters: Meters
): readonly UtilityEntry[] {
  return preset.entrySystems.map((system, index) =>
    createUtilityEntry({
      system,
      outlineOffsetMeters: index * ENTRY_SPACING_METERS,
      frostDepthMeters,
    })
  );
}

export function findBuildingPreset(id: BuildingPresetId): BuildingPreset | undefined {
  return BUILDING_PRESETS.find(preset => preset.id === id);
}
