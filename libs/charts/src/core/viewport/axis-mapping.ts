import { isNil } from 'lodash-es';

import type { IAxisDomain, IAxisRange } from './axis-domain';
import type { ICut } from './cut';
import type { ICutSupply } from './cut-table';
import { CutTable } from './cut-table';

/** A cut as the view sees it: the one virtual position both its edges fall on, and the edges themselves. */
export interface ICutInView<TX> extends ICut<TX> {
  readonly at: TX;
  /** Axis units left whole between the cut before and this one — a session; none before the first cut. */
  readonly openBefore: number | undefined;
}

/** Which edge of a cut a virtual position that both edges fall on stands for. */
export type TCutEdge = 'before' | 'after';

/**
 * The correspondence between the world axis and the virtual one the chart
 * runs on, where every cut has no length (sessions §2). `toVirtual` is
 * monotone and continuous; `toWorld` is its inverse off the cuts, and on a
 * cut gives the edge asked for — the one after it unless told otherwise.
 */
export interface IAxisMapping<TX> {
  /** A fingerprint of the cuts: the same cuts, the same id; keys caches and tells synchronised charts apart. */
  readonly id: string;
  toVirtual(world: TX): TX;
  toWorld(virtual: TX, edge?: TCutEdge): TX;
  /** Whether a world position lies strictly inside a cut. */
  isCut(world: TX): boolean;
  /** The cuts whose virtual position lies in the range, in order. */
  cutsIn(range: IAxisRange<TX>): readonly ICutInView<TX>[];
  /** The first of them alone: what a painter walking the axis by pixels asks, a stride at a time. */
  firstCutIn(range: IAxisRange<TX>): ICutInView<TX> | undefined;
}

/** Where the cuts of an axis come from when they are not simply listed: a schedule, say. */
export interface ICutsDefinition<TX> {
  mappingOf(domain: IAxisDomain<TX>): IAxisMapping<TX>;
}

export type TCuts<TX> = readonly ICut<TX>[] | ICutsDefinition<TX>;

export function mappingOf<TX>(domain: IAxisDomain<TX>, cuts: TCuts<TX>): IAxisMapping<TX> {
  return 'mappingOf' in cuts ? cuts.mappingOf(domain) : cutsMapping(domain, cuts);
}

/** A world range as the viewport counts it; one that starts or ends on a cut keeps the whole cut inside. */
export function toVirtualRange<TX>(
  mapping: IAxisMapping<TX>,
  range: IAxisRange<TX>
): IAxisRange<TX> {
  return { start: mapping.toVirtual(range.start), end: mapping.toVirtual(range.end) };
}

export function toWorldRange<TX>(mapping: IAxisMapping<TX>, range: IAxisRange<TX>): IAxisRange<TX> {
  return {
    start: mapping.toWorld(range.start, 'before'),
    end: mapping.toWorld(range.end, 'after'),
  };
}

/** A mapping over a table of cuts, whole from the start or filled in by a supply as the axis is looked at. */
export function tableMapping<TX>(
  domain: IAxisDomain<TX>,
  id: string,
  table: CutTable<TX>
): IAxisMapping<TX> {
  const toVirtual = (world: TX): TX => {
    table.cover(world);
    return table.virtualOf(world);
  };

  /** The world position shown at a virtual one, as far as the cuts known reach; looks further when it lands beyond them. */
  const toWorld = (virtual: TX, edge: TCutEdge): TX => {
    let guess = virtual;
    for (;;) {
      table.cover(guess);
      const index = table.lastAtOrBefore(entry => entry.at, virtual);
      let world: TX;
      if (index < 0) {
        // Before the first cut only what lies between it and the origin is removed, all of it.
        const first = table.cuts[0];
        world = isNil(first) ? virtual : domain.plus(virtual, first.removedBefore);
      } else {
        const entry = table.cuts[index];
        if (domain.compare(entry.at, virtual) === 0) {
          return edge === 'after' ? entry.to : entry.from;
        }
        world = domain.plus(
          virtual,
          domain.plus(entry.removedBefore, domain.minus(entry.to, entry.from))
        );
      }
      if (domain.compare(world, guess) === 0) {
        return world;
      }
      guess = world;
    }
  };

  return {
    id,
    toVirtual,
    toWorld: (virtual, edge = 'after') => toWorld(virtual, edge),
    isCut(world): boolean {
      table.cover(world);
      const index = table.lastStartingBefore(world);
      return (
        index >= 0 &&
        domain.compare(world, table.cuts[index].from) > 0 &&
        domain.compare(world, table.cuts[index].to) < 0
      );
    },
    cutsIn(range): readonly ICutInView<TX>[] {
      const found: ICutInView<TX>[] = [];
      eachCutIn(range, cut => {
        found.push(cut);
        return true;
      });
      return found;
    },
    firstCutIn(range): ICutInView<TX> | undefined {
      let found: ICutInView<TX> | undefined;
      eachCutIn(range, cut => {
        found = cut;
        return false;
      });
      return found;
    },
  };

  /** Calls back for every cut in the range in order, for as long as the callback asks for more. */
  function eachCutIn(range: IAxisRange<TX>, take: (cut: ICutInView<TX>) => boolean): void {
    table.cover(toWorld(range.end, 'after'));
    const first = table.lastAtOrBefore(entry => entry.at, range.start);
    for (let index = Math.max(0, first); index < table.cuts.length; index += 1) {
      const entry = table.cuts[index];
      const { at } = entry;
      if (domain.compare(at, range.end) > 0) {
        return;
      }
      if (domain.compare(at, range.start) >= 0) {
        const previous = table.cuts[index - 1];
        const more = take({
          at,
          from: entry.from,
          to: entry.to,
          openBefore: isNil(previous) ? undefined : domain.diff(entry.from, previous.to),
        });
        if (!more) {
          return;
        }
      }
    }
  }
}

/** The axis with the given stretches taken out; nothing else about the axis changes (sessions §3). */
export function cutsMapping<TX>(
  domain: IAxisDomain<TX>,
  cuts: readonly ICut<TX>[]
): IAxisMapping<TX> {
  const table = new CutTable<TX>(domain, undefined);
  table.setAll(cuts);
  const id = `cuts:${JSON.stringify(table.cuts.map(({ from, to }) => [String(from), String(to)]))}`;
  return tableMapping(domain, id, table);
}

/** The axis with the stretches a supply names taken out, found out as far as the axis is looked at. */
export function suppliedMapping<TX>(
  domain: IAxisDomain<TX>,
  id: string,
  supply: ICutSupply<TX>
): IAxisMapping<TX> {
  return tableMapping(domain, id, new CutTable<TX>(domain, supply));
}
