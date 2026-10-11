import { assert } from '@frozik/utils/assert/assert';
import { allFields } from '@frozik/vault/model/card';
import { renameCard } from '@frozik/vault/model/card-edits';
import { setTypedFieldValue } from '@frozik/vault/model/field-edits';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { when } from 'mobx';
import { MemoryRouter } from 'react-router-dom';

import { typeInto } from '@frozik/components/components/RichEditor/editor-test-helpers.test-helper';

import { aDevice } from '../../application/fake-device.test-helper';
import type { VaultSession } from '../../application/VaultSession';
import { VaultLayout } from '../layout/VaultLayout';

async function editingGithub() {
  const store = aDevice().startStore();
  store.startDemo('Demo', key => key);
  await when(() => (store.session?.document.cards.size ?? 0) > 0);
  const session: VaultSession | null = store.session;
  assert(session !== null);
  const github = [...session.document.cards.values()].find(card => card.title === 'GitHub');
  assert(github !== undefined);
  render(
    <MemoryRouter>
      <VaultLayout
        session={session}
        page={{ kind: 'card', section: 'all', cardId: github.id }}
        onLock={() => undefined}
      />
    </MemoryRouter>
  );
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Edit' })));
  return { session, github };
}

describe('CardEditor', () => {
  it('saves the edit into the vault and goes back to reading the card', async () => {
    const { session, github } = await editingGithub();

    act(() => session.editing.draft?.change(card => renameCard(card, 'GitHub (work)')));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));

    expect(session.document.cards.get(github.id)?.title).toBe('GitHub (work)');
    expect(session.editing.draft).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('holds every other edit back while the card is edited, and gives it back on cancel', async () => {
    await editingGithub();
    const actions = () => [
      screen.getByRole('combobox', { name: 'New card' }),
      screen.getByRole('button', { name: '+ New group' }),
      screen.getByRole('button', { name: '+ Smart group' }),
    ];

    expect(actions().every(action => action.hasAttribute('disabled'))).toBe(true);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })));

    expect(actions().some(action => action.hasAttribute('disabled'))).toBe(false);
  });

  it('saves with Ctrl+S', async () => {
    const { session, github } = await editingGithub();

    act(() => session.editing.draft?.change(card => renameCard(card, 'Renamed')));
    act(() => {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    });

    expect(session.document.cards.get(github.id)?.title).toBe('Renamed');
  });

  it('asks before throwing away changes', async () => {
    const { session } = await editingGithub();

    act(() => session.editing.draft?.change(card => renameCard(card, 'Half done')));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })));

    expect(screen.getByText('Discard the changes?')).toBeTruthy();
    expect(session.editing.draft).not.toBeNull();
  });

  it('asks before removing a field with a value, and removes an empty one at once', async () => {
    const { session } = await editingGithub();
    const draft = session.editing.draft;
    assert(draft !== null);
    const login = allFields(draft.card).find(field => field.spec.kind === 'login');
    assert(login !== undefined);

    act(() => fireEvent.click(screen.getByRole('button', { name: `Remove “${login.label}”` })));
    expect(screen.getByText(`Remove “${login.label}”?`)).toBeTruthy();
    expect(allFields(draft.card).some(field => field.id === login.id)).toBe(true);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Remove' })));
    expect(allFields(draft.card).some(field => field.id === login.id)).toBe(false);

    const email = allFields(draft.card).find(field => field.spec.kind === 'email');
    assert(email !== undefined);
    act(() =>
      draft.change(card => setTypedFieldValue(card, email.id, { cardinality: 'single', value: '' }))
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: `Remove “${email.label}”` })));
    expect(allFields(draft.card).some(field => field.id === email.id)).toBe(false);
  });

  it('adds a tab from the tab bar, moves a field into it, and deletes it keeping the field', async () => {
    const { session } = await editingGithub();
    const draft = session.editing.draft;
    assert(draft !== null);
    const login = allFields(draft.card).find(field => field.spec.kind === 'login');
    assert(login !== undefined);

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Main']);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add a tab' })));
    expect(screen.getByRole('tab', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'New tab', selected: true })).toBeTruthy();

    act(() => fireEvent.mouseDown(screen.getByRole('tab', { name: 'Main' })));
    act(() =>
      fireEvent.pointerDown(
        screen.getByRole('button', { name: `Move “${login.label}” to another tab` }),
        { button: 0, ctrlKey: false }
      )
    );
    act(() => fireEvent.click(screen.getByRole('menuitem', { name: 'New tab' })));
    expect(draft.card.tabs[1]?.fields.map(field => field.id)).toEqual([login.id]);

    act(() => fireEvent.mouseDown(screen.getByRole('tab', { name: 'New tab' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Delete tab' })));
    expect(screen.getByText('Delete the “New tab” tab?')).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Move the fields and delete' })));

    expect(draft.card.tabs).toHaveLength(1);
    expect(allFields(draft.card).some(field => field.id === login.id)).toBe(true);
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Main']);
  });

  it('asks before deleting even an empty tab', async () => {
    const { session } = await editingGithub();
    const draft = session.editing.draft;
    assert(draft !== null);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add a tab' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Delete tab' })));
    expect(screen.getByText('Delete the “New tab” tab?')).toBeTruthy();
    expect(draft.card.tabs).toHaveLength(2);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Delete' })));

    expect(draft.card.tabs).toHaveLength(1);
  });

  it('renames a field from its pencil and keeps the old name for a blank one', async () => {
    const { session } = await editingGithub();
    const draft = session.editing.draft;
    assert(draft !== null);
    const login = allFields(draft.card).find(field => field.spec.kind === 'login');
    assert(login !== undefined);
    const labelOf = () => allFields(draft.card).find(field => field.id === login.id)?.label;

    act(() => fireEvent.click(screen.getByRole('button', { name: `Rename “${login.label}”` })));
    const name = screen.getByRole('textbox', { name: 'Field name' });
    expect(document.activeElement).toBe(name);
    typeInto(name, {
      data: ' (work)',
      selection: { start: login.label.length, end: login.label.length },
    });
    expect(labelOf()).toBe(`${login.label} (work)`);
    act(() => name.blur());
    expect(screen.queryByRole('textbox', { name: 'Field name' })).toBeNull();

    act(() =>
      fireEvent.click(screen.getByRole('button', { name: `Rename “${login.label} (work)”` }))
    );
    const again = screen.getByRole('textbox', { name: 'Field name' });
    typeInto(again, {
      inputType: 'deleteContentBackward',
      selection: { start: 0, end: `${login.label} (work)`.length },
    });
    act(() => again.blur());

    expect(labelOf()).toBe(`${login.label} (work)`);
  });

  it('adds as many file fields as wanted, each holding a list of files', async () => {
    const { session } = await editingGithub();
    const draft = session.editing.draft;
    assert(draft !== null);
    const addFiles = () => {
      act(() => fireEvent.click(screen.getByRole('combobox', { name: 'Add a field' })));
      act(() => fireEvent.click(screen.getByRole('option', { name: 'Files' })));
    };

    addFiles();
    addFiles();

    const files = allFields(draft.card).filter(field => field.spec.kind === 'file');
    expect(files).toHaveLength(2);
    expect(files.every(field => field.value.cardinality === 'list')).toBe(true);
  });

  it('moves a password rotation on in the editor, the oldest coming back on top', async () => {
    const { session } = await editingGithub();
    const draft = session.editing.draft;
    assert(draft !== null);
    const password = allFields(draft.card).find(field => field.spec.kind === 'password');
    assert(password !== undefined);

    act(() => fireEvent.click(screen.getByRole('checkbox', { name: 'Several passwords in turn' })));
    act(() =>
      draft.change(card =>
        setTypedFieldValue(card, password.id, {
          cardinality: 'list',
          values: ['autumn-3', 'summer-2', 'spring-1'],
        })
      )
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next password' })));

    expect(allFields(draft.card).find(field => field.id === password.id)?.value).toEqual({
      cardinality: 'list',
      values: ['spring-1', 'autumn-3', 'summer-2'],
    });
  });

  it('marks the fields changed in the editor and the card in the list until it is saved', async () => {
    const { session } = await editingGithub();
    const draft = session.editing.draft;
    assert(draft !== null);
    const login = allFields(draft.card).find(field => field.spec.kind === 'login');
    assert(login !== undefined);
    expect(screen.queryAllByText('(changed, not saved yet)')).toHaveLength(0);

    act(() =>
      draft.change(card =>
        setTypedFieldValue(card, login.id, { cardinality: 'single', value: 'someone-else' })
      )
    );

    expect(screen.getAllByText('(changed, not saved yet)')).toHaveLength(1);
    expect(screen.getByText('not saved')).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(screen.queryByText('not saved')).toBeNull();
  });

  it('will not save a value its kind rejects, and says why', async () => {
    const { session } = await editingGithub();
    const draft = session.editing.draft;
    assert(draft !== null);
    const websites = allFields(draft.card).find(field => field.spec.kind === 'url');
    assert(websites !== undefined);

    act(() =>
      draft.change(card =>
        setTypedFieldValue(card, websites.id, { cardinality: 'list', values: ['not a site'] })
      )
    );

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    expect(screen.getByText('This does not look like a web address.')).toBeTruthy();
  });
});
