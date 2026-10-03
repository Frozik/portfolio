import { isNil } from 'lodash-es';

import type { IAxisDomain, IAxisRange } from './axis-domain';
import { maxOf, minOf } from './axis-domain';
import type { ICut } from './cut';

/**
 * A cut with how much of the axis is removed between the origin and its
 * start — negative before the origin — and where it stands on the virtual axis.
 */
export interface ICutEntry<TX> extends ICut<TX> {
  readonly removedBefore: TX;
  readonly at: TX;
}

/** Where the cuts of a stretch of the world axis come from: given whole, or found out as the axis is looked at. */
export interface ICutSupply<TX> {
  /** The cuts inside `[from, to)`; one that runs past an end is cut off there and joined up when the next stretch comes. */
  cutsBetween(from: TX, to: TX): readonly ICut<TX>[];
  /** How far to look at a time: the stretch asked for grows to whole multiples of this, in axis units. */
  readonly stride: number;
}

interface IMutableEntry<TX> {
  from: TX;
  to: TX;
  removedBefore: TX;
  at: TX;
}

/**
 * The sorted, merged cuts of an axis and how much they remove, counted from
 * the origin, kept for as far along the axis as anyone has looked: a supply
 * fills in more stretches on either side as positions outside the known ones
 * are asked about, and what is known already stays as it is.
 */
export class CutTable<TX> {
  private entries: IMutableEntry<TX>[] = [];
  private known: IAxisRange<TX> | undefined;

  constructor(
    private readonly domain: IAxisDomain<TX>,
    private readonly supply: ICutSupply<TX> | undefined
  ) {}

  get cuts(): readonly ICutEntry<TX>[] {
    return this.entries;
  }

  /** The whole set of cuts of an axis given at once. */
  setAll(cuts: readonly ICut<TX>[]): void {
    this.build(cuts);
  }

  /** Makes sure the cuts round `world` are known; the whole gap to it is asked for at once, and the origin from the start. */
  cover(world: TX): void {
    const { domain, supply } = this;
    if (isNil(supply)) {
      return;
    }
    if (isNil(this.known)) {
      const first = this.strideStart(world);
      const origin = this.strideStart(domain.zero);
      const from = minOf(domain, first, origin);
      const to = domain.add(maxOf(domain, first, origin), supply.stride);
      this.known = { start: from, end: to };
      this.build(supply.cutsBetween(from, to));
    } else if (domain.compare(world, this.known.end) >= 0) {
      const to = domain.add(this.strideStart(world), supply.stride);
      this.append(supply.cutsBetween(this.known.end, to));
      this.known = { ...this.known, end: to };
    } else if (domain.compare(world, this.known.start) < 0) {
      const from = this.strideStart(world);
      this.prepend(supply.cutsBetween(from, this.known.start));
      this.known = { ...this.known, start: from };
    }
  }

  /** How much of the axis is removed between the origin and the position: negative before the origin. */
  removedBelow(world: TX): TX {
    const { domain, entries } = this;
    const index = this.lastStartingBefore(world);
    if (index < 0) {
      return entries.length === 0 ? domain.zero : entries[0].removedBefore;
    }
    const entry = entries[index];
    return domain.plus(
      entry.removedBefore,
      domain.minus(minOf(domain, world, entry.to), entry.from)
    );
  }

  /** The virtual position of a world one. */
  virtualOf(world: TX): TX {
    return this.domain.minus(world, this.removedBelow(world));
  }

  /** Index of the last cut that starts at or before the position; −1 when none does. */
  lastStartingBefore(world: TX): number {
    return this.lastAtOrBefore(entry => entry.from, world);
  }

  lastAtOrBefore(keyOf: (entry: ICutEntry<TX>) => TX, position: TX): number {
    const { entries, domain } = this;
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (domain.compare(keyOf(entries[middle]), position) <= 0) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low - 1;
  }

  /** The table from a whole set of cuts: sorted, merged, counted from the origin. */
  private build(cuts: readonly ICut<TX>[]): void {
    const { domain } = this;
    this.entries = [];
    this.append(cuts);
    const below = this.entries.filter(entry => domain.compare(entry.from, domain.zero) < 0);
    // Counted from the first cut so far; what lies before the origin moves the count so that nought stands there.
    const removedBelowOrigin = below.reduce(
      (sum, entry) =>
        domain.plus(sum, domain.minus(minOf(domain, entry.to, domain.zero), entry.from)),
      domain.zero
    );
    for (const entry of this.entries) {
      entry.removedBefore = domain.minus(entry.removedBefore, removedBelowOrigin);
      entry.at = domain.minus(entry.from, entry.removedBefore);
    }
  }

  /** Cuts at or after the last one known, in any order; one touching the last is joined to it. The count goes on from the last. */
  private append(cuts: readonly ICut<TX>[]): void {
    const { domain, entries } = this;
    const sorted = [...cuts].sort((first, second) => domain.compare(first.from, second.from));
    for (const cut of sorted) {
      if (domain.compare(cut.to, cut.from) <= 0) {
        continue;
      }
      const last = entries.at(-1);
      if (!isNil(last) && domain.compare(cut.from, last.to) <= 0) {
        last.to = maxOf(domain, last.to, cut.to);
        continue;
      }
      const removedBefore = isNil(last)
        ? domain.zero
        : domain.plus(last.removedBefore, domain.minus(last.to, last.from));
      entries.push({
        from: cut.from,
        to: cut.to,
        removedBefore,
        at: domain.minus(cut.from, removedBefore),
      });
    }
  }

  /** Cuts at or before the first one known, in any order; one touching the first is joined to it. The count goes on backwards from the first. */
  private prepend(cuts: readonly ICut<TX>[]): void {
    const { domain } = this;
    const sorted = [...cuts].sort((first, second) => domain.compare(second.from, first.from));
    const added: IMutableEntry<TX>[] = [];
    let first = this.entries[0];
    for (const cut of sorted) {
      if (domain.compare(cut.to, cut.from) <= 0) {
        continue;
      }
      if (!isNil(first) && domain.compare(cut.to, first.from) >= 0) {
        const from = minOf(domain, cut.from, first.from);
        first.removedBefore = domain.minus(first.removedBefore, domain.minus(first.from, from));
        first.from = from;
        continue;
      }
      const removedBefore = isNil(first)
        ? domain.zero
        : domain.minus(first.removedBefore, domain.minus(cut.to, cut.from));
      first = {
        from: cut.from,
        to: cut.to,
        removedBefore,
        at: domain.minus(cut.from, removedBefore),
      };
      added.push(first);
    }
    this.entries = [...added.reverse(), ...this.entries];
  }

  private strideStart(world: TX): TX {
    const { domain, supply } = this;
    if (isNil(supply)) {
      return world;
    }
    const strides = Math.floor(domain.diff(world, domain.zero) / supply.stride);
    return domain.add(domain.zero, strides * supply.stride);
  }
}
