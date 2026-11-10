import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Temporal } from 'temporal-polyfill';

import type { ICaller, TE164Digits, TNumberType } from '../contexts/phone/domain/caller';
import type { TCountryCode } from '../contexts/phone/domain/dialing-region';
import { normalizeName } from '../contexts/phone/domain/name-normalization';
import { compileRuleset } from '../contexts/screening/domain/compile-ruleset';
import { decide } from '../contexts/screening/domain/decide';
import { encodeRuleset } from '../infrastructure/ruleset-wire';
import { momentOf, SCENARIO_ENVIRONMENT, SCENARIO_INPUTS } from './scenario-world';
import type { IScenario } from './screening-scenarios';
import { SCENARIOS } from './screening-scenarios';

/**
 * The file both runtimes answer to. TypeScript writes it from the scenarios through the
 * domain; the Kotlin service's JVM tests read the same file and must give the same answers.
 * `UPDATE_FIXTURES=1 pnpm --filter @frozik/calls-filter test` regenerates it.
 */
const FIXTURE_FILE = join(__dirname, 'screening.json');
const COMPILED_AT = Temporal.Instant.from('2026-11-01T00:00:00Z');

function callerOf(scenario: IScenario): ICaller {
  const { caller } = scenario;
  return {
    number: caller.number as TE164Digits | null,
    traits:
      caller.number === null
        ? null
        : { country: caller.country as TCountryCode | null, type: caller.type as TNumberType },
    networkName: caller.networkName === null ? null : normalizeName(caller.networkName),
    contact:
      caller.contactName === null || caller.contactLookupKey === null
        ? null
        : {
            lookupKey: caller.contactLookupKey,
            displayName: caller.contactName,
            name: normalizeName(caller.contactName),
          },
  };
}

function fixtureOf(scenario: IScenario) {
  const moment = momentOf(scenario.local);
  const environment = {
    ...SCENARIO_ENVIRONMENT,
    networkCountry: scenario.networkCountry as TCountryCode | null,
  };
  const ruleset = compileRuleset(scenario.book, {
    environment,
    inputs: SCENARIO_INPUTS,
    compiledAt: COMPILED_AT,
    whereTo: [],
    repeatPass: scenario.repeatPass,
  });
  const lastRejectedAt =
    scenario.rejectedMinutesAgo === null
      ? null
      : moment.instant.subtract({ minutes: scenario.rejectedMinutesAgo });
  const decision = decide(scenario.book, callerOf(scenario), moment, {
    environment,
    inputs: SCENARIO_INPUTS,
    paused: scenario.paused,
    repeatPass: scenario.repeatPass,
    lastRejectedAt,
    atPlace: place => scenario.places[place] ?? null,
  });
  return {
    name: scenario.name,
    ruleset: Buffer.from(encodeRuleset(ruleset)).toString('base64'),
    caller: scenario.caller,
    networkCountry: scenario.networkCountry,
    instantEpochMs: moment.instant.epochMilliseconds,
    localMinute: moment.local,
    paused: scenario.paused,
    places: scenario.places,
    lastRejectedAtEpochMs: lastRejectedAt?.epochMilliseconds ?? null,
    expected: {
      group: decision.group.id,
      action: decision.action,
      verdict: decision.verdict,
    },
  };
}

function normalizationFixtures() {
  return [
    'Доставка',
    'ДОСТАВКА  Ozon',
    'Café Été',
    'новая ёлка',
    'ЙОГА',
    'İstanbul',
    'ﬁle',
    '  KPN\tKlantenservice ',
    'Ölçek',
    'Курьер\u00a0Ozon',
    'Wide\u2003space\u3000name',
  ].map(raw => ({
    raw,
    normalized: normalizeName(raw),
  }));
}

describe('the fixtures both runtimes answer to', () => {
  const generated = `${JSON.stringify({ screening: SCENARIOS.map(fixtureOf), names: normalizationFixtures() }, null, 2)}\n`;

  it('give every scenario a distinct name', () => {
    expect(new Set(SCENARIOS.map(scenario => scenario.name)).size).toBe(SCENARIOS.length);
  });

  it('are up to date with the scenarios and the domain', () => {
    if (process.env.UPDATE_FIXTURES === '1' || !existsSync(FIXTURE_FILE)) {
      writeFileSync(FIXTURE_FILE, generated);
    }
    expect(readFileSync(FIXTURE_FILE, 'utf8')).toBe(generated);
  });
});
