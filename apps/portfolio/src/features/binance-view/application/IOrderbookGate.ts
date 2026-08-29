/**
 * Narrow read-only gate exposed by the orderbook stream store and read
 * by the trades stream store. Trades arriving before the
 * first orderbook snapshot are dropped — without that anchor the trade-
 * block timeDelta encoding would resolve to a not-yet-defined system of
 * coordinates.
 *
 * Forecloses cycle creep: trades depend on a single boolean, not the
 * whole orderbook store.
 */
export interface IOrderbookGate {
  readonly hasFirstOrderbookSnapshot: boolean;
}
