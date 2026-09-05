import { clamp } from 'lodash-es';

const PRICE_BASE = 77600;
const PRICE_RANGE = 80;
export const DEPTH_LEVELS = 48;
export const DEPTH_COLUMNS = 180;
const COLUMN_INTERVAL_MS = 220;
const TAPE_MAX_ROWS = 20;
const PRICE_STEP_PER_MS = 0.6;
const PRICE_REVERSION = 0.0008;
const PRICE_DECAY_BASE = 0.92;
const PRICE_CLAMP_RATIO = 0.6;
const DEPTH_DECAY_RATIO = 0.25;
const DEPTH_BASE_MIN = 0.4;
const DEPTH_BASE_RANDOM = 0.6;
const DEPTH_WALL_PROBABILITY = 0.04;
const DEPTH_WALL_MIN = 0.6;
const DEPTH_WALL_RANDOM = 0.4;
const TAPE_ADD_PROBABILITY = 0.6;
const TAPE_BUY_PROBABILITY = 0.5;
const TAPE_PRICE_JITTER = 4;
const RANDOM_CENTER = 0.5;

type TradeSide = 'buy' | 'sell';

interface IDepthCell {
  readonly bid: number;
  readonly ask: number;
}

interface ITapeEntry {
  readonly price: number;
  readonly side: TradeSide;
  readonly size: number;
  readonly ageMs: number;
}

/** Newest column last; `columnPhase` in `[0, 1)` is the scroll progress towards the next column. */
export interface IOrderbookSimulation {
  readonly columns: readonly (readonly IDepthCell[])[];
  readonly tape: readonly ITapeEntry[];
  readonly midPrice: number;
  readonly velocity: number;
  readonly columnPhase: number;
}

export type RandomUnit = () => number;

function createDepthColumn(midPrice: number, randomUnit: RandomUnit): readonly IDepthCell[] {
  const midLevel = DEPTH_LEVELS / 2 + ((PRICE_BASE - midPrice) / PRICE_RANGE) * DEPTH_LEVELS;
  return Array.from({ length: DEPTH_LEVELS }, (_, level) => {
    const distance = Math.abs(level - midLevel);
    const decay = Math.exp(-distance / (DEPTH_LEVELS * DEPTH_DECAY_RATIO));
    const base = decay * (DEPTH_BASE_MIN + randomUnit() * DEPTH_BASE_RANDOM);
    const wall =
      randomUnit() < DEPTH_WALL_PROBABILITY ? DEPTH_WALL_MIN + randomUnit() * DEPTH_WALL_RANDOM : 0;
    const value = Math.min(1, base + wall);
    return level < midLevel ? { bid: 0, ask: value } : { bid: value, ask: 0 };
  });
}

function stepMarket(
  simulation: IOrderbookSimulation,
  deltaMs: number,
  randomUnit: RandomUnit
): IOrderbookSimulation {
  const nudged = simulation.velocity + (randomUnit() - RANDOM_CENTER) * PRICE_STEP_PER_MS * deltaMs;
  const reverted = nudged + (PRICE_BASE - simulation.midPrice) * PRICE_REVERSION * deltaMs;
  const velocity = reverted * PRICE_DECAY_BASE ** deltaMs;
  const clampBound = PRICE_RANGE * PRICE_CLAMP_RATIO;
  const midPrice = clamp(
    simulation.midPrice + velocity * deltaMs,
    PRICE_BASE - clampBound,
    PRICE_BASE + clampBound
  );
  return { ...simulation, velocity, midPrice };
}

function pushColumn(
  simulation: IOrderbookSimulation,
  randomUnit: RandomUnit
): IOrderbookSimulation {
  const columns = [
    ...simulation.columns.slice(1),
    createDepthColumn(simulation.midPrice, randomUnit),
  ];
  if (randomUnit() >= TAPE_ADD_PROBABILITY) {
    return { ...simulation, columns };
  }
  const trade: ITapeEntry = {
    price: simulation.midPrice + (randomUnit() - RANDOM_CENTER) * TAPE_PRICE_JITTER,
    side: randomUnit() < TAPE_BUY_PROBABILITY ? 'buy' : 'sell',
    size: randomUnit(),
    ageMs: 0,
  };
  return { ...simulation, columns, tape: [...simulation.tape, trade].slice(-TAPE_MAX_ROWS) };
}

export function advanceOrderbook(
  simulation: IOrderbookSimulation,
  deltaMs: number,
  randomUnit: RandomUnit
): IOrderbookSimulation {
  let next = stepMarket(simulation, deltaMs, randomUnit);
  let columnPhase = next.columnPhase + deltaMs / COLUMN_INTERVAL_MS;
  while (columnPhase >= 1) {
    next = pushColumn(next, randomUnit);
    columnPhase -= 1;
  }
  return {
    ...next,
    columnPhase,
    tape: next.tape.map(entry => ({ ...entry, ageMs: entry.ageMs + deltaMs })),
  };
}

/** Starts with a full history so the heatmap is filled on the first paint. */
export function createOrderbookSimulation(randomUnit: RandomUnit): IOrderbookSimulation {
  const empty: IOrderbookSimulation = {
    columns: Array.from({ length: DEPTH_COLUMNS }, () =>
      Array.from({ length: DEPTH_LEVELS }, () => ({ bid: 0, ask: 0 }))
    ),
    tape: [],
    midPrice: PRICE_BASE,
    velocity: 0,
    columnPhase: 0,
  };
  let simulation = empty;
  for (let column = 0; column < DEPTH_COLUMNS; column++) {
    simulation = pushColumn(simulation, randomUnit);
  }
  return simulation;
}
