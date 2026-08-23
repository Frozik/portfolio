import { describe, expect, it } from 'vitest';

import type { WorldEvent } from '../domain/types';
import { MAX_RETREAT_FLIGHTS, RETREAT_FLIGHT_SECONDS } from './render-constants';
import { RetreatFlightList } from './retreat-flights';

const PICKUP_POSITION = { x: 200.5, y: 104 };

function createRetreat(playerId: number): WorldEvent {
  return { type: 'tank-retreated', playerId, position: PICKUP_POSITION };
}

describe('RetreatFlightList', () => {
  it('launches a helicopter from where the tank was picked up', () => {
    const flights = new RetreatFlightList();

    flights.consume([createRetreat(1)]);

    expect(flights.current).toEqual([{ playerId: 1, origin: PICKUP_POSITION, progress: 0 }]);
  });

  it('ignores everything that is not a retreat', () => {
    const flights = new RetreatFlightList();

    flights.consume([{ type: 'turn-started', playerId: 1 }]);

    expect(flights.current).toHaveLength(0);
  });

  it('flies the helicopter off the top of the field and forgets it', () => {
    const flights = new RetreatFlightList();

    flights.consume([createRetreat(1)]);
    flights.advance(RETREAT_FLIGHT_SECONDS / 2);

    expect(flights.current[0].progress).toBeCloseTo(0.5);

    flights.advance(RETREAT_FLIGHT_SECONDS / 2);

    expect(flights.current).toHaveLength(0);
  });

  it('never keeps more helicopters in the air than there are tanks', () => {
    const flights = new RetreatFlightList();

    flights.consume(
      Array.from({ length: MAX_RETREAT_FLIGHTS + 3 }, (_unused, index) => createRetreat(index))
    );

    expect(flights.current).toHaveLength(MAX_RETREAT_FLIGHTS);
  });

  it('clears the sky when the round is replaced', () => {
    const flights = new RetreatFlightList();

    flights.consume([createRetreat(1)]);
    flights.clear();

    expect(flights.current).toHaveLength(0);
  });
});
