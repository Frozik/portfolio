import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { Drawer } from '../../../../shared/ui/Drawer';
import { useScorchedStore } from '../../application/useScorchedStore';
import type { ShopEntryRef } from '../../domain/shop';
import { quoteShopSellBack } from '../../domain/shop';
import { formatCash } from '../hud-format';
import { scorchedT } from '../translations';

const ONE_UNIT = 1;

export interface SellableEntry {
  readonly entry: ShopEntryRef;
  readonly name: string;
  readonly ownedCount: number;
}

const SellRow = memo(
  ({
    sellable,
    unitPrice,
    onSell,
  }: {
    readonly sellable: SellableEntry;
    readonly unitPrice: number;
    readonly onSell: (entry: ShopEntryRef) => void;
  }) => {
    const handleSell = useFunction(() => {
      onSell(sellable.entry);
    });

    return (
      <li className="flex items-center gap-2 border-b border-white/5 py-2 text-sm">
        <span className="flex-1 truncate text-text">{sellable.name}</span>
        <span className="font-mono text-xs tabular-nums text-text-muted">
          ×{sellable.ownedCount}
        </span>
        <Button variant="secondary" size="sm" onClick={handleSell}>
          {formatCash(unitPrice)}
        </Button>
      </li>
    );
  }
);

/**
 * [§13] The sell-back drawer: everything the shopper owns, at the computer's quoted price. Selling
 * one unit at a time is deliberate — a "sell all" button next to a nuke is a trap, not a feature.
 */
export const SellBackDrawer = observer(
  ({
    isOpen,
    sellables,
    onClose,
  }: {
    readonly isOpen: boolean;
    readonly sellables: readonly SellableEntry[];
    readonly onClose: VoidFunction;
  }) => {
    const store = useScorchedStore();

    const handleSell = useFunction((entry: ShopEntryRef) => {
      store.shop.sell(entry, ONE_UNIT);
    });

    return (
      <Drawer title={scorchedT.shop.sellDrawer} open={isOpen} onClose={onClose}>
        <p className="pb-2 text-xs text-text-muted">{scorchedT.shop.sellDrawerHint}</p>

        {sellables.length === 0 ? (
          <p className="text-sm text-text-secondary">{scorchedT.shop.sellNothing}</p>
        ) : (
          <ul>
            {sellables.map(sellable => (
              <SellRow
                key={`${sellable.entry.kind}:${sellable.name}`}
                sellable={sellable}
                unitPrice={quoteShopSellBack(sellable.entry, store.roundsRemaining, ONE_UNIT)}
                onSell={handleSell}
              />
            ))}
          </ul>
        )}
      </Drawer>
    );
  }
);
