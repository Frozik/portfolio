import { observer } from 'mobx-react-lite';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { assert } from '@frozik/utils/assert/assert';

import type { TMenuItem } from '../../../core/kernel/menu';
import type { IContextMenuSlice } from '../../../extensions/context-menu/core';
import { useTableContext } from '../../context';
import type { IViewContext } from '../../slots';

const MENU_WIDTH = 240;
const EDGE_GAP = 8;

type TEntry = Exclude<TMenuItem, { readonly separator: true }>;

function isEntry(item: TMenuItem): item is TEntry {
  return !('separator' in item);
}

function isDisabled(item: TEntry): boolean {
  return item.disabled !== undefined && item.disabled !== false;
}

/** The open menu: a positioned list with arrow keys, Enter, Escape and outside clicks. */
export const MenuPopover = observer(function MenuPopover<TRow>({ table }: IViewContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const slice = table.extension<IContextMenuSlice<TRow>>('contextMenu');
  assert(slice !== undefined, 'MenuPopover renders only with the contextMenu extension');
  const open = slice.open;
  const menuRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (open === null) {
      return undefined;
    }
    setActive(open.items.findIndex(isEntry));
    menuRef.current?.focus();
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target) !== true) {
        slice.close();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, slice]);

  const run = useEventCallback((item: TEntry) => {
    if (isDisabled(item)) {
      return;
    }
    slice.close();
    item.run();
  });

  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (open === null) {
      return;
    }
    const entries = open.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => isEntry(item));
    const at = entries.findIndex(({ index }) => index === active);
    switch (event.key) {
      case 'ArrowDown':
        setActive(entries[(at + 1) % entries.length]?.index ?? active);
        break;
      case 'ArrowUp':
        setActive(entries[(at - 1 + entries.length) % entries.length]?.index ?? active);
        break;
      case 'Enter':
      case ' ': {
        const item = open.items[active];
        if (item !== undefined && isEntry(item)) {
          run(item);
        }
        break;
      }
      case 'Escape':
        slice.close();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  });

  if (open === null) {
    return null;
  }
  const rootWidth = menuRef.current?.parentElement?.clientWidth;
  const left =
    rootWidth === undefined
      ? open.position.left
      : Math.max(EDGE_GAP, Math.min(open.position.left, rootWidth - MENU_WIDTH - EDGE_GAP));
  const style: CSSProperties = { left, top: open.position.top, width: MENU_WIDTH };
  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className="ft-menu"
      style={style}
      onKeyDown={handleKeyDown}
    >
      {open.items.map((item, index) =>
        isEntry(item) ? (
          <div
            key={item.id}
            role="menuitem"
            tabIndex={-1}
            className="ft-menu-item"
            aria-disabled={isDisabled(item)}
            data-active={index === active ? '' : undefined}
            data-danger={item.danger === true ? '' : undefined}
            title={
              typeof item.disabled === 'string'
                ? (translations.reasons[item.disabled] ?? item.disabled)
                : undefined
            }
            onMouseEnter={() => setActive(index)}
            onClick={() => run(item)}
          >
            {translations.menu[item.label] ?? item.label}
          </div>
        ) : (
          <div key={`separator-${index}`} role="separator" className="ft-menu-separator" />
        )
      )}
    </div>
  );
});
