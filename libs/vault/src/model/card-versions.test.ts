import { assert } from '@frozik/utils/assert/assert';

import { mergeCard } from '../merge/merge-card';
import { aCardWith, aField, anHlc } from '../testing/builders';
import type { IVaultCard } from './card';
import { allFields } from './card';
import { renameCard } from './card-edits';
import { concurrentVersions, resolveConcurrentVersions } from './card-versions';
import { setFieldValue } from './field-edits';
import { commitCard, HISTORY_THROTTLE_MS } from './revision-edits';

const MINUTE = 60_000;
const note = aField({ kind: 'note' }, 'base note');
const start = aCardWith([note], { title: 'Bank', updatedAt: anHlc(0), createdAt: anHlc(0) });

function edit(card: IVaultCard, wallMs: number, node: string, title: string): IVaultCard {
  return commitCard(card, renameCard(card, title), anHlc(wallMs, node));
}

describe('card versions', () => {
  it('see no conflict in edits one after another, even across devices', () => {
    const onA = edit(start, HISTORY_THROTTLE_MS, 'a:1', 'First');
    const onBAfterSync = edit(onA, 3 * HISTORY_THROTTLE_MS, 'b:1', 'Second');

    expect(concurrentVersions(mergeCard(onA, onBAfterSync))).toEqual([]);
  });

  it('see a conflict in edits made at the same time, on both devices alike', () => {
    const onA = edit(start, HISTORY_THROTTLE_MS, 'a:1', 'Mine');
    const onB = edit(start, 2 * HISTORY_THROTTLE_MS, 'b:1', 'Theirs');

    const mergedOnA = mergeCard(onA, onB);
    const mergedOnB = mergeCard(onB, onA);

    expect(mergedOnA).toEqual(mergedOnB);
    expect(mergedOnA.title).toBe('Theirs');
    expect(concurrentVersions(mergedOnA).map(revision => revision.snapshot.title)).toEqual([
      'Mine',
    ]);
  });

  it('know a quick edit that never made it into history as an ancestor, not as a concurrent edit', () => {
    const first = edit(start, MINUTE, 'a:1', 'One');
    const quick = edit(first, 2 * MINUTE, 'a:1', 'Two');

    expect(quick.history).toEqual(first.history);

    expect(quick.ancestors).toContainEqual(first.updatedAt);
    expect(concurrentVersions(mergeCard(quick, first))).toEqual([]);
  });

  it('are resolved by a version with every side as a parent, the same on every device', () => {
    const onA = edit(start, HISTORY_THROTTLE_MS, 'a:1', 'Mine');
    const onB = edit(start, 2 * HISTORY_THROTTLE_MS, 'b:1', 'Theirs');
    const merged = mergeCard(onA, onB);

    const kept = resolveConcurrentVersions(
      merged,
      { kind: 'keep-current', version: onA.updatedAt },
      anHlc(5 * HISTORY_THROTTLE_MS, 'b:1')
    );
    const taken = resolveConcurrentVersions(
      merged,
      { kind: 'take', version: onA.updatedAt },
      anHlc(5 * HISTORY_THROTTLE_MS, 'a:1')
    );

    expect(concurrentVersions(kept)).toEqual([]);
    expect(kept.title).toBe('Theirs');
    expect(taken.title).toBe('Mine');
    expect(concurrentVersions(mergeCard(kept, onA))).toEqual([]);
  });

  it('combine both concurrent changes from their common ancestor', () => {
    const renamed = commitCard(
      start,
      renameCard(start, 'Renamed'),
      anHlc(HISTORY_THROTTLE_MS, 'a:1')
    );
    const noteChanged = commitCard(
      start,
      setFieldValue(start, note.id, { cardinality: 'single', value: 'their note' }),
      anHlc(2 * HISTORY_THROTTLE_MS, 'b:1')
    );
    const merged = mergeCard(renamed, noteChanged);
    const [concurrent] = concurrentVersions(merged);
    assert(concurrent !== undefined);

    const combined = resolveConcurrentVersions(
      merged,
      { kind: 'combine', version: concurrent.at, choices: new Map() },
      anHlc(5 * HISTORY_THROTTLE_MS, 'b:1')
    );

    expect(combined.title).toBe('Renamed');
    expect(allFields(combined)[0]?.value).toEqual({ cardinality: 'single', value: 'their note' });
    expect(concurrentVersions(combined)).toEqual([]);
  });

  it('list only the newest version of a concurrent branch, not the ones it superseded', () => {
    const onA = edit(start, HISTORY_THROTTLE_MS, 'a:1', 'Mine');
    const b1 = edit(start, 2 * HISTORY_THROTTLE_MS, 'b:1', 'B1');
    const b2 = edit(b1, 4 * HISTORY_THROTTLE_MS, 'b:1', 'B2');
    const merged = mergeCard(b2, edit(onA, 5 * HISTORY_THROTTLE_MS, 'a:1', 'Mine again'));

    expect(concurrentVersions(merged).map(revision => revision.snapshot.title)).toEqual(['B2']);
  });

  it('take the current, fresher version for a clash the user left undecided', () => {
    const onA = edit(start, HISTORY_THROTTLE_MS, 'a:1', 'Older title');
    const onB = edit(start, 2 * HISTORY_THROTTLE_MS, 'b:1', 'Newer title');
    const merged = mergeCard(onA, onB);
    const [concurrent] = concurrentVersions(merged);
    assert(concurrent !== undefined);

    const combined = resolveConcurrentVersions(
      merged,
      { kind: 'combine', version: concurrent.at, choices: new Map() },
      anHlc(9 * HISTORY_THROTTLE_MS, 'b:1')
    );

    expect(combined.title).toBe('Newer title');
  });

  it('settle only the version decided about: a third device’s stays to be asked about', () => {
    const onA = edit(start, HISTORY_THROTTLE_MS, 'a:1', 'From A');
    const onB = edit(start, 2 * HISTORY_THROTTLE_MS, 'b:1', 'From B');
    const onC = edit(start, 3 * HISTORY_THROTTLE_MS, 'c:1', 'From C');
    const merged = mergeCard(mergeCard(onA, onB), onC);
    expect(concurrentVersions(merged)).toHaveLength(2);

    const one = resolveConcurrentVersions(
      merged,
      { kind: 'keep-current', version: onA.updatedAt },
      anHlc(5 * HISTORY_THROTTLE_MS, 'c:1')
    );

    expect(concurrentVersions(one).map(revision => revision.at)).toEqual([onB.updatedAt]);
  });
});
