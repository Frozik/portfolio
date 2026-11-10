import { fireEvent, screen } from 'expo-router/testing-library';

import CalendarsRoute from '../../app/calendars';
import { bookOf, custom } from '../../contexts/grouping/testing/group-book-fixtures';
import type { IFakePhone } from '../../testing/fake-ports';
import { fakePhone } from '../../testing/fake-ports';
import { renderApp } from '../../testing/render-app';

const TEAM_URL = 'https://calendar.example.com/team.ics';
const TEAM_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//test//EN',
  'BEGIN:VEVENT',
  'UID:planning@example.com',
  'DTSTART:20261109T130000Z',
  'DTEND:20261109T140000Z',
  'SUMMARY:Planning',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

async function openCalendarsOf(groupId: string) {
  const phone = fakePhone({
    book: bookOf([custom(groupId, [])]),
    icsFeeds: { [TEAM_URL]: TEAM_ICS },
  });
  await renderApp(
    { calendars: CalendarsRoute },
    { phone, initialUrl: `/calendars?group=${groupId}` }
  );
  await fireEvent.press(await screen.findByTestId('ics-add-open'));
  return phone;
}

async function addTeamCalendar() {
  await fireEvent.changeText(screen.getByTestId('ics-label'), 'Team');
  await fireEvent.changeText(screen.getByTestId('ics-url'), TEAM_URL);
  await fireEvent.press(screen.getByTestId('ics-add'));
}

function calendarRules(phone: IFakePhone) {
  return (
    phone.saved()?.groups.find(group => group.id === 'work')?.policy.scheduled?.calendars ?? []
  );
}

describe('an iCal link added from a group’s calendars', () => {
  it('is fetched, listed and turned on for the group, outside its events', async () => {
    await openCalendarsOf('work');
    await addTeamCalendar();

    expect(await screen.findByTestId('calendar-ics-id-1-except')).toBeSelected();
    expect(screen.queryByTestId('ics-sheet')).toBeNull();
  });

  it('acts during the events of a calendar, or not on it at all, as its switch says', async () => {
    const phone = await openCalendarsOf('work');
    await addTeamCalendar();

    await fireEvent.press(await screen.findByTestId('calendar-ics-id-1-only'));
    expect(calendarRules(phone).map(rule => rule.mode)).toEqual(['only-during-events']);

    await fireEvent.press(screen.getByTestId('calendar-ics-id-1-off'));
    expect(calendarRules(phone)).toEqual([]);
    expect(screen.getByTestId('calendar-ics-id-1-off')).toBeSelected();
  });

  it('stays open and says so when the link cannot be read', async () => {
    await openCalendarsOf('work');
    await fireEvent.changeText(screen.getByTestId('ics-label'), 'Typo');
    await fireEvent.changeText(
      screen.getByTestId('ics-url'),
      'https://calendar.example.com/typo.ics'
    );
    await fireEvent.press(screen.getByTestId('ics-add'));

    expect(await screen.findByTestId('ics-failed')).toBeOnTheScreen();
    expect(screen.getByTestId('ics-sheet')).toBeOnTheScreen();
  });

  it('sets what the group does while its calendars agree, right where they are set', async () => {
    const phone = await openCalendarsOf('work');
    await addTeamCalendar();

    await fireEvent.press(await screen.findByTestId('window-action-pass'));

    expect(phone.saved()?.groups.find(group => group.id === 'work')?.policy.scheduled?.action).toBe(
      'pass'
    );
  });
});
