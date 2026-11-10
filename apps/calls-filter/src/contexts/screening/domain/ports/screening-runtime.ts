import type { Temporal } from 'temporal-polyfill';

import type { TCountryCode } from '../../../phone/domain/dialing-region';
import type { ICompiledRuleset } from '../compiled-ruleset';

/** The screening service as the app sees it: where rules go and what the phone reports. */
export interface IScreeningRuntime {
  publish(ruleset: ICompiledRuleset): void;
  pausedUntil(): Temporal.Instant | null;
  setPausedUntil(until: Temporal.Instant | null): void;
  /** How many days the service keeps its journal of screened calls. */
  setRetentionDays(days: number): void;
  /** Clears «where does this number go?» from the shade once the app has answered it. */
  dismissWhereTo(): void;
  networkCountry(): TCountryCode | null;
  simCountry(): TCountryCode | null;
  holdsScreeningRole(): boolean;
  requestScreeningRole(): Promise<boolean>;
}
