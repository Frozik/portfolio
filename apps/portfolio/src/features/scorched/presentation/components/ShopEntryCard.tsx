import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { memo } from 'react';

import { Tag } from '../../../../shared/ui/Tag';
import type { ShopEntryRef, ShopQuote } from '../../domain/shop';
import { isPermanentEntry } from '../../domain/shop';
import { GLASS_PANEL_CLASS } from '../constants';
import { formatCash } from '../hud-format';
import { scorchedT } from '../translations';
import type { ShopGlyphId } from './ShopGlyph';
import { ShopGlyph } from './ShopGlyph';

/**
 * [§13] One shop card: our glyph, the name, a one-line description of what the thing actually
 * does, and the price honestly annotated — bundle size, owned count and the 99-cap surcharge are
 * all on the face of the card rather than buried in a table.
 */
export const ShopEntryCard = memo(
  ({
    entry,
    glyphId,
    name,
    description,
    quote,
    ownedCount,
    onBuy,
  }: {
    readonly entry: ShopEntryRef;
    readonly glyphId: ShopGlyphId;
    readonly name: string;
    readonly description: string;
    readonly quote: ShopQuote;
    readonly ownedCount: number;
    readonly onBuy: (entry: ShopEntryRef) => void;
  }) => {
    const isBuyable = quote.isAffordable;
    const isPermanent = isPermanentEntry(entry);

    const handleBuy = useFunction(() => {
      onBuy(entry);
    });

    return (
      <li>
        <button
          type="button"
          onClick={handleBuy}
          disabled={!isBuyable}
          className={cn(
            GLASS_PANEL_CLASS,
            'flex w-full items-start gap-3 text-left',
            isBuyable
              ? 'hover:border-brand-500/50 hover:bg-white/10'
              : 'cursor-not-allowed opacity-45'
          )}
        >
          <span className="mt-0.5 text-brand-400">
            <ShopGlyph glyphId={glyphId} />
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-text">{name}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
                {formatCash(quote.cost)}
              </span>
            </span>

            <span className="line-clamp-2 text-xs leading-relaxed text-text-muted">
              {description}
            </span>

            <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {isPermanent ? <Tag color="green">{scorchedT.shop.permanent}</Tag> : null}
              {quote.isAvailable && !isPermanent ? (
                <Tag>{scorchedT.shop.bundle(quote.units)}</Tag>
              ) : null}
              {isPermanent && ownedCount > 0 ? (
                <Tag color="blue">{scorchedT.shop.installed}</Tag>
              ) : null}
              {!isPermanent && ownedCount > 0 ? (
                <Tag color="blue">{scorchedT.shop.owned(ownedCount)}</Tag>
              ) : null}
              {quote.hasMarkup ? <Tag color="orange">{scorchedT.shop.markup}</Tag> : null}
              {quote.isAvailable || isPermanent ? null : (
                <Tag color="red">{scorchedT.shop.capped}</Tag>
              )}
              {quote.isAvailable && !quote.isAffordable ? (
                <Tag color="red">{scorchedT.shop.unaffordable}</Tag>
              ) : null}
            </span>
          </span>
        </button>
      </li>
    );
  }
);
