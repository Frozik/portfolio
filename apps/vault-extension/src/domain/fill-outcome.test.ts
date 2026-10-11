import { combineOutcomes } from './fill-outcome';

describe('the answer of a page whose frames filled or refused one by one', () => {
  it('is "filled" when any frame filled, else what the user can act on', () => {
    expect(combineOutcomes(['other-site', 'filled', 'no-form'])).toBe('filled');
    expect(combineOutcomes(['no-form', 'insecure-page'])).toBe('insecure-page');
    expect(combineOutcomes(['other-site', 'no-form'])).toBe('no-form');
    expect(combineOutcomes([])).toBe('no-form');
  });
});
