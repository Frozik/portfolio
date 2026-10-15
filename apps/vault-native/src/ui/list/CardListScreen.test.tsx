import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { unlockedVaultWith } from '../testing/unlocked-vault';

const BANK = aCardWith(
  [
    aField({ kind: 'login' }, 'jane'),
    aField({ kind: 'password', rotateEveryDays: null }, 'hunter2', { sensitive: true }),
  ],
  { title: 'Bank' }
);
const MAIL = aCardWith([aField({ kind: 'login' }, 'jane@mail.example')], { title: 'Mail' });
const GITHUB = aCardWith(
  [
    aField({ kind: 'url', match: 'host', useSharedCredentials: true }, [
      'https://github.com/login',
    ]),
  ],
  { title: 'GitHub' }
);

function titlesInList(): readonly string[] {
  return screen
    .getAllByTestId('card-row')
    .map(row => within(row).getAllByRole('text')[0]?.props.children);
}

describe('the open vault’s list', () => {
  it('shows every card, the login under its title and never a password', async () => {
    await unlockedVaultWith([BANK, MAIL]);

    expect(titlesInList()).toEqual(['Bank', 'Mail']);
    expect(JSON.stringify(screen.toJSON())).not.toContain('hunter2');
  });

  it('shows a site’s icon on its card and the first letter on a card with no site', async () => {
    await unlockedVaultWith([BANK, GITHUB], { siteIcons: { 'github.com': 'icon' } });

    const hidden = { includeHiddenElements: true };
    await waitFor(() => expect(screen.getAllByTestId('site-icon', hidden)).toHaveLength(1));
    const [bankRow, githubRow] = screen.getAllByTestId('card-row');
    expect({
      bank: bankRow && within(bankRow).queryByTestId('site-icon', hidden),
      github: githubRow && within(githubRow).queryByTestId('site-icon', hidden),
    }).toEqual({ bank: null, github: expect.anything() });
  });

  it('closes the new-card choice with its X, making nothing', async () => {
    await unlockedVaultWith([BANK]);

    await fireEvent.press(screen.getByTestId('new-card'));
    await fireEvent.press(await screen.findByTestId('dialog-close'));

    expect(screen.queryByTestId('new-card-dialog')).toBeNull();
    expect(screen.getAllByTestId('card-row')).toHaveLength(1);
  });

  it('narrows to what the search finds', async () => {
    await unlockedVaultWith([BANK, MAIL]);

    await fireEvent.changeText(screen.getByTestId('search'), 'mail');

    expect(titlesInList()).toEqual(['Mail']);
  });

  it('opens a card, shows its password only when asked, and copies it with a countdown', async () => {
    const { device } = await unlockedVaultWith([BANK]);
    await fireEvent.press(screen.getByTestId('card-row'));
    await screen.findByTestId('card');
    const [, passwordRow] = screen.getAllByTestId('field-value');

    const masked = passwordRow?.props.children;
    await fireEvent.press(screen.getByTestId('reveal'));
    const shown = screen.getAllByTestId('field-value')[1]?.props.children;
    const [, copyPassword] = screen.getAllByTestId('copy');
    if (copyPassword === undefined) {
      throw new Error('no copy action');
    }
    await fireEvent.press(copyPassword);

    expect({ masked, shown }).toEqual({ masked: '••••••••', shown: 'hunter2' });
    await waitFor(() => expect(device.clipboardWrites()).toContain('hunter2'));
    expect(await screen.findByTestId('copy-snackbar')).toBeOnTheScreen();
  });

  it('copies a login from the list without opening the card', async () => {
    const { device } = await unlockedVaultWith([BANK]);

    await fireEvent(screen.getByTestId('card-row'), 'longPress');
    await fireEvent.press(
      screen.getAllByTestId('row-copy')[0] ?? screen.getByTestId('row-actions')
    );

    await waitFor(() => expect(device.clipboardWrites()).toContain('jane'));
    expect(screen.queryByTestId('card')).toBeNull();
  });

  it('moves a card to the trash from the list, and out of it', async () => {
    await unlockedVaultWith([BANK, MAIL]);

    await fireEvent.press(
      screen.getAllByTestId('row-actions')[0] ?? screen.getByTestId('card-list')
    );
    await fireEvent.press(screen.getByTestId('row-trash'));

    await waitFor(() => expect(titlesInList()).toEqual(['Mail']));
  });

  it('keeps a card opened lately in a strip above the list', async () => {
    await unlockedVaultWith([BANK, MAIL]);
    await fireEvent.press(screen.getAllByTestId('card-row')[1] ?? screen.getByTestId('card-list'));
    await screen.findByTestId('card');

    await fireEvent.press(screen.getByTestId('back-to-list'));

    expect(await screen.findByTestId('recent-strip')).toBeOnTheScreen();
  });

  it('goes back to the list from a card that was opened with no list behind it', async () => {
    const { getPathname, vaultKey } = await unlockedVaultWith([BANK]);
    await act(() => router.replace(`/${vaultKey}/all/${BANK.id}`));
    await screen.findByTestId('card');

    await fireEvent.press(screen.getByTestId('back-to-list'));

    await waitFor(() => expect(getPathname()).toBe(`/${vaultKey}`));
    expect(screen.getByTestId('card-list-screen')).toBeOnTheScreen();
  });

  it('offers a first card or an import in an empty vault', async () => {
    const { getPathname, vaultKey } = await unlockedVaultWith([]);

    expect(screen.getByTestId('empty-new-card')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('empty-import'));

    await waitFor(() => expect(getPathname()).toBe(`/${vaultKey}/settings`));
  });
});
