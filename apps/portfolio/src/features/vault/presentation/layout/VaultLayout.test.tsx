import { assert } from '@frozik/utils/assert/assert';
import { allFields } from '@frozik/vault/model/card';
import { renameCard } from '@frozik/vault/model/card-edits';
import { setFieldCardinality, setFieldValue } from '@frozik/vault/model/field-edits';
import type { TCardId } from '@frozik/vault/model/ids';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { when } from 'mobx';
import { MemoryRouter } from 'react-router-dom';

import { changeCard } from '../../application/card-actions';
import { aDevice } from '../../application/fake-device.test-helper';
import type { VaultSession } from '../../application/VaultSession';
import type { TVaultPage } from '../../domain/vault-paths';
import { VaultLayout } from './VaultLayout';

async function demoSession(): Promise<VaultSession> {
  const store = aDevice().startStore();
  store.startDemo('Demo', key => key);
  await when(() => (store.session?.document.cards.size ?? 0) > 0);
  assert(store.session !== null);
  await saved(store.session);
  return store.session;
}

function secretsOf(session: VaultSession): readonly string[] {
  return [...session.document.cards.values()].flatMap(card =>
    allFields(card)
      .filter(field => field.sensitive)
      .flatMap(field =>
        field.value.cardinality === 'single' ? [field.value.value] : field.value.values
      )
      .filter(value => value !== '')
  );
}

/** Short secrets (a CVV, a PIN) appear by chance in ids and counts: those must not be a whole text or attribute. */
const SHORT_SECRET_LENGTH = 6;

function expectNoSecretIn(root: HTMLElement, secrets: readonly string[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const pieces: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node instanceof Element) {
      pieces.push(...Array.from(node.attributes, attribute => attribute.value));
    } else {
      pieces.push(node.textContent ?? '');
    }
  }
  const leaked = secrets.filter(secret =>
    pieces.some(piece =>
      secret.length < SHORT_SECRET_LENGTH ? piece.trim() === secret : piece.includes(secret)
    )
  );
  expect(leaked).toEqual([]);
}

function cardTitled(session: VaultSession, title: string) {
  const card = [...session.document.cards.values()].find(candidate => candidate.title === title);
  assert(card !== undefined);
  return card;
}

/** The session once its last edit is saved: the save re-renders the layout when it lands. */
function saved(session: VaultSession): Promise<void> {
  return when(() => session.local.state.phase.kind === 'idle');
}

function renderLayout(
  session: VaultSession,
  page: Extract<TVaultPage, { kind: 'section' | 'card' | 'history' }>
) {
  return render(
    <MemoryRouter>
      <VaultLayout session={session} page={page} onLock={() => undefined} />
    </MemoryRouter>
  );
}

describe('VaultLayout', () => {
  it('lists the demo cards with their counts and puts no secret into the page', async () => {
    const session = await demoSession();

    const { container } = renderLayout(session, { kind: 'section', section: 'all' });

    expect(screen.getAllByRole('option').length).toBeGreaterThan(5);
    expect(screen.getByRole('option', { name: /GitHub/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /•••• 1111/ })).toBeTruthy();
    expectNoSecretIn(container, secretsOf(session));
  });

  it('shows a secret only on request', async () => {
    const session = await demoSession();
    const github = cardTitled(session, 'GitHub');
    const { container } = renderLayout(session, {
      kind: 'card',
      section: 'all',
      cardId: github.id,
    });

    expect(container.textContent).not.toContain('tundra-velvet-orbit-cactus-lantern');
    const [show] = screen.getAllByRole('button', { name: 'Show', pressed: false });
    act(() => fireEvent.click(show));
    expect(container.textContent).toContain('tundra-velvet-orbit-cactus-lantern');
  });

  it('keeps the secrets of a protected card out of the page', async () => {
    const session = await demoSession();
    const passport = cardTitled(session, 'demo.passport');
    const { container } = renderLayout(session, {
      kind: 'card',
      section: 'all',
      cardId: passport.id,
    });

    expect(screen.queryAllByRole('button', { name: 'Show' })).toHaveLength(0);
    expectNoSecretIn(container, secretsOf(session));
  });

  it('says so for a card the vault does not have', async () => {
    const session = await demoSession();
    renderLayout(session, { kind: 'card', section: 'all', cardId: 'missing' as TCardId });

    expect(screen.getByTestId('card-not-found')).toBeTruthy();
  });

  it('opens a protected card with the master password typed again', async () => {
    const session = await demoSession();
    const passport = cardTitled(session, 'demo.passport');
    renderLayout(session, { kind: 'card', section: 'all', cardId: passport.id });

    act(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Open with the master password' }))
    );
    fireEvent.change(screen.getByLabelText('Master password'), { target: { value: 'demo' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Master password'), { key: 'Enter' });
      await when(() => session.protectedGate.isOpen);
    });

    expect(screen.getAllByRole('button', { name: 'Show' }).length).toBeGreaterThan(0);
  });

  it('stars a card and moves it to the trash from its menu', async () => {
    const session = await demoSession();
    const amazon = cardTitled(session, 'Amazon');
    renderLayout(session, { kind: 'card', section: 'all', cardId: amazon.id });
    const openMenu = (): void => {
      const trigger = screen.getByRole('button', { name: 'Card actions' });
      act(() => {
        fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
      });
    };

    openMenu();
    act(() => fireEvent.click(screen.getByRole('menuitem', { name: 'Add to favorites' })));
    openMenu();
    act(() => fireEvent.click(screen.getByRole('menuitem', { name: 'Move to trash' })));
    await act(() => saved(session));

    expect(session.document.cards.get(amazon.id)?.favorite).toBe(true);
    expect(session.document.cards.get(amazon.id)?.trashedAt).not.toBeNull();
  });

  it('lists the earlier versions of a card and brings one back', async () => {
    const session = await demoSession();
    const github = cardTitled(session, 'GitHub');
    session.transact(changeCard(github.id, card => renameCard(card, 'GitHub (renamed)')));
    await saved(session);
    renderLayout(session, { kind: 'history', section: 'all', cardId: github.id });

    const [latest] = screen.getAllByTestId('revision-changes');
    expect(latest?.textContent).toContain('GitHub (renamed)');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Restore this version' })));
    await act(() => saved(session));

    expect(session.document.cards.get(github.id)?.title).toBe('GitHub');
  });

  it('shows a password rotation as the one in use and the one before, each shown on its own', async () => {
    const session = await demoSession();
    const github = cardTitled(session, 'GitHub');
    const password = allFields(github).find(field => field.spec.kind === 'password');
    assert(password !== undefined);
    session.transact(
      changeCard(github.id, card =>
        setFieldValue(setFieldCardinality(card, password.id, 'list'), password.id, {
          cardinality: 'list',
          values: ['autumn-3', 'summer-2', 'spring-1'],
        })
      )
    );
    await saved(session);
    const { container } = renderLayout(session, {
      kind: 'card',
      section: 'all',
      cardId: github.id,
    });

    expect(
      screen.getAllByTestId('password-in-turn').map(row => row.getAttribute('data-state'))
    ).toEqual(['current', 'previous']);
    expect(container.textContent).not.toContain('autumn-3');
    const [showCurrent] = screen.getAllByRole('button', { name: 'Show' });
    assert(showCurrent !== undefined);
    act(() => fireEvent.click(showCurrent));

    expect(container.textContent).toContain('autumn-3');
    expect(container.textContent).not.toContain('summer-2');
    expect(container.textContent).not.toContain('spring-1');
    expect(screen.queryByRole('button', { name: 'Next password' })).toBeNull();
  });

  it('opens the sections from the menu button and closes them once one is picked', async () => {
    const session = await demoSession();
    renderLayout(session, { kind: 'section', section: 'all' });

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Sections and groups' })));
    const menu = screen.getByRole('dialog', { name: 'Sections' });
    const favourites = within(menu).getByRole('link', { name: /Favorites/ });
    act(() => fireEvent.click(favourites));

    expect(screen.queryByRole('dialog', { name: 'Sections' })).toBeNull();
  });

  it('draws a bank card as the plastic and warns that it expired, keeping its secrets out', async () => {
    const session = await demoSession();
    const amex = cardTitled(session, 'American Express');
    const { container } = renderLayout(session, { kind: 'card', section: 'all', cardId: amex.id });

    expect(container.querySelector('[data-network="american-express"] svg')).not.toBeNull();
    expect(container.textContent).toContain('•••• 0005');
    expect(screen.getByTestId('card-expired')).toBeTruthy();
    expectNoSecretIn(container, secretsOf(session));
  });

  it('lists the cards online banking is linked with, and offers to change a site password', async () => {
    const session = await demoSession();
    const banking = cardTitled(session, 'demo.onlineBanking');
    renderLayout(session, { kind: 'card', section: 'all', cardId: banking.id });

    expect(screen.getByRole('button', { name: 'Visa Classic' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mastercard Gold' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Change the password on the site' })).toBeTruthy();
  });

  it('writes a password out large, one numbered cell per character', async () => {
    const session = await demoSession();
    const dropbox = cardTitled(session, 'Dropbox');
    renderLayout(session, { kind: 'card', section: 'all', cardId: dropbox.id });

    act(() => fireEvent.click(screen.getAllByRole('button', { name: 'Large' })[0]));

    expect(screen.getAllByRole('listitem')).toHaveLength('K7#mPq2!vRx9wLs4'.length);
  });

  it('shows the live one-time code, copies the code and never the secret behind it', async () => {
    const session = await demoSession();
    const github = cardTitled(session, 'GitHub');
    const { container } = renderLayout(session, {
      kind: 'card',
      section: 'all',
      cardId: github.id,
    });

    await waitFor(() =>
      expect(screen.getByLabelText('One-time code').textContent).toMatch(/^\d{3} \d{3}$/)
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Copy code' })));

    await waitFor(() => expect(session.clipboard.clearsAt).not.toBeNull());
    expect(container.innerHTML).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('shows the passport scan once the protected card is open', async () => {
    const session = await demoSession();
    const passport = cardTitled(session, 'demo.passport');
    renderLayout(session, { kind: 'card', section: 'all', cardId: passport.id });

    expect(screen.queryByRole('img', { name: 'passport-specimen.svg' })).toBeNull();
    await act(async () => {
      expect(await session.openProtected('demo')).toBeNull();
    });
    act(() => fireEvent.mouseDown(screen.getByRole('tab', { name: 'tab.scans' })));

    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'passport-specimen.svg' })).toBeTruthy()
    );
  });
});
