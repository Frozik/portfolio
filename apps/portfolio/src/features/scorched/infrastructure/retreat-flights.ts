import type { Vector2 } from '@frozik/utils/math/vector2';

import type { PlayerId, WorldEvent } from '../domain/types';
import { MAX_RETREAT_FLIGHTS, RETREAT_FLIGHT_SECONDS } from './render-constants';

export interface RetreatFlight {
  readonly playerId: PlayerId;
  readonly origin: Vector2;
  /** Rises from 0 to 1 over {@link RETREAT_FLIGHT_SECONDS}; the flight is dropped at one. */
  readonly progress: number;
}

/**
 * [MANUAL §8] Retreating is resolved instantly in the domain — the tank simply stops being in the
 * round. So that the player sees where their money went, the helicopter that lifted it out is kept
 * here for a second and a half and flown off the top of the field, exactly as the laser beams
 * outlive the shot that drew them.
 */
export class RetreatFlightList {
  private flights: RetreatFlight[] = [];

  get current(): readonly RetreatFlight[] {
    return this.flights;
  }

  consume(events: readonly WorldEvent[]): void {
    for (const event of events) {
      if (event.type === 'tank-retreated') {
        this.flights.push({ playerId: event.playerId, origin: event.position, progress: 0 });
      }
    }

    this.flights = this.flights.slice(-MAX_RETREAT_FLIGHTS);
  }

  advance(elapsedSeconds: number): void {
    if (this.flights.length === 0) {
      return;
    }

    this.flights = this.flights
      .map(flight => ({
        ...flight,
        progress: flight.progress + elapsedSeconds / RETREAT_FLIGHT_SECONDS,
      }))
      .filter(flight => flight.progress < 1);
  }

  clear(): void {
    this.flights = [];
  }
}
