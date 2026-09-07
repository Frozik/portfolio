import { readOsmPbf } from './pbf/osm-pbf-reader';

export interface BuildingStats {
  readonly buildings: number;
  readonly withLevels: number;
  readonly withHeight: number;
  readonly withEither: number;
  readonly levelsHistogram: Readonly<Record<string, number>>;
}

/** Coverage of `building:levels` / `height` over the extract's building ways (plan Q12). */
export function collectBuildingStats(pbfPath: string): BuildingStats {
  let buildings = 0;
  let withLevels = 0;
  let withHeight = 0;
  let withEither = 0;
  const histogram = new Map<string, number>();
  readOsmPbf(pbfPath, {
    way: way => {
      const building = way.tags.get('building');
      if (building === undefined || building === 'no') {
        return;
      }
      buildings++;
      const levels = way.tags.get('building:levels');
      const height = way.tags.get('height');
      if (levels !== undefined) {
        withLevels++;
        histogram.set(levels, (histogram.get(levels) ?? 0) + 1);
      }
      if (height !== undefined) {
        withHeight++;
      }
      if (levels !== undefined || height !== undefined) {
        withEither++;
      }
    },
  });
  const levelsHistogram = Object.fromEntries(
    [...histogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  );
  return { buildings, withLevels, withHeight, withEither, levelsHistogram };
}
