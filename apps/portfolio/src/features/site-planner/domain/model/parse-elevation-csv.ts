import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';

/** A mark as a pasted row describes it: everything except the identity the plan mints. */
export interface ElevationMarkDraft {
  readonly position: Vector2;
  readonly elevation: Meters;
}

export interface ElevationCsvParseResult {
  readonly marks: readonly ElevationMarkDraft[];
  /** One-based numbers of the rows that held no usable triple, for the report. */
  readonly skippedLineNumbers: readonly number[];
}

/**
 * Any run of whitespace, commas or semicolons separates two values. Survey
 * exports differ on the separator and are routinely pasted through a spreadsheet
 * on the way here, which turns it into a tab — accepting all of them is what
 * makes the paste work on the first try.
 */
const VALUE_SEPARATOR = /[\s,;]+/;

const LINE_SEPARATOR = /\r?\n/;

/** Easting, northing and elevation — the triple a surveyed point is written as. */
const VALUES_PER_MARK = 3;

/**
 * Reads pasted survey rows into marks. Rows that hold no usable triple — a
 * header, a comment, a truncated line — are reported rather than dropped
 * silently, so a paste that half worked says so.
 */
export function parseElevationCsv(text: string): ElevationCsvParseResult {
  const marks: ElevationMarkDraft[] = [];
  const skippedLineNumbers: number[] = [];

  text.split(LINE_SEPARATOR).forEach((line, index) => {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      return;
    }

    const values = trimmedLine.split(VALUE_SEPARATOR).map(Number);

    if (values.length !== VALUES_PER_MARK || !values.every(Number.isFinite)) {
      skippedLineNumbers.push(index + 1);

      return;
    }

    const [x, y, elevation] = values;

    marks.push({ position: { x, y }, elevation });
  });

  return { marks, skippedLineNumbers };
}
