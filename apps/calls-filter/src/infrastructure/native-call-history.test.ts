import { Temporal } from 'temporal-polyfill';

import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { TCountryCode } from '../contexts/phone/domain/dialing-region';
import { LIBPHONENUMBER_NUMBERING } from './libphonenumber-numbering';
import { nativeCallHistory } from './native-call-history';

jest.mock('../../modules/call-screening/src/CallScreeningModule', () => ({
  CALL_SCREENING: { systemCallLog: jest.fn() },
}));

const systemCallLog = jest.mocked(CALL_SCREENING.systemCallLog);

const STRANGER = {
  epochMs: 1_794_156_901_361,
  rawNumber: '+79864563560',
  kind: 'rejected',
} as const;

async function readCall(names: {
  readonly networkName: string | null;
  readonly dialerName: string | null;
  readonly contactName?: string;
}) {
  const contactName = names.contactName ?? null;
  systemCallLog.mockResolvedValue([
    {
      ...STRANGER,
      networkName: names.networkName,
      dialerName: names.dialerName,
      contactName,
      contactId: contactName === null ? null : 'contact-1',
    },
  ]);
  const history = nativeCallHistory(LIBPHONENUMBER_NUMBERING, () => 'NL' as TCountryCode);
  const [entry] = await history.since(Temporal.Instant.fromEpochMilliseconds(0), 10);
  return entry;
}

describe('the phone’s call log, read as the journal', () => {
  it('takes the name the network sent as the operator’s, so a name mask finds the call', async () => {
    const entry = await readCall({ networkName: 'IP Isanshin: kol-tsentr', dialerName: null });
    expect([entry?.caller.networkName, entry?.caller.dialer]).toEqual([
      'ip isanshin: kol-tsentr',
      null,
    ]);
  });

  it('keeps the name the dialer found for a stranger as the dialer’s', async () => {
    const entry = await readCall({ networkName: null, dialerName: 'Pizza Napoli' });
    expect([entry?.caller.networkName, entry?.caller.dialer?.displayName]).toEqual([
      null,
      'Pizza Napoli',
    ]);
  });

  it('gives a contact’s call no dialer name: the dialer only wrote the contact’s own', async () => {
    const entry = await readCall({
      networkName: null,
      dialerName: 'Anna Petrova',
      contactName: 'Anna Petrova',
    });
    expect([entry?.caller.contact?.displayName, entry?.caller.dialer]).toEqual([
      'Anna Petrova',
      null,
    ]);
  });
});
