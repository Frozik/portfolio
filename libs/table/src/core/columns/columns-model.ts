import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { EventBus } from '@frozik/utils/events/event-bus';
import type { CommandBus, TCommandOutcome } from '../kernel/command-bus';
import type { ITableCommands, ITableEvents } from '../kernel/contracts';
import type { IColumnLock, TAnyColumn, TPinSide } from './column';
import { mergeColumnOrder, moveToSlot } from './column-order';
import type { IColumnState, TWidthAuthor } from './column-state';
import { resolveWidths } from './column-widths';

export type TColumnSection = 'left' | 'center' | 'right';

export interface IColumnLayout<TRow> {
  readonly id: string;
  readonly definition: TAnyColumn<TRow>;
  readonly section: TColumnSection;
  readonly index: number;
  readonly width: number;
  readonly offset: number;
  /** Distance from the edge the column sticks to; `undefined` for the scrolling centre. */
  readonly stickyOffset: number | undefined;
}

/** A move shown in the layout before it is committed: a column mid-drag stands where it would land. */
export interface IColumnMovePreview {
  readonly columnId: string;
  readonly toIndex: number;
}

/** Room the scrolling centre keeps even when everything else is pinned. */
const MIN_CENTER_WIDTH = 80;

const SECTION_ORDER: readonly TColumnSection[] = ['left', 'center', 'right'];

/**
 * The Columns aggregate: definitions as declared, the state the user changed,
 * and the layout derived from both. Every change goes through a command so
 * locks and application guards apply uniformly.
 */
export class ColumnsModel<TRow> {
  private definitions: readonly TAnyColumn<TRow>[];
  private serviceColumns: readonly TAnyColumn<TRow>[] = [];
  private states = new Map<string, IColumnState>();
  private order: readonly string[] | undefined = undefined;
  preview: IColumnMovePreview | null = null;
  private viewportWidth: number | undefined = undefined;

  constructor(
    definitions: readonly TAnyColumn<TRow>[],
    private readonly commands: CommandBus<ITableCommands>,
    private readonly events: EventBus<ITableEvents>
  ) {
    this.definitions = definitions;
    makeAutoObservable<
      ColumnsModel<TRow>,
      'commands' | 'events' | 'sectionOf' | 'lockReason' | 'placed'
    >(
      this,
      {
        commands: false,
        events: false,
        stateOf: false,
        isService: false,
        pinOf: false,
        isHidden: false,
        flexOf: false,
        sectionOf: false,
        lockReason: false,
        placed: false,
      },
      { autoBind: true }
    );
    this.registerGuards();
  }

  get all(): readonly TAnyColumn<TRow>[] {
    return [...this.serviceColumns, ...this.definitions];
  }

  get byId(): ReadonlyMap<string, TAnyColumn<TRow>> {
    return new Map(this.all.map(column => [column.id, column]));
  }

  /** The declared columns as committed: what the state carries; a previewed move shows in `orderedIds` only. */
  private get committedIds(): readonly string[] {
    return mergeColumnOrder(
      this.definitions.map(column => column.id),
      this.order
    );
  }

  get orderedIds(): readonly string[] {
    const serviceIds = this.serviceColumns.map(column => column.id);
    const own =
      this.preview === null ? this.committedIds : this.placed(this.committedIds, this.preview);
    return [...serviceIds, ...own];
  }

  stateOf(columnId: string): IColumnState {
    return this.states.get(columnId) ?? { id: columnId };
  }

  pinOf(columnId: string): TPinSide | undefined {
    const state = this.stateOf(columnId);
    if (state.pin !== undefined) {
      return state.pin ?? undefined;
    }
    return this.byId.get(columnId)?.pin;
  }

  isHidden(columnId: string): boolean {
    return this.stateOf(columnId).hidden ?? this.byId.get(columnId)?.hidden ?? false;
  }

  /** A column shares the free space unless a width was authored for it: a dragged or fitted width ends its flex. */
  flexOf(columnId: string): number | undefined {
    const state = this.stateOf(columnId);
    return state.width === undefined ? (state.flex ?? this.byId.get(columnId)?.flex) : undefined;
  }

  /** Contributed by an extension (a checkbox, a row number): pinned first, never sorted, copied or exported. */
  isService(columnId: string): boolean {
    return this.serviceColumns.some(column => column.id === columnId);
  }

  private sectionOf(columnId: string): TColumnSection {
    if (this.isService(columnId)) {
      return 'left';
    }
    return this.pinOf(columnId) ?? 'center';
  }

  get visibleIds(): readonly string[] {
    const ids = this.orderedIds.filter(id => !this.isHidden(id));
    return SECTION_ORDER.flatMap(section => ids.filter(id => this.sectionOf(id) === section));
  }

  get visible(): readonly IColumnLayout<TRow>[] {
    const widths = resolveWidths(
      this.visibleIds.map(id => {
        const definition = this.byId.get(id);
        const state = this.stateOf(id);
        return {
          id,
          width: state.width ?? definition?.width,
          flex: this.flexOf(id),
          minWidth: definition?.minWidth,
          maxWidth: definition?.maxWidth,
        };
      }),
      this.viewportWidth
    );
    const layouts: IColumnLayout<TRow>[] = [];
    let offset = 0;
    for (const id of this.visibleIds) {
      const definition = this.byId.get(id);
      const width = widths.get(id);
      if (definition === undefined || width === undefined) {
        continue;
      }
      layouts.push({
        id,
        definition,
        section: this.sectionOf(id),
        index: layouts.length,
        width,
        offset,
        stickyOffset: undefined,
      });
      offset += width;
    }
    return withStickyOffsets(layouts);
  }

  get visibleById(): ReadonlyMap<string, IColumnLayout<TRow>> {
    return new Map(this.visible.map(layout => [layout.id, layout]));
  }

  get totalWidth(): number {
    return this.visible.reduce((sum, layout) => sum + layout.width, 0);
  }

  get state(): readonly IColumnState[] {
    return this.committedIds.map(id => this.stateOf(id));
  }

  setDefinitions(definitions: readonly TAnyColumn<TRow>[]): void {
    this.definitions = definitions;
    this.events.emit('columns.changed', { columnId: undefined });
  }

  setServiceColumns(columns: readonly TAnyColumn<TRow>[]): void {
    this.serviceColumns = columns;
  }

  setViewportWidth(width: number | undefined): void {
    this.viewportWidth = width;
  }

  /** `toIndex` is a slot among the visible columns of the column's section, itself excluded: where a dragged column stands. */
  move(columnId: string, toIndex: number): TCommandOutcome {
    return this.commands.run('columns.move', { columnId, toIndex }, () => {
      this.order = this.placed(this.committedIds, { columnId, toIndex });
      this.events.emit('columns.changed', { columnId });
    });
  }

  previewMove(columnId: string, toIndex: number): void {
    this.preview = { columnId, toIndex };
  }

  clearPreview(): void {
    this.preview = null;
  }

  pin(columnId: string, side: TPinSide | null): TCommandOutcome {
    return this.commands.run('columns.pin', { columnId, side }, () => {
      this.patch(columnId, { pin: side });
    });
  }

  setVisible(columnId: string, visible: boolean): TCommandOutcome {
    return this.commands.run('columns.setVisible', { columnId, visible }, () => {
      this.patch(columnId, { hidden: !visible });
    });
  }

  resize(columnId: string, width: number, by: TWidthAuthor = 'user'): TCommandOutcome {
    return this.commands.run('columns.resize', { columnId, width }, () => {
      this.patch(columnId, { width, widthBy: by, flex: undefined });
    });
  }

  applyState(columns: readonly IColumnState[]): void {
    this.states = new Map(columns.map(state => [state.id, state]));
    this.order = columns.map(state => state.id);
    this.events.emit('columns.changed', { columnId: undefined });
  }

  reset(): TCommandOutcome {
    return this.commands.run('columns.reset', {}, () => {
      this.states = new Map();
      this.order = undefined;
      this.events.emit('columns.changed', { columnId: undefined });
    });
  }

  /** The slot is counted among the visible columns of the column's own section, so it is the same before and after the move. */
  private placed(
    order: readonly string[],
    { columnId, toIndex }: IColumnMovePreview
  ): readonly string[] {
    const section = this.sectionOf(columnId);
    const slots = order.filter(
      id => id !== columnId && !this.isHidden(id) && this.sectionOf(id) === section
    );
    return moveToSlot(order, columnId, slots, toIndex);
  }

  private patch(columnId: string, change: Partial<IColumnState>): void {
    this.states.set(columnId, { ...this.stateOf(columnId), ...change, id: columnId });
    this.events.emit('columns.changed', { columnId });
  }

  private lockReason(columnId: string, lock: keyof IColumnLock): string | undefined {
    return this.byId.get(columnId)?.lock?.[lock] === true ? `lock.${lock}` : undefined;
  }

  private registerGuards(): void {
    this.commands.guard('columns.move', ({ columnId }) => this.lockReason(columnId, 'move'));
    this.commands.guard('columns.pin', ({ columnId }) => this.lockReason(columnId, 'pin'));
    this.commands.guard('columns.resize', ({ columnId }) => this.lockReason(columnId, 'resize'));
    this.commands.guard('columns.setVisible', ({ columnId, visible }) => {
      if (this.lockReason(columnId, 'hide') !== undefined) {
        return 'lock.hide';
      }
      const hidesLast = !visible && this.visibleIds.length === 1 && this.visibleIds[0] === columnId;
      return hidesLast ? 'columns.lastVisible' : undefined;
    });
    this.commands.guard('columns.pin', ({ columnId, side }) => {
      if (isNil(side) || isNil(this.viewportWidth)) {
        return undefined;
      }
      const pinnedWidth = this.visible
        .filter(layout => layout.section !== 'center' || layout.id === columnId)
        .reduce((sum, layout) => sum + layout.width, 0);
      return pinnedWidth > this.viewportWidth - MIN_CENTER_WIDTH ? 'columns.pinWidth' : undefined;
    });
  }
}

function withStickyOffsets<TRow>(
  layouts: readonly IColumnLayout<TRow>[]
): readonly IColumnLayout<TRow>[] {
  let leftOffset = 0;
  let rightOffset = 0;
  const fromLeft = layouts.map(layout => {
    if (layout.section !== 'left') {
      return layout;
    }
    const withOffset = { ...layout, stickyOffset: leftOffset };
    leftOffset += layout.width;
    return withOffset;
  });
  return fromLeft
    .slice()
    .reverse()
    .map(layout => {
      if (layout.section !== 'right') {
        return layout;
      }
      const withOffset = { ...layout, stickyOffset: rightOffset };
      rightOffset += layout.width;
      return withOffset;
    })
    .reverse();
}
