import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { groupBy, isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useMemo, useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { useScorchedStore } from '../../application/useScorchedStore';
import { applyInterest } from '../../domain/economy';
import { ITEMS } from '../../domain/items/catalog';
import type { ShopEntryRef } from '../../domain/shop';
import { getCartTotal, quoteShopPurchase } from '../../domain/shop';
import type { WeaponFamily } from '../../domain/types';
import { WEAPONS } from '../../domain/weapons/catalog';
import { GLASS_PANEL_CLASS, OVERLAY_SURFACE_CLASS } from '../constants';
import { formatCash } from '../hud-format';
import { getPlayerDisplayName } from '../player-name';
import { scorchedT } from '../translations';
import { getWeaponName } from '../weapon-names';
import type { SellableEntry } from './SellBackDrawer';
import { SellBackDrawer } from './SellBackDrawer';
import { ShopEntryCard } from './ShopEntryCard';

const sectionTitleClass = 'text-[0.625rem] uppercase tracking-widest text-text-muted';
/** Cash starts at zero, so the first visit to the shop is usually a window-shopping trip. */
const NO_CASH = 0;

/**
 * The between-rounds screen, the emotional core of the original and the design centrepiece
 * here: weapon cards grouped by family with our own iconography, honest price/bundle/owned/markup
 * badges, a running receipt with the bank-and-interest preview, and a sell-back drawer.
 *
 * Purchases apply the moment they are tapped — the way the original's shop worked — and the cart
 * is the record of the visit rather than a deferred order. That keeps one quoting path for both
 * the preview and the purchase, so what the card promises is exactly what the bank is charged.
 */
export const ShopScreen = observer(({ onPurchase }: { readonly onPurchase: VoidFunction }) => {
  const store = useScorchedStore();
  const [isSellOpen, setIsSellOpen] = useState(false);
  const shopper = store.shopPlayer;
  const cash = shopper?.cash ?? 0;
  const { roundsRemaining } = store.world;

  const weaponsByFamily = useMemo(
    () =>
      groupBy(
        WEAPONS.filter(weapon =>
          store.shop.isEntryUnlocked({ kind: 'weapon', weaponId: weapon.id })
        ),
        weapon => weapon.family
      ),
    [store]
  );

  const unlockedItems = ITEMS.filter(item =>
    store.shop.isEntryUnlocked({ kind: 'item', itemId: item.id })
  );

  // Not memoised on purpose: the list depends on the inventory this screen is actively changing,
  // and MobX already limits the re-render to the mutations that matter.
  const buildSellables = (): readonly SellableEntry[] => {
    const playerId = store.shop.playerId;

    if (isNil(playerId)) {
      return [];
    }

    const weaponRows = WEAPONS.map<SellableEntry>(weapon => ({
      entry: { kind: 'weapon', weaponId: weapon.id },
      name: getWeaponName(weapon.id),
      ownedCount: store.shop.getOwnedCount(playerId, { kind: 'weapon', weaponId: weapon.id }),
    }));
    const itemRows = ITEMS.map<SellableEntry>(item => ({
      entry: { kind: 'item', itemId: item.id },
      name: scorchedT.itemNames[item.id],
      ownedCount: store.shop.getOwnedCount(playerId, { kind: 'item', itemId: item.id }),
    }));

    return [...weaponRows, ...itemRows].filter(row => row.ownedCount > 0);
  };

  const handleBuy = useFunction((entry: ShopEntryRef) => {
    if (store.shop.buy(entry)) {
      onPurchase();
    }
  });

  const handleDone = useFunction(() => {
    store.leaveShop();
  });

  const handleOpenSell = useFunction(() => setIsSellOpen(true));
  const handleCloseSell = useFunction(() => setIsSellOpen(false));

  const quoteFor = (entry: ShopEntryRef) =>
    quoteShopPurchase(
      entry,
      roundsRemaining,
      cash,
      isNil(store.shop.playerId) ? 0 : store.shop.getOwnedCount(store.shop.playerId, entry)
    );

  return (
    <div className={OVERLAY_SURFACE_CLASS}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-wide text-text">
              {scorchedT.shop.title}
            </h2>
            {isNil(shopper) ? null : (
              <p className="text-sm text-text-secondary">
                {scorchedT.shop.shoppingFor(getPlayerDisplayName(shopper))}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-lg tabular-nums text-brand-400">
              {formatCash(cash)}
            </span>
            <Button variant="secondary" onClick={handleOpenSell}>
              {scorchedT.shop.sellBack}
            </Button>
            <Button onClick={handleDone}>{scorchedT.shop.done}</Button>
          </div>
        </header>

        {cash > NO_CASH ? null : (
          <p
            className={cn(
              GLASS_PANEL_CLASS,
              'flex flex-col gap-1 border-dashed text-center text-sm text-text-secondary'
            )}
          >
            <span className="text-base font-medium text-text">{scorchedT.shop.brokeTitle}</span>
            {scorchedT.shop.broke}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <h3 className={sectionTitleClass}>{scorchedT.shop.weapons}</h3>

              {Object.entries(weaponsByFamily).map(([family, weapons]) => (
                <div key={family} className="flex flex-col gap-2">
                  <h4 className="text-xs font-medium text-text-secondary">
                    {scorchedT.weaponFamilies[family as WeaponFamily]}
                  </h4>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {weapons.map(weapon => {
                      const entry: ShopEntryRef = { kind: 'weapon', weaponId: weapon.id };

                      return (
                        <ShopEntryCard
                          key={weapon.id}
                          entry={entry}
                          glyphId={weapon.family}
                          name={getWeaponName(weapon.id)}
                          description={scorchedT.weapons[weapon.id]}
                          quote={quoteFor(entry)}
                          ownedCount={
                            isNil(store.shop.playerId)
                              ? 0
                              : store.shop.getOwnedCount(store.shop.playerId, entry)
                          }
                          onBuy={handleBuy}
                        />
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className={sectionTitleClass}>{scorchedT.shop.items}</h3>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {unlockedItems.map(item => {
                  const entry: ShopEntryRef = { kind: 'item', itemId: item.id };

                  return (
                    <ShopEntryCard
                      key={item.id}
                      entry={entry}
                      glyphId={item.id}
                      name={scorchedT.itemNames[item.id]}
                      description={scorchedT.items[item.id]}
                      quote={quoteFor(entry)}
                      ownedCount={
                        isNil(store.shop.playerId)
                          ? 0
                          : store.shop.getOwnedCount(store.shop.playerId, entry)
                      }
                      onBuy={handleBuy}
                    />
                  );
                })}
              </ul>
            </section>
          </div>

          <aside className={cn(GLASS_PANEL_CLASS, 'h-fit lg:sticky lg:top-6')}>
            <h3 className={sectionTitleClass}>{scorchedT.shop.cart}</h3>

            {store.shop.cart.length === 0 ? (
              <p className="pt-2 text-xs text-text-muted">{scorchedT.shop.cartEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-1 pt-2">
                {store.shop.cart.map(line => (
                  <li
                    key={`${line.entry.kind}:${
                      line.entry.kind === 'weapon' ? line.entry.weaponId : line.entry.itemId
                    }`}
                    className="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-text-secondary">
                      {line.entry.kind === 'weapon'
                        ? getWeaponName(line.entry.weaponId)
                        : scorchedT.itemNames[line.entry.itemId]}
                      <span className="pl-1 font-mono text-text-muted">×{line.units}</span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-text">
                      {formatCash(line.spent)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-3 flex flex-col gap-1 border-t border-white/10 pt-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-text-muted">{scorchedT.shop.total}</dt>
                <dd className="font-mono tabular-nums text-text">
                  {formatCash(getCartTotal(store.shop.cart))}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-muted">{scorchedT.shop.cash}</dt>
                <dd className="font-mono tabular-nums text-brand-400">{formatCash(cash)}</dd>
              </div>
            </dl>

            <p className="pt-2 text-[0.6875rem] leading-relaxed text-text-muted">
              {scorchedT.shop.bankPreview(
                formatCash(applyInterest(cash, store.world.interestPercent)),
                store.world.interestPercent
              )}
            </p>
          </aside>
        </div>
      </div>

      <SellBackDrawer isOpen={isSellOpen} sellables={buildSellables()} onClose={handleCloseSell} />
    </div>
  );
});
