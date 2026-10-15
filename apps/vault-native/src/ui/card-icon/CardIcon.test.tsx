import { CARD_COLOR_SHADES } from '@frozik/vault/model/card-appearance';
import type { TTemplateId } from '@frozik/vault/model/ids';
import { cardState } from '@frozik/vault/model/revision-edits';
import { aCard, aCardWith, aField } from '@frozik/vault/testing/builders';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { aDevice } from '@frozik/vault-app/testing/fake-device';

import { AppUnderTest } from '../testing/AppUnderTest';
import { CardIcon } from './CardIcon';

const HIDDEN = { includeHiddenElements: true };
const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47);

async function shown(icon: ReactNode) {
  const app = aDevice().startStore();
  app.appearance.choose('dark');
  await render(<AppUnderTest app={app}>{icon}</AppUnderTest>);
}

describe('a card’s icon on the phone', () => {
  it('draws the chosen built-in icon in the card’s colour', async () => {
    await shown(
      <CardIcon
        card={cardState(aCard({ icon: { kind: 'builtin', name: 'wifi' }, color: 'teal' }))}
        siteIcon={null}
      />
    );

    expect(screen.getByTestId('builtin-icon-wifi', HIDDEN).props.stroke).toBe(
      CARD_COLOR_SHADES.teal.dark
    );
  });

  it('draws the template’s icon, not in the card’s colour, while the icon is automatic', async () => {
    await shown(
      <CardIcon
        card={cardState(aCard({ templateId: 'bank-card' as TTemplateId, color: 'teal' }))}
        siteIcon={null}
      />
    );

    expect(screen.getByTestId('builtin-icon-credit-card', HIDDEN).props.stroke).not.toBe(
      CARD_COLOR_SHADES.teal.dark
    );
  });

  it('prefers a card number’s network, then the site’s icon, to the template’s', async () => {
    await shown(
      <>
        <CardIcon
          card={cardState(aCardWith([aField({ kind: 'card-number' }, '4111111111111111')]))}
          siteIcon={PNG}
        />
        <CardIcon card={cardState(aCard())} siteIcon={PNG} />
      </>
    );

    expect([
      screen.queryAllByTestId('network-visa', HIDDEN).length,
      screen.queryAllByTestId('site-icon', HIDDEN).length,
    ]).toEqual([1, 1]);
  });

  it('keeps a chosen built-in icon over the site’s icon', async () => {
    await shown(
      <CardIcon
        card={cardState(aCard({ icon: { kind: 'builtin', name: 'key' } }))}
        siteIcon={PNG}
      />
    );

    expect([
      screen.queryAllByTestId('site-icon', HIDDEN).length,
      screen.queryAllByTestId('builtin-icon-key', HIDDEN).length,
    ]).toEqual([0, 1]);
  });
});
