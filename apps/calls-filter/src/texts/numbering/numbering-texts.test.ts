import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Language } from '@frozik/utils/i18n/language';
import { isNil } from 'lodash-es';

import type { INumberingMask } from '../../contexts/phone/domain/numbering/gen/numbering-codes';
import { EN_NUMBERING } from './en';
import type { INumberingTexts } from './numbering-texts';
import { RU_NUMBERING } from './ru';

const LANGUAGES: Readonly<Record<Language, INumberingTexts>> = {
  en: EN_NUMBERING,
  ru: RU_NUMBERING,
};

const ROOTS: readonly INumberingMask[] = JSON.parse(
  readFileSync(
    join(__dirname, '../../contexts/phone/domain/numbering/gen/numbering-masks.json'),
    'utf8'
  )
);

function everyNode(nodes: readonly INumberingMask[]): readonly INumberingMask[] {
  return nodes.flatMap(node => [node, ...everyNode(node.children ?? [])]);
}

function unnamedCodes(texts: INumberingTexts): readonly string[] {
  const states: Readonly<Record<string, Readonly<Record<string, string>>>> = texts.states;
  return everyNode(ROOTS).flatMap(
    ({ mask, countryCode, networkOperatorCode, stateCodes, serviceCode }) => [
      ...(isNil(countryCode) || texts.countries[countryCode]
        ? []
        : [`${mask} country ${countryCode}`]),
      ...(isNil(networkOperatorCode) || texts.operators[networkOperatorCode]
        ? []
        : [`${mask} operator ${networkOperatorCode}`]),
      ...(isNil(serviceCode) || texts.services[serviceCode]
        ? []
        : [`${mask} service ${serviceCode}`]),
      ...(stateCodes ?? [])
        .filter(state => isNil(countryCode) || !states[countryCode]?.[state])
        .map(state => `${mask} state ${countryCode ?? '?'}/${state}`),
    ]
  );
}

describe.each(Object.entries(LANGUAGES))('the numbering names in %s', (_language, texts) => {
  it('name every country, region, network and service the catalogue uses', () => {
    expect(unnamedCodes(texts)).toEqual([]);
  });
});
