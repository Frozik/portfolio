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
  contactName: null,
  contactId: null,
} as const;

async function readStranger(names: {
  readonly cachedName: string | null;
  readonly networkName: string | null;
}) {
  systemCallLog.mockResolvedValue([{ ...STRANGER, ...names }]);
  const history = nativeCallHistory(LIBPHONENUMBER_NUMBERING, () => 'NL' as TCountryCode);
  const [entry] = await history.since(Temporal.Instant.fromEpochMilliseconds(0), 10);
  return entry;
}

describe('the phone’s call log, read as the journal', () => {
  it('takes the name the network sent as the operator’s, so a name mask finds the call', async () => {
    const entry = await readStranger({
      cachedName: 'IP Isanshin: kol-tsentr',
      networkName: 'IP Isanshin: kol-tsentr',
    });
    expect([entry?.caller.networkName, entry?.dialerName]).toEqual([
      'ip isanshin: kol-tsentr',
      null,
    ]);
  });

  it('keeps a name only the dialer found as the dialer’s, shown and never matched', async () => {
    const entry = await readStranger({ cachedName: 'Pizza Napoli', networkName: null });
    expect([entry?.caller.networkName, entry?.dialerName]).toEqual([null, 'Pizza Napoli']);
  });
});
