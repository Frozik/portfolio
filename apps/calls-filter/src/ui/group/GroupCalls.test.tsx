import { fireEvent, screen } from 'expo-router/testing-library';
import { Temporal } from 'temporal-polyfill';

import GroupRoute from '../../app/group/[id]';
import { STRANGERS_ID, stranger } from '../../contexts/grouping/testing/group-book-fixtures';
import type { IJournalEntry, TJournalEntryId } from '../../contexts/journal/domain/journal-entry';
import { fakePhone } from '../../testing/fake-ports';
import { pressBack } from '../../testing/press-back';
import { renderApp } from '../../testing/render-app';

const ROUTES = { 'group/[id]': GroupRoute };

function call(id: string, digits: string, networkName: string | null = null): IJournalEntry {
  return {
    id: id as TJournalEntryId,
    at: Temporal.Instant.from('2026-11-09T08:30:00Z'),
    rawNumber: `+${digits}`,
    caller: stranger(digits, networkName),
    dialerName: null,
    answered: null,
    outcome: { kind: 'history', type: 'missed' },
  };
}

const JOURNAL = [call('isanshin', '79864563560', 'IP Isanshin'), call('bakery', '31201234567')];

async function openStrangers(journal: readonly IJournalEntry[] = JOURNAL) {
  const rendered = await renderApp(ROUTES, {
    phone: fakePhone({ journal }),
    initialUrl: `/group/${STRANGERS_ID}`,
  });
  await screen.findByTestId('call-isanshin');
  return rendered;
}

describe('a group’s calls, searched', () => {
  it('keeps the field away until the filter opens it', async () => {
    await openStrangers();
    expect(screen.queryByTestId('group-search-field')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('group-search'));

    expect(screen.getByTestId('group-search')).toBeChecked();
    expect(screen.getByTestId('group-search-field')).toBeOnTheScreen();
  });

  it('closes on the phone’s back, the group staying open', async () => {
    const rendered = await openStrangers();
    await fireEvent.press(screen.getByTestId('group-search'));

    await pressBack();

    expect(screen.queryByTestId('group-search-field')).not.toBeOnTheScreen();
    expect(rendered.getPathname()).toBe(`/group/${STRANGERS_ID}`);
  });

  it('shows only the calls a part of the number or of a name finds', async () => {
    await openStrangers();
    await fireEvent.press(screen.getByTestId('group-search'));

    await fireEvent.changeText(screen.getByTestId('group-search-field'), 'isan');
    expect([
      screen.queryByTestId('call-isanshin') !== null,
      screen.queryByTestId('call-bakery') !== null,
    ]).toEqual([true, false]);

    await fireEvent.changeText(screen.getByTestId('group-search-field'), '20 123');
    expect([
      screen.queryByTestId('call-isanshin') !== null,
      screen.queryByTestId('call-bakery') !== null,
    ]).toEqual([false, true]);
  });

  it('says nothing was found instead of an empty screen', async () => {
    await openStrangers();
    await fireEvent.press(screen.getByTestId('group-search'));
    await fireEvent.changeText(screen.getByTestId('group-search-field'), 'pizza');

    expect(screen.getByTestId('group-search-nothing')).toBeOnTheScreen();
  });

  it('clears the query with the cross, the field staying open', async () => {
    await openStrangers();
    await fireEvent.press(screen.getByTestId('group-search'));
    await fireEvent.changeText(screen.getByTestId('group-search-field'), 'pizza');
    await fireEvent.press(screen.getByTestId('group-search-clear'));

    expect(screen.getByTestId('group-search-field')).toHaveDisplayValue('');
    expect(screen.getByTestId('call-bakery')).toBeOnTheScreen();
  });

  it('drops the query with the field: closing the filter shows every call again', async () => {
    await openStrangers();
    await fireEvent.press(screen.getByTestId('group-search'));
    await fireEvent.changeText(screen.getByTestId('group-search-field'), 'isan');
    await fireEvent.press(screen.getByTestId('group-search'));
    await fireEvent.press(screen.getByTestId('group-search'));

    expect(screen.getByTestId('group-search-field')).toHaveDisplayValue('');
    expect(screen.getByTestId('call-bakery')).toBeOnTheScreen();
  });

  it('leaves the filter to the calls: the rules tab has none, and coming back finds it closed', async () => {
    await openStrangers();
    await fireEvent.press(screen.getByTestId('group-search'));
    await fireEvent.press(screen.getByTestId('group-tab-rules'));
    expect(screen.queryByTestId('group-search')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('group-tab-calls'));

    expect(screen.getByTestId('group-search')).not.toBeChecked();
    expect(screen.queryByTestId('group-search-field')).not.toBeOnTheScreen();
  });

  it('offers no filter to a group without calls', async () => {
    await renderApp(ROUTES, { phone: fakePhone(), initialUrl: `/group/${STRANGERS_ID}` });

    expect(await screen.findByTestId('calls-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-search')).not.toBeOnTheScreen();
  });
});
