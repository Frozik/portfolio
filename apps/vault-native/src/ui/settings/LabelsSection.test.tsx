import type { TTemplateId } from '@frozik/vault/model/ids';
import { aCardWith } from '@frozik/vault/testing/builders';
import { fireEvent, screen, within } from 'expo-router/testing-library';

import { openSettingsTopic } from '../testing/settings-topic';
import { startSwipes } from '../testing/swipe';
import { unlockedVaultWith } from '../testing/unlocked-vault';

const NOTE = aCardWith([], { title: 'Note', templateId: 'note' as TTemplateId });

async function labelMade(name: string) {
  const rendered = await unlockedVaultWith([NOTE]);
  await openSettingsTopic('labels');
  await fireEvent.press(screen.getByTestId('label-add'));
  await fireEvent.changeText(screen.getByTestId('label-name'), name);
  await fireEvent.press(screen.getByTestId('label-color-green'));
  await fireEvent.press(screen.getByTestId('label-save'));
  return rendered;
}

function labelsOf(app: Awaited<ReturnType<typeof unlockedVaultWith>>['app']) {
  return [...(app.session?.document.groups.values() ?? [])].map(({ name, color }) => ({
    name,
    color,
  }));
}

describe('the labels in the settings', () => {
  it('makes a label with a colour, and the sections sheet lists it among the labels', async () => {
    const { app } = await labelMade('Health');

    await fireEvent.press(screen.getByTestId('tab-vault'));
    await fireEvent.press(await screen.findByTestId('open-sections'));

    expect(labelsOf(app)).toEqual([{ name: 'Health', color: 'green' }]);
    const labels = screen.getByTestId('section-block-labels');
    expect(within(labels).getAllByRole('link')).toHaveLength(1);
  });

  it('renames and recolours a label', async () => {
    const { app } = await labelMade('Health');

    await fireEvent.press(screen.getByTestId('label-row'));
    await fireEvent.changeText(screen.getByTestId('label-name'), 'Medical');
    await fireEvent.press(screen.getByTestId('label-color-none'));
    await fireEvent.press(screen.getByTestId('label-save'));

    expect(labelsOf(app)).toEqual([{ name: 'Medical', color: null }]);
  });

  it('deletes a label only once asked twice, and keeps its cards', async () => {
    const { app } = await labelMade('Health');

    await fireEvent.press(screen.getByTestId('label-row'));
    await fireEvent.press(screen.getByTestId('label-delete'));
    const before = labelsOf(app);
    await fireEvent.press(screen.getByTestId('label-delete-confirm'));

    expect({
      before: before.length,
      after: labelsOf(app),
      cards: app.session?.document.cards.size,
    }).toEqual({ before: 1, after: [], cards: 1 });
  });
});

describe('a label in the sections sheet', () => {
  it('opens its editor with the action a swipe left uncovers, and the change is kept', async () => {
    const { app } = await labelMade('Health');
    await fireEvent.press(screen.getByTestId('tab-vault'));
    await fireEvent.press(await screen.findByTestId('open-sections'));

    await startSwipes();
    await fireEvent.press(screen.getByTestId('section-swipe-edit'));
    await fireEvent.changeText(await screen.findByTestId('label-name'), 'Medical');
    await fireEvent.press(screen.getByTestId('label-save'));

    expect(labelsOf(app)).toEqual([{ name: 'Medical', color: 'green' }]);
  });
});

describe('the sections sheet', () => {
  it('lists notes and the archive and trash among the sections, apart from the security finds', async () => {
    await unlockedVaultWith([NOTE]);

    await fireEvent.press(screen.getByTestId('open-sections'));

    const sections = screen.getByTestId('section-block-sections');
    expect({
      notes: within(sections).queryByTestId('section-notes'),
      archive: within(sections).queryByTestId('section-archive'),
      trash: within(sections).queryByTestId('section-trash'),
    }).toEqual({ notes: expect.anything(), archive: expect.anything(), trash: expect.anything() });
  });
});
