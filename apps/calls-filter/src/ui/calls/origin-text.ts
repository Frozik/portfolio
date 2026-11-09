import type { TNumberingCountry } from '../../contexts/phone/domain/numbering/gen/numbering-codes';
import type {
  INumberingDetails,
  TNumberingStateCode,
} from '../../contexts/phone/domain/numbering/numbering-details';
import type { ITexts } from '../../texts/texts';

/** More regions than this is a range spanning a country's part, not an answer to «where from». */
const MAX_REGIONS = 2;

function regionNames(
  texts: ITexts,
  country: TNumberingCountry | null,
  states: readonly TNumberingStateCode[]
): readonly string[] {
  if (country === null || states.length === 0 || states.length > MAX_REGIONS) {
    return [];
  }
  const byCountry: Readonly<Partial<Record<TNumberingCountry, Readonly<Record<string, string>>>>> =
    texts.numbering.states;
  const names = byCountry[country];
  return names === undefined
    ? []
    : states.flatMap(state => {
        const name = names[state];
        return name === undefined ? [] : [name];
      });
}

/** «Russia · Kirov Oblast · Beeline»: where a number is from and whose network, as far as known. */
export function originText(texts: ITexts, details: INumberingDetails | null): string | null {
  if (details === null) {
    return null;
  }
  const { country, states, operator, service } = details;
  const parts = [
    country === null ? null : texts.numbering.countries[country],
    ...regionNames(texts, country, states),
    operator === null ? null : texts.numbering.operators[operator],
    service === null ? null : texts.numbering.services[service],
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(' · ');
}
