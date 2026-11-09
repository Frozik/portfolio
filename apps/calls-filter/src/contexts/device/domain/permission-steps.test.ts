import type { IPermissionFacts } from './permission-steps';
import { missingSteps } from './permission-steps';

const ALL_GRANTED: IPermissionFacts = {
  holdsRole: true,
  permissions: {
    contacts: 'granted',
    calendar: 'granted',
    'call-log': 'granted',
    notifications: 'granted',
    'phone-state': 'granted',
    sms: 'granted',
    location: 'granted',
    'background-location': 'granted',
  },
  usesDeviceCalendars: false,
  usesAutoReply: false,
  usesPlaces: false,
};

describe('the permissions the app still asks for', () => {
  it('starts with the screening role, without which nothing is screened', () => {
    const facts = {
      ...ALL_GRANTED,
      holdsRole: false,
      permissions: { ...ALL_GRANTED.permissions, contacts: 'ask' as const },
    };
    expect(missingSteps(facts)).toEqual(['screening-role', 'contacts']);
  });

  it('asks for the calendar and SMS only once a group needs them', () => {
    const lacking = {
      ...ALL_GRANTED,
      permissions: { ...ALL_GRANTED.permissions, calendar: 'ask' as const, sms: 'ask' as const },
    };
    expect(missingSteps(lacking)).toEqual([]);
    expect(missingSteps({ ...lacking, usesDeviceCalendars: true, usesAutoReply: true })).toEqual([
      'calendar',
      'sms',
    ]);
  });

  it('asks for nothing once everything is granted', () => {
    expect(missingSteps(ALL_GRANTED)).toEqual([]);
  });
});
