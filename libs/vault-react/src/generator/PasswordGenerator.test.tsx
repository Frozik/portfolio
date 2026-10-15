import { act, fireEvent, render, screen } from '@testing-library/react';

import type { ComponentProps } from 'react';

import { parsePasswordRules } from '@frozik/vault/generator/password-rules';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { PasswordGenerator } from './PasswordGenerator';

function renderGenerator(site: ComponentProps<typeof PasswordGenerator>['site'] = null) {
  const used: string[] = [];
  render(
    <PasswordGenerator
      random={createSeededRandom(3)}
      locale="en"
      site={site}
      onUse={value => used.push(value)}
    />
  );
  return used;
}

describe('PasswordGenerator', () => {
  it('hands over a 20-character password of every kind of character by default', () => {
    const used = renderGenerator();

    fireEvent.click(screen.getByRole('button', { name: 'Use' }));

    const [password] = used;
    expect(password).toHaveLength(20);
    expect(password).toMatch(/\d/);
    expect(
      Number(screen.getByTestId('generator-entropy').getAttribute('data-bits'))
    ).toBeGreaterThan(100);
  });

  it('draws another one on request', () => {
    renderGenerator();
    const first = screen.getByRole('status').textContent;

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Another one' })));

    expect(screen.getByRole('status').textContent).not.toBe(first);
  });

  it('says so when no kind of character is left', () => {
    renderGenerator();

    for (const set of ['A–Z', 'a–z', '0–9', '!@#']) {
      act(() => fireEvent.click(screen.getByRole('checkbox', { name: set })));
    }

    expect(screen.getByTestId('generator-problem').getAttribute('data-state')).toBe(
      'no-characters'
    );
    expect(screen.getByRole('button', { name: 'Use' })).toHaveProperty('disabled', true);
  });

  it('offers first a password the card’s site accepts, and says whose rules it follows', () => {
    const used = renderGenerator({
      domain: 'bank.example',
      rules: parsePasswordRules('maxlength: 12; required: digit; allowed: lower;'),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Use' }));

    const [password] = used;
    expect(password).toMatch(/^[a-z0-9]{12}$/);
    expect(password).toMatch(/\d/);
    expect(screen.getByTestId('generator-site-rules').textContent).toContain('bank.example');
  });
});
