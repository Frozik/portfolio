import { virtualWindow } from '@frozik/table/extensions/grid-view/virtual-window';
import type { IVaultCard } from '@frozik/vault/model/card';
import type { TCardId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { KeyboardEvent, UIEvent } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { CardListRow } from './CardListRow';
import { nextActiveIndex } from './list-navigation';

const ROW_HEIGHT = 56;

/**
 * The card list: only the rows in sight are in the DOM, over
 * the table library's pure window maths. One tab stop; the arrows, Page
 * Up/Down and Home/End move the active row (`aria-activedescendant`), Enter
 * opens it. The order is the view's — the list never sorts or filters.
 */
export const VirtualCardList = observer(
  ({
    view,
    selectedId,
    modifiedId,
    onOpen,
    onSearchArchive,
    importTo,
  }: {
    readonly view: VaultView;
    readonly selectedId: TCardId | null;
    /** The card with changes not saved yet: an open draft, or one left by a lock. */
    readonly modifiedId: TCardId | null;
    readonly onOpen: (card: IVaultCard) => void;
    /** "Nothing found" offers the archive, which the other sections leave out. */
    readonly onSearchArchive: (() => void) | null;
    /** An empty vault offers an import, which lives in the settings. */
    readonly importTo: string | null;
  }) => {
    const cards = view.visibleCards;
    const listId = useId();
    const container = useRef<HTMLDivElement>(null);
    const [viewportHeight, setViewportHeight] = useState(0);
    const hasCards = cards.length > 0;
    const [scrollTop, setScrollTop] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const heights = useMemo(() => cards.map(() => ROW_HEIGHT), [cards]);
    const visible = virtualWindow({ heights, scrollTop, viewportHeight });
    const active = Math.min(activeIndex, Math.max(0, cards.length - 1));

    useEffect(() => {
      const element = container.current;
      if (isNil(element)) {
        return undefined;
      }
      const observer = new ResizeObserver(([entry]) =>
        setViewportHeight(entry?.contentRect.height ?? 0)
      );
      observer.observe(element);
      return () => observer.disconnect();
    }, [hasCards]);

    useEffect(() => {
      const selected = cards.findIndex(card => card.id === selectedId);
      if (selected >= 0) {
        setActiveIndex(selected);
      }
    }, [cards, selectedId]);

    const scrollIntoView = (index: number): void => {
      const element = container.current;
      if (isNil(element)) {
        return;
      }
      const top = index * ROW_HEIGHT;
      if (top < element.scrollTop) {
        element.scrollTop = top;
      } else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
        element.scrollTop = top + ROW_HEIGHT - element.clientHeight;
      }
    };

    const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
      const card = cards[active];
      if (event.key === 'Enter' && !isNil(card)) {
        event.preventDefault();
        onOpen(card);
        return;
      }
      const pageSize = Math.max(1, Math.floor(viewportHeight / ROW_HEIGHT));
      const next = nextActiveIndex(event.key, active, cards.length, pageSize);
      if (isNil(next)) {
        return;
      }
      event.preventDefault();
      setActiveIndex(next);
      scrollIntoView(next);
    });

    const handleScroll = useEventCallback((event: UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
    });

    if (!hasCards) {
      const nothingFound = view.query !== '';
      return (
        <div className="flex flex-col items-start gap-2 px-4 py-6">
          <p className="text-[14px] text-landing-fg-dim">
            {nothingFound ? vaultT.list.nothingFound : vaultT.list.empty}
          </p>
          {nothingFound && !isNil(onSearchArchive) && (
            <Button type="button" variant="secondary" size="sm" onClick={onSearchArchive}>
              {vaultT.shortcuts.searchArchive}
            </Button>
          )}
          {!nothingFound && !isNil(importTo) && (
            <NavLink to={importTo} className="text-[13px] text-landing-fg underline">
              {vaultT.list.importCards}
            </NavLink>
          )}
        </div>
      );
    }

    const rows = cards.slice(visible.startIndex, visible.endIndex + 1);
    return (
      <div
        ref={container}
        id={listId}
        role="listbox"
        aria-label={vaultT.list.label}
        aria-activedescendant={`${listId}-${active}`}
        tabIndex={0}
        className="relative min-h-0 flex-1 overflow-y-auto focus-visible:outline-none"
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
      >
        <div className="relative" style={{ height: visible.totalHeight }}>
          {rows.map((card, offset) => {
            const index = visible.startIndex + offset;
            return (
              <CardListRow
                key={card.id}
                id={`${listId}-${index}`}
                card={card}
                expiry={view.expiryOf(card)}
                siteIcon={view.siteIconOf(card)}
                selected={card.id === selectedId}
                modified={card.id === modifiedId}
                active={index === active}
                top={index * ROW_HEIGHT}
                height={ROW_HEIGHT}
                onOpen={onOpen}
              />
            );
          })}
        </div>
      </div>
    );
  }
);
