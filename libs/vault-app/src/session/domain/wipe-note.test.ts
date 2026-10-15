import { lockReasonFromNote, vaultKeyOfNote, wipeNoteText } from './wipe-note';

const NOTE = wipeNoteText({ vaultKey: 'a1b2', reason: 'manual' });

describe('the note a lock leaves for the next process', () => {
  it('names the vault to come back to, and why it locked', () => {
    expect([vaultKeyOfNote(NOTE), lockReasonFromNote(NOTE, 'a1b2')]).toEqual(['a1b2', 'manual']);
  });

  it('names nothing when there is no note or it is garbled', () => {
    expect([vaultKeyOfNote(null), vaultKeyOfNote('{not json'), vaultKeyOfNote('{"x":1}')]).toEqual([
      null,
      null,
      null,
    ]);
  });
});
