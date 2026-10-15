import { render, screen } from '@testing-library/react';

import type { TTemplateId } from '@frozik/vault/model/ids';
import { cardState } from '@frozik/vault/model/revision-edits';
import { aCard, aCardWith, aField } from '@frozik/vault/testing/builders';
import { CardIcon } from './CardIcon';
import { CardNetworkLogo } from './CardNetworkLogo';

describe('CardIcon', () => {
  it('shows the chosen icon in the card colour, else the template icon', () => {
    const chosen = render(
      <CardIcon
        card={cardState(aCard({ icon: { kind: 'builtin', name: 'wifi' }, color: 'teal' }))}
        locale="en"
      />
    );
    const auto = render(
      <CardIcon card={cardState(aCard({ templateId: 'bank-card' as TTemplateId }))} locale="en" />
    );

    expect(chosen.container.querySelector('svg')?.getAttribute('class')).toContain('wifi');
    expect(chosen.container.firstElementChild?.className).toContain('teal');
    expect(auto.container.querySelector('svg')?.getAttribute('class')).toContain('credit-card');
  });

  it('keeps the automatic icon out of the card colour', () => {
    const { container } = render(
      <CardIcon card={cardState(aCard({ color: 'teal' }))} locale="en" />
    );

    expect(container.firstElementChild?.className).not.toContain('teal');
  });

  it('shows the logo of a card number’s network instead of the template icon', () => {
    render(
      <CardIcon
        card={cardState(aCardWith([aField({ kind: 'card-number' }, '4111111111111111')]))}
        locale="en"
      />
    );

    expect(screen.getByRole('img', { name: 'VISA' }).querySelector('svg')).not.toBeNull();
  });

  it('shows the site’s icon for the automatic choice, never over one chosen by hand', () => {
    const picture = 'blob:site-icon';
    const auto = render(<CardIcon card={cardState(aCard())} locale="en" picture={picture} />);
    const chosen = render(
      <CardIcon
        card={cardState(aCard({ icon: { kind: 'builtin', name: 'wifi' } }))}
        locale="en"
        picture={picture}
      />
    );

    expect(auto.container.querySelector('img')?.getAttribute('src')).toBe(picture);
    expect(chosen.container.querySelector('img')).toBeNull();
  });

  it('names a card network in the page language', () => {
    render(<CardNetworkLogo network="mir" locale="ru" />);

    expect(screen.getByRole('img', { name: 'Мир' })).toBeDefined();
  });

  it('writes out the name of a network the icon set does not draw', () => {
    const { container } = render(<CardNetworkLogo network="troy" locale="en" />);

    expect(container.textContent).toBe('TROY');
    expect(container.querySelector('svg')).toBeNull();
  });
});
