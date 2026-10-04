import { describe, expect, it } from 'vitest';

import { describeElement } from './breadcrumb';

const BARE = { tag: 'BUTTON', id: '', classes: [], testId: '', ariaLabel: '', role: '', text: '' };

describe('describeElement', () => {
  it('prefers the test id over everything else', () => {
    expect(describeElement({ ...BARE, testId: 'submit', id: 'x', text: 'Send' })).toBe(
      'button[data-testid="submit"]'
    );
  });

  it('falls back to the id, then the accessible name', () => {
    expect(describeElement({ ...BARE, id: 'save', text: 'Save' })).toBe('button#save');
    expect(describeElement({ ...BARE, ariaLabel: 'Close dialog' })).toBe(
      'button[aria-label="Close dialog"]'
    );
  });

  it('otherwise names the element by role, first classes and truncated text', () => {
    expect(
      describeElement({
        ...BARE,
        tag: 'DIV',
        role: 'tab',
        classes: ['one', 'two', 'three'],
        text: `  ${'Positions'.repeat(10)}  `,
      })
    ).toBe('div[role=tab].one.two "PositionsPositionsPositionsPositionsPos…"');
  });
});
