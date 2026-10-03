import { isNil, isPlainObject } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { IColumnTitle, TPinSide } from '../../core/columns/column';
import type { IColumnDragPort } from '../../core/columns/column-drag-port';
import { COLUMN_MOVE_ID } from '../../core/columns/column-drag-port';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TMenuItem } from '../../core/kernel/menu';

export interface IColumnGroupDefinition {
  readonly id: string;
  readonly title: string | IColumnTitle;
  readonly columns: readonly (string | IColumnGroupDefinition)[];
}

export interface IColumnGroupsOptions {
  readonly groups: readonly IColumnGroupDefinition[];
}

/** One cell of a group header row: the group over a run of adjacent visible columns, or a gap. */
export interface IGroupHeaderSpan {
  readonly group: IColumnGroupDefinition | undefined;
  readonly columnIds: readonly string[];
}

export interface IColumnGroupsSlice {
  readonly depth: number;
  /** Columns moved into another group or out of theirs; `null` is "no group". Part of the table state. */
  readonly membership: ReadonlyMap<string, string | null>;
  pathOf(columnId: string): readonly IColumnGroupDefinition[];
  /** Spans of one header level over the visible columns, in visible order. */
  level(levelIndex: number): readonly IGroupHeaderSpan[];
  pinGroup(groupId: string, side: TPinSide | null): TCommandOutcome;
  /** The columns currently in the group, in column order. */
  leavesOf(groupId: string): readonly string[];
  /** Puts the column into the group (`null`: out of any); the definition's own placement clears the entry. */
  setGroup(columnId: string, groupId: string | null): void;
  /** The group a column dropped between two neighbours belongs to: the deepest group both share. */
  groupForSlot(columnId: string, toIndex: number): string | null;
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

function pathToGroup(
  groups: readonly IColumnGroupDefinition[],
  groupId: string,
  trail: readonly IColumnGroupDefinition[] = []
): readonly IColumnGroupDefinition[] | undefined {
  for (const group of groups) {
    const path = [...trail, group];
    if (group.id === groupId) {
      return path;
    }
    const nested = pathToGroup(
      group.columns.filter(
        (member): member is IColumnGroupDefinition => typeof member !== 'string'
      ),
      groupId,
      path
    );
    if (nested !== undefined) {
      return nested;
    }
  }
  return undefined;
}

function commonPrefix(
  left: readonly IColumnGroupDefinition[],
  right: readonly IColumnGroupDefinition[]
): readonly IColumnGroupDefinition[] {
  const shared: IColumnGroupDefinition[] = [];
  for (const [level, group] of left.entries()) {
    if (right[level] !== group) {
      break;
    }
    shared.push(group);
  }
  return shared;
}

class ColumnGroupsSlice<TRow> implements IColumnGroupsSlice {
  membership: ReadonlyMap<string, string | null> = new Map();
  private readonly definedPaths = new Map<string, readonly IColumnGroupDefinition[]>();
  private readonly groups: readonly IColumnGroupDefinition[];

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IColumnGroupsOptions
  ) {
    this.groups = options.groups;
    collectPaths(options.groups, [], this.definedPaths);
    makeAutoObservable<ColumnGroupsSlice<TRow>, 'kernel' | 'definedPaths' | 'groups' | 'landingOf'>(
      this,
      {
        kernel: false,
        definedPaths: false,
        groups: false,
        pathOf: false,
        landingOf: false,
        joinedGroup: false,
        level: false,
        leavesOf: false,
        groupForSlot: false,
      },
      { autoBind: true }
    );
  }

  get depth(): number {
    let depth = 0;
    for (const path of this.definedPaths.values()) {
      depth = Math.max(depth, path.length);
    }
    return depth;
  }

  pathOf(columnId: string): readonly IColumnGroupDefinition[] {
    const landing = this.landingOf(columnId);
    const moved = landing === undefined ? this.membership.get(columnId) : landing;
    if (moved === undefined) {
      return this.definedPaths.get(columnId) ?? [];
    }
    return moved === null ? [] : (pathToGroup(this.groups, moved) ?? []);
  }

  /** A column mid-drag already shows the membership its drop would give it. */
  private landingOf(columnId: string): string | null | undefined {
    const drag = this.kernel.extension<IColumnDragPort>(COLUMN_MOVE_ID)?.drag;
    if (drag?.columnId !== columnId || drag.targetIndex === undefined) {
      return undefined;
    }
    return this.joinedGroup(columnId, drag.targetIndex, drag.targetGroup);
  }

  /** The group a column landing at the slot belongs to: the one named, else whatever its neighbours share. */
  joinedGroup(
    columnId: string,
    toIndex: number,
    groupId: string | null | undefined
  ): string | null {
    return groupId === undefined ? this.groupForSlot(columnId, toIndex) : groupId;
  }

  leavesOf(groupId: string): readonly string[] {
    return this.kernel.columns.orderedIds.filter(id =>
      this.pathOf(id).some(group => group.id === groupId)
    );
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

  setGroup(columnId: string, groupId: string | null): void {
    const defined = this.definedPaths.get(columnId)?.at(-1)?.id ?? null;
    const membership = new Map(this.membership);
    if (groupId === defined) {
      membership.delete(columnId);
    } else {
      membership.set(columnId, groupId);
    }
    this.membership = membership;
  }

  groupForSlot(columnId: string, toIndex: number): string | null {
    const { orderedIds, visibleById } = this.kernel.columns;
    const section = visibleById.get(columnId)?.section;
    const others = orderedIds.filter(
      id => id !== columnId && visibleById.get(id)?.section === section
    );
    const left = others[toIndex - 1];
    const right = others[toIndex];
    if (left === undefined || right === undefined) {
      return null;
    }
    return commonPrefix(this.pathOf(left), this.pathOf(right)).at(-1)?.id ?? null;
  }

  applyMembership(value: unknown): void {
    if (!isPlainObject(value)) {
      return;
    }
    const entries = Object.entries(value as Record<string, unknown>).flatMap(
      ([columnId, groupId]): [string, string | null][] =>
        groupId === null || typeof groupId === 'string' ? [[columnId, groupId]] : []
    );
    this.membership = new Map(entries);
  }

  clearMembership(): void {
    this.membership = new Map();
  }
}

export function columnGroups<TRow = never>(
  options: IColumnGroupsOptions
): ITableExtension<TRow, 'columnGroups', IColumnGroupsSlice> {
  return {
    id: 'columnGroups',
    create(kernel): IExtensionInstance<TRow, IColumnGroupsSlice> {
      const slice = new ColumnGroupsSlice(kernel, options);
      const pinItem = (groupId: string, side: TPinSide | null): TMenuItem => {
        const leaves = slice.leavesOf(groupId);
        const refused = leaves
          .map(id => kernel.commands.reasonAgainst('columns.pin', { columnId: id, side }))
          .find(reason => !isNil(reason));
        return {
          id: `columnGroups.pin.${side ?? 'none'}`,
          label: `menu.columnGroup.pin.${side ?? 'none'}`,
          section: 'columns',
          disabled:
            leaves.every(id => (kernel.columns.pinOf(id) ?? null) === side) || (refused ?? false),
          run: () => void slice.pinGroup(groupId, side),
        };
      };
      const hideItem = (groupId: string): TMenuItem => {
        const shown = slice.leavesOf(groupId).filter(
          id =>
            !kernel.columns.isHidden(id) &&
            kernel.commands.reasonAgainst('columns.setVisible', {
              columnId: id,
              visible: false,
            }) === undefined
        );
        return {
          id: 'columnGroups.hide',
          label: 'menu.columnGroup.hide',
          section: 'columns',
          disabled: shown.length === 0,
          run: () => {
            for (const id of shown) {
              kernel.columns.setVisible(id, false);
            }
          },
        };
      };
      const stopListening = kernel.events.on('columnMove.drop', ({ columnId, toIndex, groupId }) =>
        slice.setGroup(columnId, slice.joinedGroup(columnId, toIndex, groupId))
      );
      return {
        slice,
        state: {
          read: () => Object.fromEntries(slice.membership),
          write: value => slice.applyMembership(value),
          reset: () => slice.clearMembership(),
        },
        menu: ({ target, groupId }) =>
          target !== 'group' || groupId === undefined
            ? []
            : [
                pinItem(groupId, 'left'),
                pinItem(groupId, 'right'),
                pinItem(groupId, null),
                hideItem(groupId),
              ],
        dispose: stopListening,
      };
    },
  };
}
