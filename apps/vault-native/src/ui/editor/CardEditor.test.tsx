import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { unlockedVaultWith } from '../testing/unlocked-vault';

const BANK = aCardWith(
  [
    aField({ kind: 'login' }, 'jane'),
    aField({ kind: 'password', rotateEveryDays: null }, 'hunter2', { sensitive: true }),
  ],
  { title: 'Bank' }
);

async function editBank() {
  const vault = await unlockedVaultWith([BANK]);
  await fireEvent.press(screen.getByTestId('card-row'));
  await fireEvent.press(await screen.findByTestId('edit-card'));
  await screen.findByTestId('card-editor');
  return vault;
}

function shownValues(): readonly unknown[] {
  return screen.getAllByTestId('field-value').map(value => value.props.children);
}

describe('editing a card on the phone', () => {
  it('saves a changed login and shows it on the card', async () => {
    await editBank();
    const [login] = screen.getAllByTestId('field-editor');
    if (login === undefined) {
      throw new Error('no login editor');
    }

    await fireEvent.changeText(login, 'jane.doe');
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    expect(shownValues()[0]).toBe('jane.doe');
  });

  it('gives the card a built-in icon in a colour, offering colours only for a chosen icon', async () => {
    const { app } = await editBank();
    const colorsBefore = screen.queryAllByTestId('card-color-teal').length;

    await fireEvent.press(screen.getByTestId('card-icon-choice'));
    await fireEvent.press(await screen.findByTestId('icon-option-wifi'));
    await fireEvent.press(screen.getByTestId('card-color-teal'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect({ colorsBefore, icon: saved?.icon, color: saved?.color }).toEqual({
      colorsBefore: 0,
      icon: { kind: 'builtin', name: 'wifi' },
      color: 'teal',
    });
  });

  it('moves a field down through its menu, keeping the label in sight', async () => {
    const { app } = await editBank();
    const [loginActions] = screen.getAllByTestId('field-actions');
    if (loginActions === undefined) {
      throw new Error('no field menu');
    }

    await fireEvent.press(loginActions);
    await fireEvent.press(await screen.findByTestId('field-move-down'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect(saved?.tabs[0]?.fields.map(field => field.spec.kind)).toEqual(['password', 'login']);
  });

  it('asks before throwing a changed card away, and keeps the saved one', async () => {
    await editBank();
    await fireEvent.changeText(screen.getByTestId('editor-title'), 'Not the bank');

    await fireEvent.press(screen.getByTestId('editor-cancel'));
    await fireEvent.press(await screen.findByTestId('confirm-discard'));

    await screen.findByTestId('card');
    expect(screen.getAllByRole('header').map(header => header.props.children)).toContain('Bank');
  });

  it('puts a generated password into the field', async () => {
    await editBank();

    await fireEvent.press(screen.getByTestId('generate'));
    const generated = screen.getByTestId('generated').props.children;
    await fireEvent.press(screen.getByTestId('generator-use'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    await fireEvent.press(screen.getByTestId('reveal'));
    expect(shownValues()[1]).toBe(generated);
  });

  it('makes a new card from a template and lists it', async () => {
    await unlockedVaultWith([BANK]);

    await fireEvent.press(screen.getByTestId('new-card'));
    await fireEvent.press(screen.getByTestId('template-note'));
    await fireEvent.changeText(await screen.findByTestId('editor-title'), 'Wi-Fi');
    await fireEvent.press(screen.getByTestId('editor-save'));
    await screen.findByTestId('card');
    await fireEvent.press(screen.getByTestId('back-to-list'));

    await waitFor(() => expect(screen.getAllByTestId('card-row')).toHaveLength(2));
  });
});

describe('a card’s history on the phone', () => {
  it('brings an earlier version back as a new edit', async () => {
    await editBank();
    const [login] = screen.getAllByTestId('field-editor');
    if (login === undefined) {
      throw new Error('no login editor');
    }
    await fireEvent.changeText(login, 'jane.doe');
    await fireEvent.press(screen.getByTestId('editor-save'));
    await fireEvent.press(await screen.findByTestId('card-history'));

    const [latest] = await screen.findAllByTestId('restore-revision');
    if (latest === undefined) {
      throw new Error('no earlier version');
    }
    await fireEvent.press(latest);
    expect(screen.getByTestId('restored')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('history-back'));

    await screen.findByTestId('card');
    expect(shownValues()[0]).toBe('jane');
  });
});

describe('leaving the editor with the system back', () => {
  it('asks before throwing a changed card away, then leaves editing free again', async () => {
    await editBank();
    await fireEvent.changeText(screen.getByTestId('editor-title'), 'Not the bank');

    await act(() => router.back());
    await fireEvent.press(await screen.findByTestId('confirm-leave'));

    await waitFor(() => expect(screen.queryByTestId('card-editor')).toBeNull());
    expect(screen.getByTestId('new-card')).toBeEnabled();
  });

  it('lets an unchanged draft go without asking', async () => {
    const { app } = await editBank();

    await act(() => router.back());

    await waitFor(() => expect(app.session?.editing.draft).toBeNull());
    expect(screen.queryByTestId('confirm-leave')).toBeNull();
  });
});
