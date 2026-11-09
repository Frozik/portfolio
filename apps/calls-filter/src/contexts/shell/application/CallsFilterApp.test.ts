import { when } from 'mobx';

import { fakePhone } from '../../../testing/fake-ports';
import { bookOf, custom } from '../../grouping/testing/group-book-fixtures';
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
