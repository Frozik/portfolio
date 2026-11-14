import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { fireEvent, screen } from 'expo-router/testing-library';

import { pressBack } from '../testing/press-back';
import { unlockedVaultWith } from '../testing/unlocked-vault';

const BANK = aCardWith([aField({ kind: 'login' }, 'jane')], { title: 'Bank' });
const MAIL = aCardWith([aField({ kind: 'login' }, 'jane@mail.example')], { title: 'Mail' });

describe('the phone’s back over the open vault’s list', () => {
  it('puts the search away first, with what it found, and the list stays', async () => {
    const { getPathname } = await unlockedVaultWith([BANK, MAIL]);
    const listed = getPathname();
    await fireEvent.press(screen.getByTestId('toggle-search'));
    await fireEvent.changeText(screen.getByTestId('search'), 'mail');

    await pressBack();

    expect(screen.queryByTestId('search')).not.toBeOnTheScreen();
    expect(screen.getAllByTestId('card-row')).toHaveLength(2);
    expect(getPathname()).toBe(listed);
  });

  it('puts the sort away first, and the list stays', async () => {
    const { getPathname } = await unlockedVaultWith([BANK, MAIL]);
    const listed = getPathname();
    await fireEvent.press(screen.getByTestId('toggle-sort'));

    await pressBack();

    expect(screen.queryByTestId('sort-title')).not.toBeOnTheScreen();
    expect(getPathname()).toBe(listed);
  });

  it('slides an open row back first, and the list stays', async () => {
    const { getPathname } = await unlockedVaultWith([BANK]);
    const listed = getPathname();
    await fireEvent.press(screen.getByTestId('row-actions'));
    expect(screen.getByTestId('row-favorite')).toBeOnTheScreen();

    await pressBack();

    expect(screen.queryByTestId('row-favorite')).not.toBeOnTheScreen();
    expect(getPathname()).toBe(listed);
  });
});
