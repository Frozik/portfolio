import { Temporal } from 'temporal-polyfill';

import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { TCountryCode } from '../contexts/phone/domain/dialing-region';
import type { IScreeningRuntime } from '../contexts/screening/domain/ports/screening-runtime';
import { encodeRuleset } from './ruleset-wire';

function base64Of(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export const NATIVE_SCREENING_RUNTIME: IScreeningRuntime = {
  publish: ruleset => CALL_SCREENING.publishRuleset(base64Of(encodeRuleset(ruleset))),
  pausedUntil: () => {
    const until = CALL_SCREENING.pausedUntil();
    return until === null ? null : Temporal.Instant.fromEpochMilliseconds(until);
  },
  setPausedUntil: until => CALL_SCREENING.setPausedUntil(until?.epochMilliseconds ?? null),
  releasedTemporaries: () => CALL_SCREENING.releasedTemporaries(),
  dismissWhereTo: () => CALL_SCREENING.dismissWhereTo(),
  networkCountry: () => CALL_SCREENING.networkCountry() as TCountryCode | null,
  simCountry: () => CALL_SCREENING.simCountry() as TCountryCode | null,
  holdsScreeningRole: () => CALL_SCREENING.holdsScreeningRole(),
  requestScreeningRole: () => CALL_SCREENING.requestScreeningRole(),
};
