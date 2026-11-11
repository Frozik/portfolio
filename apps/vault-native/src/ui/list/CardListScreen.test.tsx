import type { TTemplateId } from '@frozik/vault/model/ids';
import { aCardWith, aField, anHlc } from '@frozik/vault/testing/builders';
import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { Dimensions } from 'react-native';

import { openSettingsTopic } from '../testing/settings-topic';
import { startSwipes } from '../testing/swipe';
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
const NARROW_PHONE_WIDTH = 360;

/** Bank goes to the trash by its swipe, and the trash is shown: a trash dated long ago would empty itself. */
async function inTheTrash(vaultKey: string): Promise<void> {
  await startSwipes();
  await fireEvent.press(
    screen.getAllByTestId('row-swipe-trash')[0] ?? screen.getByTestId('card-list')
  );
  await act(() => router.push(`/${vaultKey}/trash`));
}

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

  it('keeps the search and the sort out of sight until asked for', async () => {
    await unlockedVaultWith([BANK, MAIL]);

    expect(screen.queryByTestId('search')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('sort-title')).not.toBeOnTheScreen();
    expect(screen.getByTestId('toggle-search')).not.toBeSelected();
    expect(screen.getByTestId('toggle-sort')).not.toBeSelected();
  });

  it('narrows to what the search finds, and shows every card again once the search is put away', async () => {
    await unlockedVaultWith([BANK, MAIL]);

    await fireEvent.press(screen.getByTestId('toggle-search'));
    await fireEvent.changeText(screen.getByTestId('search'), 'mail');
    expect(screen.getByTestId('toggle-search')).toBeSelected();
    expect(titlesInList()).toEqual(['Mail']);

    await fireEvent.press(screen.getByTestId('toggle-search'));
    expect(screen.queryByTestId('search')).not.toBeOnTheScreen();
    // FlashList reuses the cell it already has, so the tree's order is not the screen's.
    expect([...titlesInList()].sort()).toEqual(['Bank', 'Mail']);
  });

  it('sorts by the choice the sort button uncovers, and keeps it once the choice is put away', async () => {
    await unlockedVaultWith([BANK, MAIL]);

    await fireEvent.press(screen.getByTestId('toggle-sort'));
    expect(screen.getByTestId('toggle-sort')).toBeSelected();
    await fireEvent.press(screen.getByTestId('sort-created'));
    await fireEvent.press(screen.getByTestId('toggle-sort'));
    await fireEvent.press(screen.getByTestId('toggle-sort'));

    expect(screen.getByTestId('sort-created')).toBeChecked();
  });

  it('shares one button between the search and the sort on a narrow phone', async () => {
    const wide = Dimensions.get('window');
    Dimensions.set({ window: { ...wide, width: NARROW_PHONE_WIDTH } });
    try {
      await unlockedVaultWith([BANK, MAIL]);

      await fireEvent.press(screen.getByTestId('toggle-tools'));

      expect({
        separate: screen.queryByTestId('toggle-search'),
        search: screen.getByTestId('search'),
        sort: screen.getByTestId('sort-title'),
      }).toEqual({ separate: null, search: expect.anything(), sort: expect.anything() });
    } finally {
      Dimensions.set({ window: wide });
    }
  });

  it('opens the sections sheet from the Vault tab on the list, again after it was closed', async () => {
    await unlockedVaultWith([BANK, MAIL]);

    await fireEvent.press(screen.getByTestId('tab-vault'));
    await fireEvent.press(await screen.findByTestId('section-all'));
    await waitFor(() => expect(screen.queryByTestId('section-sheet')).not.toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('tab-vault'));

    expect(await screen.findByTestId('section-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-vault')).toBeSelected();
  });

  it('comes back to the list from another tab through the Vault tab, the sheet only on the next press', async () => {
    const { getPathname, vaultKey } = await unlockedVaultWith([BANK]);
    await fireEvent.press(screen.getByTestId('tab-settings'));
    await screen.findByTestId('settings');

    await fireEvent.press(screen.getByTestId('tab-vault'));
    await screen.findByTestId('card-row');
    const sheetOnReturn = screen.queryByTestId('section-sheet');
    await fireEvent.press(screen.getByTestId('tab-vault'));

    expect({
      sheetOnReturn,
      sheet: await screen.findByTestId('section-sheet'),
      path: getPathname(),
      tabs: ['vault', 'sections', 'audit', 'settings'].map(
        tab => screen.queryByTestId(`tab-${tab}`) !== null
      ),
    }).toEqual({
      sheetOnReturn: null,
      sheet: expect.anything(),
      path: `/${vaultKey}`,
      tabs: [true, false, true, true],
    });
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

  it('copies the login and the password from the row’s ⋯ without opening the card', async () => {
    const { device } = await unlockedVaultWith([BANK]);

    await fireEvent.press(screen.getByTestId('row-actions'));
    await fireEvent.press(screen.getByTestId('row-copy-login'));
    await fireEvent.press(screen.getByTestId('row-copy-password'));

    await waitFor(() => expect(device.clipboardWrites()).toEqual(['jane', 'hunter2']));
    expect(screen.queryByTestId('card')).toBeNull();
  });

  it('offers a bank card its number, holder, expiry and PIN to copy from the row', async () => {
    const visa = aCardWith(
      [
        aField({ kind: 'card-number' }, '4111111111111111'),
        aField({ kind: 'text' }, 'JANE DOE'),
        aField({ kind: 'expiry-month' }, '2028-04'),
        aField({ kind: 'pin' }, '4321', { sensitive: true }),
      ],
      { title: 'Visa', templateId: 'bank-card' as TTemplateId }
    );
    const { device } = await unlockedVaultWith([visa]);

    await fireEvent.press(screen.getByTestId('row-actions'));
    const offered = ['card-number', 'holder', 'expiry', 'pin', 'login'].map(
      role => screen.queryByTestId(`row-copy-${role}`) !== null
    );
    await fireEvent.press(screen.getByTestId('row-copy-pin'));

    await waitFor(() => expect(device.clipboardWrites()).toEqual(['4321']));
    expect(offered).toEqual([true, true, true, true, false]);
  });

  it('slides the actions back in with the ⋯ again, and keeps one row open at a time', async () => {
    await unlockedVaultWith([BANK, MAIL]);
    const [first, second] = screen.getAllByTestId('row-actions');

    await fireEvent.press(first ?? screen.getByTestId('card-list'));
    await fireEvent.press(second ?? screen.getByTestId('card-list'));
    const open = screen.getAllByTestId('row-favorite').length;
    await fireEvent.press(
      screen.getAllByTestId('row-actions')[1] ?? screen.getByTestId('card-list')
    );

    expect({ open, after: screen.queryAllByTestId('row-favorite').length }).toEqual({
      open: 1,
      after: 0,
    });
  });

  it('marks a card with files by a paper clip after its title', async () => {
    const scanned = aCardWith([aField({ kind: 'file' }, ['asset-1'])], { title: 'Passport' });
    await unlockedVaultWith([scanned, MAIL]);

    const rows = await screen.findAllByTestId('card-row');

    expect(
      rows.map(row => [
        within(row).getAllByRole('text')[0]?.props.children,
        within(row).queryAllByTestId('row-has-files').length,
      ])
    ).toEqual(
      expect.arrayContaining([
        ['Passport', 1],
        ['Mail', 0],
      ])
    );
  });

  it('stars a card and protects it from the row, but offers no way to take protection off there', async () => {
    const { app } = await unlockedVaultWith([BANK]);
    const saved = () => app.session?.document.cards.get(BANK.id);

    await fireEvent(screen.getByTestId('card-row'), 'longPress');
    await fireEvent.press(screen.getByTestId('row-favorite'));
    await fireEvent.press(screen.getByTestId('row-protect'));

    expect({
      favorite: saved()?.favorite,
      protected: saved()?.protected,
      unprotect: screen.queryByTestId('row-protect'),
    }).toEqual({ favorite: true, protected: true, unprotect: null });
  });

  it('moves a card to the trash with the action a swipe right uncovers', async () => {
    await unlockedVaultWith([BANK, MAIL]);

    await startSwipes();
    await fireEvent.press(
      screen.getAllByTestId('row-swipe-trash')[0] ?? screen.getByTestId('card-list')
    );

    await waitFor(() => expect(titlesInList()).toEqual(['Mail']));
  });

  it('moves a card to the archive with the action a swipe left uncovers', async () => {
    const { app } = await unlockedVaultWith([BANK, MAIL]);

    await startSwipes();
    await fireEvent.press(
      screen.getAllByTestId('row-swipe-archive')[0] ?? screen.getByTestId('card-list')
    );

    await waitFor(() => expect(titlesInList()).toEqual(['Mail']));
    expect(app.session?.document.cards.get(BANK.id)?.archivedAt).not.toBeNull();
  });

  it('takes its tools out of the top row while a card is open, and brings them back', async () => {
    await unlockedVaultWith([BANK]);

    await fireEvent.press(screen.getByTestId('card-row'));
    await screen.findByTestId('card');
    const onCard = screen.queryByTestId('new-card');
    await fireEvent.press(screen.getByTestId('back-to-list'));

    expect(onCard).toBeNull();
    expect(await screen.findByTestId('new-card')).toBeOnTheScreen();
  });

  it('deletes a card in the trash for good with the action a swipe right uncovers', async () => {
    const { app, vaultKey } = await unlockedVaultWith([BANK, MAIL]);
    await inTheTrash(vaultKey);

    await startSwipes();
    await fireEvent.press(await screen.findByTestId('row-swipe-purge'));

    await waitFor(() => expect(app.session?.document.cards.has(BANK.id)).toBe(false));
  });

  it('takes a card out of the trash with the action a swipe left uncovers', async () => {
    const { vaultKey } = await unlockedVaultWith([BANK, MAIL]);
    await inTheTrash(vaultKey);

    await startSwipes();
    await fireEvent.press(await screen.findByTestId('row-swipe-restore'));
    await act(() => router.push(`/${vaultKey}`));

    await waitFor(() => expect([...titlesInList()].sort()).toEqual(['Bank', 'Mail']));
  });

  it('offers the trash and a way out of the archive to an archived card', async () => {
    const { app, vaultKey } = await unlockedVaultWith([{ ...BANK, archivedAt: anHlc(2) }]);
    await act(() => router.push(`/${vaultKey}/archive`));
    await screen.findByTestId('swipe-row');
    await startSwipes();
    const trash = await screen.findByTestId('row-swipe-trash');

    await fireEvent.press(screen.getByTestId('row-swipe-unarchive'));

    expect(trash).toBeTruthy();
    await waitFor(() => expect(app.session?.document.cards.get(BANK.id)?.archivedAt).toBeNull());
  });

  it('keeps a card opened lately in a strip above the list', async () => {
    await unlockedVaultWith([BANK, MAIL]);
    await fireEvent.press(screen.getAllByTestId('card-row')[1] ?? screen.getByTestId('card-list'));
    await screen.findByTestId('card');

    await fireEvent.press(screen.getByTestId('back-to-list'));

    expect(await screen.findByTestId('recent-strip')).toBeOnTheScreen();
  });

  it('leaves out the strips the settings turn off', async () => {
    await unlockedVaultWith([{ ...BANK, favorite: true }, MAIL]);
    await fireEvent.press(screen.getAllByTestId('card-row')[1] ?? screen.getByTestId('card-list'));
    await screen.findByTestId('card');
    await fireEvent.press(screen.getByTestId('back-to-list'));
    await screen.findByTestId('recent-strip');

    await openSettingsTopic('display');
    await fireEvent.press(screen.getByTestId('show-recent'));
    await fireEvent.press(screen.getByTestId('tab-vault'));
    await screen.findByTestId('card-list-screen');

    expect({
      recent: screen.queryByTestId('recent-strip'),
      favorites: screen.queryByTestId('favorites-strip'),
    }).toEqual({ recent: null, favorites: expect.anything() });
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

    await waitFor(() => expect(getPathname()).toBe(`/${vaultKey}/settings/data`));
    expect(screen.getByTestId('settings-data')).toBeOnTheScreen();
  });
});
