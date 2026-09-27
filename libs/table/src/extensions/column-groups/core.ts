import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { IColumnTitle, TPinSide } from '../../core/columns/column';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';

const MARRIED_REASON = 'columnGroups.married';

export interface IColumnGroupDefinition {
  readonly id: string;
  readonly title: string | IColumnTitle;
  readonly columns: readonly (string | IColumnGroupDefinition)[];
}

export interface IColumnGroupsOptions {
  readonly groups: readonly IColumnGroupDefinition[];
  /** Columns of a group move together and nothing moves in between; on by default. */
  readonly marryChildren?: boolean;
}

/** One cell of a group header row: the group over a run of adjacent visible columns, or a gap. */
export interface IGroupHeaderSpan {
  readonly group: IColumnGroupDefinition | undefined;
  readonly columnIds: readonly string[];
}

export interface IColumnGroupsSlice {
  readonly depth: number;
  pathOf(columnId: string): readonly IColumnGroupDefinition[];
  /** Spans of one header level over the visible columns, in visible order. */
  level(levelIndex: number): readonly IGroupHeaderSpan[];
  pinGroup(groupId: string, side: TPinSide | null): TCommandOutcome;
  leavesOf(groupId: string): readonly string[];
}

function collectPaths(
  groups: readonly IColumnGroupDefinition[],
  trail: readonly IColumnGroupDefinition[],
  into: Map<string, readonly IColumnGroupDefinition[]>
): void {
  for (const group of groups) {
    const path = [...trail, group];
    for (const member of group.columns) {
      if (typeof member === 'string') {
        into.set(member, path);
      } else {
        collectPaths([member], path, into);
      }
    }
  }
}

function findGroup(
  groups: readonly IColumnGroupDefinition[],
  groupId: string
): IColumnGroupDefinition | undefined {
  for (const group of groups) {
    if (group.id === groupId) {
      return group;
    }
    const nested = findGroup(
      group.columns.filter(
        (member): member is IColumnGroupDefinition => typeof member !== 'string'
      ),
      groupId
    );
    if (nested !== undefined) {
      return nested;
    }
  }
  return undefined;
}

function leavesOf(group: IColumnGroupDefinition): readonly string[] {
  return group.columns.flatMap(member =>
    typeof member === 'string' ? [member] : leavesOf(member)
  );
}

class ColumnGroupsSlice<TRow> implements IColumnGroupsSlice {
  private readonly paths = new Map<string, readonly IColumnGroupDefinition[]>();
  private readonly groups: readonly IColumnGroupDefinition[];

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IColumnGroupsOptions
  ) {
    this.groups = options.groups;
    collectPaths(options.groups, [], this.paths);
    makeAutoObservable<ColumnGroupsSlice<TRow>, 'kernel' | 'paths' | 'groups'>(
      this,
      { kernel: false, paths: false, groups: false, pathOf: false, level: false, leavesOf: false },
      { autoBind: true }
    );
  }

  get depth(): number {
    let depth = 0;
    for (const path of this.paths.values()) {
      depth = Math.max(depth, path.length);
    }
    return depth;
  }

  pathOf(columnId: string): readonly IColumnGroupDefinition[] {
    return this.paths.get(columnId) ?? [];
  }

  leavesOf(groupId: string): readonly string[] {
    const group = findGroup(this.groups, groupId);
    return group === undefined ? [] : leavesOf(group);
  }

  level(levelIndex: number): readonly IGroupHeaderSpan[] {
    const spans: IGroupHeaderSpan[] = [];
    for (const layout of this.kernel.columns.visible) {
      const group = this.pathOf(layout.id)[levelIndex];
      const last = spans.at(-1);
      if (
        last !== undefined &&
        last.group === group &&
        (group !== undefined || last.group === undefined)
      ) {
        spans[spans.length - 1] = { group, columnIds: [...last.columnIds, layout.id] };
      } else {
        spans.push({ group, columnIds: [layout.id] });
      }
    }
    return spans;
  }

  pinGroup(groupId: string, side: TPinSide | null): TCommandOutcome {
    for (const columnId of this.leavesOf(groupId)) {
      const outcome = this.kernel.columns.pin(columnId, side);
      if (!outcome.ok) {
        return outcome;
      }
    }
    return { ok: true };
  }

  /**
   * A move keeps married columns adjacent: the column stays inside the run
   * of every group it belongs to and never lands between two columns that
   * share a group it is not part of.
   */
  moveReason(columnId: string, toIndex: number): string | undefined {
    const { visibleById, orderedIds } = this.kernel.columns;
    const section = visibleById.get(columnId)?.section;
    if (isNil(section)) {
      return undefined;
    }
    const others = orderedIds.filter(
      id => id !== columnId && visibleById.get(id)?.section === section
    );
    const path = this.pathOf(columnId);
    for (const [level, group] of path.entries()) {
      const run = others.flatMap((id, index) => (this.pathOf(id)[level] === group ? [index] : []));
      const first = run[0];
      const last = run.at(-1);
      if (first !== undefined && last !== undefined && (toIndex < first || toIndex > last + 1)) {
        return MARRIED_REASON;
      }
    }
    const left = others[toIndex - 1];
    const right = others[toIndex];
    if (left === undefined || right === undefined) {
      return undefined;
    }
    const leftPath = this.pathOf(left);
    const rightPath = this.pathOf(right);
    const splitsForeignGroup = leftPath.some(
      (group, level) => rightPath[level] === group && path[level] !== group
    );
    return splitsForeignGroup ? MARRIED_REASON : undefined;
  }
}

export function columnGroups<TRow = never>(
  options: IColumnGroupsOptions
): ITableExtension<TRow, 'columnGroups', IColumnGroupsSlice> {
  return {
    id: 'columnGroups',
    create(kernel): IExtensionInstance<TRow, IColumnGroupsSlice> {
      const slice = new ColumnGroupsSlice(kernel, options);
      const married = options.marryChildren ?? true;
      return {
        slice,
        guards: married
          ? { 'columns.move': ({ columnId, toIndex }) => slice.moveReason(columnId, toIndex) }
          : undefined,
        dispose: () => undefined,
      };
    },
  };
}
