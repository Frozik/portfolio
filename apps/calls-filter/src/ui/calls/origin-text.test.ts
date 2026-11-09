import { EN } from '../../texts/en';
import { originText } from './origin-text';

const { countries, states, operators, services } = EN.numbering;

describe('where a call is from, in one line', () => {
  it('names the country, the region and the operator', () => {
    expect(
      originText(EN, {
        country: 'RU',
        states: ['kirov-oblast'],
        operator: 'beeline',
        service: null,
      })
    ).toBe([countries.RU, states.RU['kirov-oblast'], operators.beeline].join(' · '));
  });

  it('leaves out regions when the range spans more than two', () => {
    expect(
      originText(EN, {
        country: 'RU',
        states: ['moscow', 'moscow-oblast', 'kirov-oblast'],
        operator: 'mts',
        service: null,
      })
    ).toBe([countries.RU, operators.mts].join(' · '));
  });

  it('names a service that belongs to no country', () => {
    expect(originText(EN, { country: null, states: [], operator: null, service: 'inmarsat' })).toBe(
      services.inmarsat
    );
  });

  it('says nothing when nothing is known', () => {
    expect(originText(EN, null)).toBeNull();
  });
});
