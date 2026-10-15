import { virtualWindow } from '@frozik/table/extensions/grid-view/virtual-window';
import type { TCardId } from '@frozik/vault/model/ids';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { UIEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import { Button } from '@frozik/components/ui/Button';
import { cardRowOf } from '@frozik/vault-app/document/application/card-row';
import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';
import { CardRow } from './CardRow';

/** A row is a touch target with room for two lines. */
const ROW_HEIGHT = 64;

/** Only the rows in sight are in the DOM, so 5 000 cards scroll like 50; the order is the view's. */
export const CardList = observer(
  ({
    vaultKey,
    view,
    emptyVault,
    selectedId,
  }: {
    readonly vaultKey: TVaultKey;
    readonly view: VaultView;
    /** No cards at all: an import is offered. */
    readonly emptyVault: boolean;
    readonly selectedId: TCardId | null;
  }) => {
    const cards = view.visibleCards;
    const container = useRef<HTMLDivElement>(null);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const heights = useMemo(() => cards.map(() => ROW_HEIGHT), [cards]);
    const visible = virtualWindow({ heights, scrollTop, viewportHeight });

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
    }, []);

    if (cards.length === 0) {
      const nothingFound = view.query !== '';
      return (
        <div className="flex flex-col items-start gap-3 px-4 py-6" data-testid="no-cards">
          <p className="text-[15px] text-fg-dim">
            {nothingFound ? vaultT.list.nothingFound : vaultT.list.empty}
          </p>
          {nothingFound && view.section !== 'archive' && (
            <Button asChild variant="secondary">
              <Link to={paths.section(vaultKey, 'archive')}>{vaultT.shortcuts.searchArchive}</Link>
            </Button>
          )}
          {!nothingFound && emptyVault && (
            <Link to={paths.settings(vaultKey)} className="text-[15px] text-fg underline">
              {vaultT.list.importCards}
            </Link>
          )}
        </div>
      );
    }
    return (
      <div
        ref={container}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={(event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <ul
          aria-label={vaultT.list.label}
          data-testid="card-list"
          className="relative"
          style={{ height: visible.totalHeight, paddingTop: visible.offsetBefore }}
        >
          {cards.slice(visible.startIndex, visible.endIndex + 1).map(card => (
            <li key={card.id}>
              <CardRow
                vaultKey={vaultKey}
                section={view.section}
                row={cardRowOf(card, view.expiryOf(card))}
                siteIcon={view.siteIconOf(card)}
                selected={card.id === selectedId}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }
);
