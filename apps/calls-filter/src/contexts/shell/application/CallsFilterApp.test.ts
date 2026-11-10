import { computed, reaction, when } from 'mobx';
import { Temporal } from 'temporal-polyfill';

import { fakePhone } from '../../../testing/fake-ports';
import { bookOf, custom } from '../../grouping/testing/group-book-fixtures';
import { ALWAYS_PASS, withConditions } from '../../policy/domain/policy';
import { CallsFilterApp } from './CallsFilterApp';

const REPLYING = custom('meetings', [], { autoReply: { text: 'In a meeting' } });

async function promptOf(smsReply: boolean) {
  const phone = fakePhone({ book: bookOf([REPLYING]), smsReply });
  const app = await CallsFilterApp.start({
    ...phone.ports,
    permissions: {
      state: async permission => (permission === 'sms' ? 'denied' : 'granted'),
      request: async permission => (permission === 'sms' ? 'denied' : 'granted'),
    },
  });
  await app.foreground();
  await when(() => app.device.permissions.sms === 'denied');
  const step = app.permissionPrompt.step;
  app.dispose();
  return step;
}

describe('the app asking for permissions', () => {
  it('asks for SMS once a group replies by SMS', async () => {
    expect(await promptOf(true)).toBe('sms');
  });

  it('never asks for SMS in the edition built without SMS, whatever a synced group says', async () => {
    expect(await promptOf(false)).toBeNull();
  });
});

describe('whether a group is in force, as time passes', () => {
  it('moves on by itself once its working hours end', async () => {
    let now = Temporal.ZonedDateTime.from('2026-11-09T17:50[Europe/Amsterdam]');
    let tick = () => {};
    const group = custom('work', [], {
      policy: withConditions(ALWAYS_PASS, {
        schedule: {
          zone: { kind: 'here' },
          start: Temporal.PlainDate.from('2026-11-02'),
          times: [
            {
              kind: 'range',
              from: Temporal.PlainTime.from('09:00'),
              to: Temporal.PlainTime.from('18:00'),
            },
          ],
          repeat: {
            frequency: 'weekly',
            interval: 1,
            weekdays: [1, 2, 3, 4, 5],
            monthly: null,
            end: { kind: 'never' },
          },
          exceptDates: [],
        },
        calendars: [],
        places: [],
      }),
    });
    const phone = fakePhone({ book: bookOf([group]) });
    const app = await CallsFilterApp.start({
      ...phone.ports,
      clock: {
        ...phone.ports.clock,
        now: () => now.toInstant(),
        localNow: () => now.toPlainDateTime(),
      },
      everyMinute: onTick => {
        tick = onTick;
        return () => {};
      },
    });
    const seen = computed(() => app.statusOf(app.books.book.groups[0] ?? group).activity);
    const stop = reaction(
      () => seen.get(),
      () => {}
    );
    expect(seen.get()).toBe('conditions-hold');

    now = now.add({ minutes: 11 });
    tick();

    expect(seen.get()).toBe('conditions-unmet');
    stop();
    app.dispose();
  });
});
