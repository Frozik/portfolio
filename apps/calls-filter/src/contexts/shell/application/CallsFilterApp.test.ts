import { computed, reaction, when } from 'mobx';
import { Temporal } from 'temporal-polyfill';

import { fakePhone } from '../../../testing/fake-ports';
import { bookOf, custom } from '../../grouping/testing/group-book-fixtures';
import { ALWAYS_BLOCK } from '../../policy/domain/policy';
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

describe('what a group does, as time passes', () => {
  it('moves on by itself once the change it waited for has passed', async () => {
    let now = Temporal.ZonedDateTime.from('2026-11-09T10:00[Europe/Amsterdam]');
    let tick = () => {};
    const group = custom('spam', [], {
      policy: ALWAYS_BLOCK,
      temporary: {
        action: 'pass',
        setAt: now.toInstant(),
        until: { kind: 'instant', at: now.add({ minutes: 30 }).toInstant() },
      },
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
    const seen = computed(() => app.statusOf(app.books.book.groups[0] ?? group).now.action);
    const stop = reaction(
      () => seen.get(),
      () => {}
    );
    expect(seen.get()).toBe('pass');

    now = now.add({ minutes: 31 });
    tick();

    expect(seen.get()).toBe('block');
    stop();
    app.dispose();
  });
});
