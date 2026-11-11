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

/** Widths in dp: a phone's field row, a short name beside its actions, a name that leaves them no room. */
const ROOMY_ROW = 360;
const SHORT_NAME = 60;
const LONG_NAME = 300;

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

  it('gives the card a built-in icon in a colour', async () => {
    const { app } = await editBank();

    await fireEvent.press(screen.getByTestId('card-icon-choice'));
    await fireEvent.press(await screen.findByTestId('icon-option-wifi'));
    await fireEvent.press(screen.getByTestId('card-color-teal'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect({ icon: saved?.icon, color: saved?.color }).toEqual({
      icon: { kind: 'builtin', name: 'wifi' },
      color: 'teal',
    });
  });

  it('gives a colour to a card that keeps its automatic icon too: the icon sits on it', async () => {
    const { app } = await editBank();

    await fireEvent.press(screen.getByTestId('card-color-violet'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect({ icon: saved?.icon, color: saved?.color }).toEqual({
      icon: { kind: 'auto' },
      color: 'violet',
    });
  });

  it('makes the card protected from the editor', async () => {
    const { app } = await editBank();

    await fireEvent.press(screen.getByTestId('editor-protected'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    expect([...(app.session?.document.cards.values() ?? [])][0]?.protected).toBe(true);
  });

  it('moves a field down with the action its ⋯ slides out, and slides the name back', async () => {
    const { app } = await editBank();
    const [loginActions] = screen.getAllByTestId('field-actions');
    if (loginActions === undefined) {
      throw new Error('no field menu');
    }

    await fireEvent.press(loginActions);
    await fireEvent.press(await screen.findByTestId('field-move-down'));
    await waitFor(() => expect(screen.queryByTestId('field-move-down')).not.toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect(saved?.tabs[0]?.fields.map(field => field.spec.kind)).toEqual(['password', 'login']);
  });

  it('slides the name back at a press anywhere on the slid head, leaving the field as it was', async () => {
    const { app } = await editBank();
    const [loginActions] = screen.getAllByTestId('field-actions');
    if (loginActions === undefined) {
      throw new Error('no field menu');
    }

    await fireEvent.press(loginActions);
    await screen.findByTestId('field-move-down');
    await fireEvent.press(screen.getByTestId('row-slide-close'));
    await waitFor(() => expect(screen.queryByTestId('field-move-down')).not.toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect(saved?.tabs[0]?.fields.map(field => field.spec.kind)).toEqual(['login', 'password']);
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

  it('deletes an earlier version from the history and leaves the card as it is', async () => {
    const { app } = await editBank();
    const [login] = screen.getAllByTestId('field-editor');
    if (login === undefined) {
      throw new Error('no login editor');
    }
    await fireEvent.changeText(login, 'jane.doe');
    await fireEvent.press(screen.getByTestId('editor-save'));
    await fireEvent.press(await screen.findByTestId('card-history'));
    const before = (await screen.findAllByTestId('revision')).length;

    await fireEvent.press(
      screen.getAllByTestId('delete-revision')[0] ?? screen.getByTestId('card-history')
    );

    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect({
      before,
      after: screen.queryAllByTestId('revision').length,
      history: saved?.history.length,
    }).toEqual({ before: 1, after: 0, history: 0 });
    await fireEvent.press(screen.getByTestId('history-back'));
    await screen.findByTestId('card');
    expect(shownValues()[0]).toBe('jane.doe');
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

  it('renames a tab and deletes another through the pencil on each tab', async () => {
    const { app } = await editBank();
    await fireEvent.press(screen.getByTestId('editor-add-tab'));
    await fireEvent.press(screen.getByTestId('editor-add-tab'));

    await fireEvent.press(
      screen.getAllByTestId('editor-tab-edit')[1] ?? screen.getByTestId('card-editor')
    );
    await fireEvent.changeText(await screen.findByTestId('tab-name'), 'Sign-in');
    await fireEvent.press(screen.getByTestId('tab-save'));
    await fireEvent.press(
      screen.getAllByTestId('editor-tab-edit')[2] ?? screen.getByTestId('card-editor')
    );
    await fireEvent.press(await screen.findByTestId('tab-remove'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect(saved?.tabs.map(tab => tab.title)).toEqual([null, 'Sign-in']);
  });

  it('never offers to delete the only tab', async () => {
    await editBank();

    await fireEvent.press(screen.getByTestId('editor-tab-edit'));

    expect(await screen.findByTestId('tab-name')).toBeOnTheScreen();
    expect(screen.queryByTestId('tab-remove')).not.toBeOnTheScreen();
  });

  it('asks before deleting a tab with fields, and they go with it', async () => {
    const { app } = await editBank();
    await fireEvent.press(screen.getByTestId('editor-add-tab'));

    await fireEvent.press(
      screen.getAllByTestId('editor-tab-edit')[0] ?? screen.getByTestId('card-editor')
    );
    await fireEvent.press(await screen.findByTestId('tab-remove'));
    await fireEvent.press(await screen.findByTestId('tab-remove-with-fields'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect(saved?.tabs.map(tab => tab.fields.length)).toEqual([0]);
  });

  it('lays a field’s actions beside its name when they fit, and folds them into ⋯ when not', async () => {
    const { app } = await editBank();
    const lay = async (index: number, head: number, name: number): Promise<void> => {
      const [headView, measure] = [
        screen.getAllByTestId('field-head')[index],
        screen.getAllByTestId('field-name-measure', { includeHiddenElements: true })[index],
      ];
      if (headView === undefined || measure === undefined) {
        throw new Error('no field head');
      }
      await fireEvent(headView, 'layout', { nativeEvent: { layout: { width: head } } });
      await fireEvent(measure, 'layout', { nativeEvent: { layout: { width: name } } });
    };

    await lay(0, ROOMY_ROW, SHORT_NAME);
    await lay(1, ROOMY_ROW, LONG_NAME);
    const folded = screen.getAllByTestId('field-actions').length;
    await fireEvent.press(screen.getByTestId('field-move-down'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('card');
    const saved = [...(app.session?.document.cards.values() ?? [])][0];
    expect({ folded, kinds: saved?.tabs[0]?.fields.map(field => field.spec.kind) }).toEqual({
      folded: 1,
      kinds: ['password', 'login'],
    });
  });
});
